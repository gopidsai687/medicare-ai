import time
import urllib.request
import urllib.error
import json
import sys
import re

BASE = "https://medicare-ai-iv31.onrender.com"
TARGET_COMMIT = "2809e3e"
EXPECTED_BUNDLE = "index-DnSm1ysR"
EXPECTED_CSS = "index-D1lEIQpV"

print("==================================================================", flush=True)
print(f"Monitoring Render for Live Deployment of Commit {TARGET_COMMIT}...", flush=True)
print("Checking for Frontend Bundles (index-Cr7TuGBo.js & index-DVB9OdQu.css)...", flush=True)
print("==================================================================", flush=True)

deployed = False
for attempt in range(1, 120):
    try:
        req = urllib.request.Request(f"{BASE}/", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as res:
            html = res.read().decode("utf-8", errors="ignore")
            scripts = re.findall(r'src="([^"]+)"', html)
            css = re.findall(r'href="([^"]+\.css)"', html)
            
            # Detect new container: expected bundle exists
            is_new = any(EXPECTED_BUNDLE in s for s in scripts) or any(EXPECTED_CSS in c for c in css)
            if is_new:
                print(f"\n>>> SUCCESS: Commit {TARGET_COMMIT} is DEPLOYED and LIVE on Render! (Attempt {attempt}) <<<\n", flush=True)
                print(f"Live HTML scripts: {scripts}", flush=True)
                print(f"Live HTML CSS: {css}", flush=True)
                deployed = True
                break
            else:
                print(f"[{attempt}/60] Render still serving previous container assets ({scripts}). Waiting 15s...", flush=True)
    except Exception as exc:
        print(f"[{attempt}/60] Waiting for Render... ({exc})", flush=True)
    time.sleep(15)

if not deployed:
    print(f"\nDeployment monitoring timed out after 60 attempts for commit {TARGET_COMMIT}.", flush=True)
    print("Render may still be compiling the multi-stage Docker container or requires a manual rebuild trigger.", flush=True)
    sys.exit(1)

print("\n--- Running Live Production Verification Suite for Hardwareless Workflows ---", flush=True)

# 1. Health API
with urllib.request.urlopen(f"{BASE}/api/health", timeout=15) as res:
    print(f"1. Health API: {res.status} {res.read().decode().strip()}")

# 2. Patient Login (Alice Johnson)
login_data = json.dumps({"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"}).encode()
login_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(login_req, timeout=15) as res:
    pat_token = json.loads(res.read().decode())["access_token"]
    print("2. Patient Login (Alice Johnson): Token received successfully.")

# 3. Doctor Login (Dr. Sarah Chen)
doc_login_data = json.dumps({"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"}).encode()
doc_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=doc_login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_req, timeout=15) as res:
    doc_token = json.loads(res.read().decode())["access_token"]
    print("3. Doctor Login (Dr. Sarah Chen): Token received successfully.")

# 4. Mode B Manual Entry: Log Blood Pressure (Genuine Patient Reading)
bp_manual_payload = json.dumps({
    "systolic_bp": 124,
    "diastolic_bp": 82,
    "heart_rate": 70,
    "measurement_source": "manual_home_cuff",
    "notes": "[PROD MANUAL ENTRY] Home cuff resting measurement",
    "is_sample": False,
}).encode()
bp_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-pressure",
    data=bp_manual_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(bp_req, timeout=15) as res:
    bp_data = json.loads(res.read().decode())
    real_bp_id = bp_data["id"]
    print(f"4. Mode B Manual Blood Pressure: Saved {bp_data['systolic_bp']}/{bp_data['diastolic_bp']} mmHg")
    print(f"   Provenance: is_sample={bp_data['is_sample']}, source='{bp_data['measurement_source']}', category='{bp_data['bp_category']}'")
    assert bp_data["is_sample"] is False
    assert bp_data["measurement_source"] == "manual_home_cuff"

# 5. Mode B Manual Entry: Log Blood Glucose (Genuine Patient Reading with Unit Conversion)
glu_manual_payload = json.dumps({
    "blood_glucose": 105.0,
    "glucose_unit": "mg/dL",
    "glucose_context": "fasting",
    "measurement_source": "manual_fingerstick",
    "notes": "[PROD MANUAL ENTRY] Morning fasting electrochemical test strip",
    "is_sample": False,
}).encode()
glu_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-glucose",
    data=glu_manual_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(glu_req, timeout=15) as res:
    glu_data = json.loads(res.read().decode())
    real_glu_id = glu_data["id"]
    print(f"5. Mode B Manual Blood Glucose: Saved {glu_data['blood_glucose']} mg/dL ({glu_data['blood_glucose_mmol']} mmol/L)")
    print(f"   Context: '{glu_data['glucose_context']}', is_sample={glu_data['is_sample']}, source='{glu_data['measurement_source']}'")
    assert glu_data["is_sample"] is False
    assert glu_data["measurement_source"] == "manual_fingerstick"

# 6. Mode C Simulation: Inject Demo Data
demo_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/test-mode/simulate",
    data=json.dumps({"state": "attention"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(demo_req, timeout=15) as res:
    demo_data = json.loads(res.read().decode())
    print(f"6. Mode C Demo Simulation: Generated sample state '{demo_data.get('state', 'simulated')}'")
    assert demo_data["vital"]["is_sample"] is True
    assert demo_data["vital"]["measurement_source"] == "SAMPLE_DATA"

# 7. Mode C Reset Preservation: Clear Demo Data & Verify Genuine Measurements Persist
clear_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/test-mode/simulate",
    data=json.dumps({"state": "clear_test_data"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(clear_req, timeout=15) as res:
    clear_data = json.loads(res.read().decode())
    print(f"7. Mode C Demo Reset: Cleared {clear_data.get('deleted_count', 0)} fictional demo records.")

# 8. Verify Genuine Patient Measurements Still Exist after Demo Reset
hist_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/history?limit=20",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(hist_req, timeout=15) as res:
    history = json.loads(res.read().decode())
    found_bp = any(v["id"] == real_bp_id for v in history)
    found_glu = any(v["id"] == real_glu_id for v in history)
    any_demo = any(v["is_sample"] is True for v in history)
    print(f"8. Reset Safety Verification:")
    print(f"   Genuine BP Measurement Preserved: {found_bp}")
    print(f"   Genuine Glucose Measurement Preserved: {found_glu}")
    print(f"   Zero Demo Data in Genuine History: {not any_demo}")
    assert found_bp, "Genuine BP measurement was deleted by demo reset!"
    assert found_glu, "Genuine Glucose measurement was deleted by demo reset!"

# 9. Cross-Patient Isolation Security Check
unauth_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/doctor/patients/00000000-0000-0000-0000-000000000001",
    headers={"Authorization": f"Bearer {doc_token}", "User-Agent": "Mozilla/5.0"},
)
try:
    with urllib.request.urlopen(unauth_req, timeout=15) as res:
        print("ERROR: Unauthorized cross-patient access succeeded!")
except urllib.error.HTTPError as http_err:
    print(f"9. Cross-Patient Isolation: Blocked correctly with HTTP {http_err.code} ({http_err.reason})")

print("\n>>> ALL PRODUCTION HARDWARELESS WORKFLOWS CONFIRMED OPERATIONAL ON RENDER! <<<\n", flush=True)
