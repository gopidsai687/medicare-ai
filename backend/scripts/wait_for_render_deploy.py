import time
import urllib.request
import json
import sys

BASE = "https://medicare-ai-iv31.onrender.com"
print("==================================================================", flush=True)
print("Monitoring Render for Live Deployment of Commit 1a9efd1...", flush=True)
print("==================================================================", flush=True)

deployed = False
for attempt in range(1, 45):
    try:
        # Check login
        login_data = json.dumps({"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"}).encode()
        login_req = urllib.request.Request(
            f"{BASE}/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(login_req, timeout=15) as res:
            token = json.loads(res.read().decode())["access_token"]

        # Check if the new /vitals/reminders endpoint is active
        rem_req = urllib.request.Request(
            f"{BASE}/api/v1/vitals/reminders",
            headers={"Authorization": f"Bearer {token}", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(rem_req, timeout=15) as res:
            if res.status == 200:
                print(f"\n>>> SUCCESS: Commit 1a9efd1 is DEPLOYED and ACTIVE on Render! (Attempt {attempt}) <<<\n", flush=True)
                deployed = True
                break
    except urllib.error.HTTPError as http_err:
        print(f"[{attempt}/45] Status: HTTP {http_err.code} — Waiting for Render container build/swap...", flush=True)
    except Exception as exc:
        print(f"[{attempt}/45] Waiting... ({exc})", flush=True)
    time.sleep(12)

if not deployed:
    print("Deployment timed out after 45 attempts. Please check Render dashboard build logs.", flush=True)
    sys.exit(1)

print("\n--- Running Live Production Verification Suite ---", flush=True)

# 1. Health
with urllib.request.urlopen(f"{BASE}/api/health", timeout=15) as res:
    print(f"1. Health API: {res.status} {res.read().decode()}")

# 2. Patient Login
login_data = json.dumps({"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"}).encode()
login_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(login_req, timeout=15) as res:
    pat_token = json.loads(res.read().decode())["access_token"]
    print("2. Patient Login: Verified token received.")

# 3. Post a Blood Pressure Reading
bp_payload = json.dumps({
    "systolic_bp": 118,
    "diastolic_bp": 76,
    "heart_rate": 68,
    "measurement_source": "OMRON",
    "device_name": "Omron Evolv Wireless",
    "notes": "Verified home morning reading"
}).encode()
bp_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-pressure",
    data=bp_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST"
)
with urllib.request.urlopen(bp_req, timeout=15) as res:
    bp_data = json.loads(res.read().decode())
    print(f"3. Blood Pressure Logging: Saved! Category: {bp_data.get('bp_category')}, MAP: {bp_data.get('mean_arterial_pressure')} mmHg")

# 4. Post a Blood Glucose Reading
gl_payload = json.dumps({
    "blood_glucose": 94.0,
    "glucose_unit": "mg/dL",
    "glucose_context": "FASTING",
    "measurement_source": "DEXCOM",
    "device_name": "Dexcom G7 CGM",
    "notes": "Verified fasting telemetry"
}).encode()
gl_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-glucose",
    data=gl_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST"
)
with urllib.request.urlopen(gl_req, timeout=15) as res:
    gl_data = json.loads(res.read().decode())
    print(f"4. Blood Glucose Logging: Saved! Category: {gl_data.get('glucose_category')}, mmol/L: {gl_data.get('blood_glucose_mmol')}")

# 5. Trend Analysis
trend_payload = json.dumps({"days": 30, "measurement_type": "all"}).encode()
trend_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/analyze-trends",
    data=trend_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST"
)
with urllib.request.urlopen(trend_req, timeout=25) as res:
    trend_res = json.loads(res.read().decode())
    print(f"5. AI Trend Analyzer: Observations: {len(trend_res['observations'])}, MAP: {trend_res['stats'].get('mean_arterial_pressure')}")
    print(f"   Explanation sample: {trend_res['trend_explanation'][:100]}...")

# 6. Doctor Access
doc_login_data = json.dumps({"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"}).encode()
doc_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=doc_login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_req, timeout=15) as res:
    doc_token = json.loads(res.read().decode())["access_token"]
    print("6. Doctor Login: Verified token received.")

doc_pat_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/doctor/patients",
    headers={"Authorization": f"Bearer {doc_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_pat_req, timeout=15) as res:
    consented_patients = json.loads(res.read().decode())
    print(f"7. Doctor Portal Consented Patients: Found {len(consented_patients)} patients with verified consent.")

print("\n>>> ALL LIVE PRODUCTION VERIFICATIONS PASSED SUCCESSFULLY! <<<\n", flush=True)
sys.exit(0)
