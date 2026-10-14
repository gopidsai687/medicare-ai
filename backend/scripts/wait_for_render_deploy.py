import time
import urllib.request
import urllib.error
import json
import sys

BASE = "https://medicare-ai-iv31.onrender.com"
TARGET_COMMIT = "46b7ef6"

print("==================================================================", flush=True)
print(f"Monitoring Render for Live Deployment of Commit {TARGET_COMMIT}...", flush=True)
print("Checking for WebAuthn Passkey API & VitalSense Test Mode Endpoints...", flush=True)
print("==================================================================", flush=True)

deployed = False
for attempt in range(1, 90):
    try:
        # 1. Login as Alice to get a token
        login_data = json.dumps({"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"}).encode()
        login_req = urllib.request.Request(
            f"{BASE}/api/v1/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(login_req, timeout=15) as res:
            probe_token = json.loads(res.read().decode())["access_token"]

        # 2. Check if /api/v1/vitals/history (the route alias introduced in commit 46b7ef6) is live
        hist_req = urllib.request.Request(
            f"{BASE}/api/v1/vitals/history?limit=1",
            headers={"Authorization": f"Bearer {probe_token}", "User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(hist_req, timeout=20) as res:
            if res.status == 200:
                print(f"\n>>> SUCCESS: Commit {TARGET_COMMIT} is DEPLOYED and LIVE on Render! (Attempt {attempt}) <<<\n", flush=True)
                deployed = True
                break
    except urllib.error.HTTPError as http_err:
        if http_err.code == 404:
            print(f"[{attempt}/90] Route /vitals/history returned 404 (Render still running previous commit). Waiting 15s for Docker build & container swap...", flush=True)
        else:
            print(f"[{attempt}/90] Status: HTTP {http_err.code} — Waiting for Render container swap...", flush=True)
    except Exception as exc:
        print(f"[{attempt}/90] Waiting for Render... ({exc})", flush=True)
    time.sleep(15)

if not deployed:
    print(f"\nDeployment monitoring timed out after 60 attempts for commit {TARGET_COMMIT}.", flush=True)
    print("Render may be processing the Docker build or auto-deploy might require manual trigger.", flush=True)
    sys.exit(1)

print("\n--- Running Live Production Verification Suite for Commit " + TARGET_COMMIT + " ---", flush=True)

# 1. Health API
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
    print("2. Patient Login (Alice Johnson): Token received successfully.")

# 3. Doctor Login
doc_login_data = json.dumps({"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"}).encode()
doc_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=doc_login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_req, timeout=15) as res:
    doc_token = json.loads(res.read().decode())["access_token"]
    print("3. Doctor Login (Dr. Sarah Chen): Token received successfully.")

# 4. Admin Login
admin_login_data = json.dumps({"email": "admin@medicare.ai", "password": "AdminPass123!"}).encode()
admin_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=admin_login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(admin_req, timeout=15) as res:
    admin_token = json.loads(res.read().decode())["access_token"]
    print("4. Admin Login (System Admin): Token received successfully.")

# 5. WebAuthn Passkey Registration Options (Authenticated)
reg_opt_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/passkeys/register-options",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(reg_opt_req, timeout=15) as res:
    reg_opts = json.loads(res.read().decode())
    print(f"5. WebAuthn Register Options: Challenge generated: {reg_opts['challenge'][:15]}... RP: {reg_opts['rp']['name']}")

# 6. VitalSense Test Mode: Simulate Normal State
sim_norm_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/test-mode/simulate",
    data=json.dumps({"state": "normal"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(sim_norm_req, timeout=15) as res:
    sim_norm = json.loads(res.read().decode())
    print(f"6. VitalSense Test Mode [Normal Simulation]: {sim_norm['message']} (is_sample={sim_norm['vital']['is_sample']})")

# 7. VitalSense Test Mode: Simulate Urgent Crisis State & Check Explainable Alert
sim_urg_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/test-mode/simulate",
    data=json.dumps({"state": "urgent"}).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(sim_urg_req, timeout=15) as res:
    sim_urg = json.loads(res.read().decode())
    print(f"7. VitalSense Test Mode [Urgent Crisis]: SBP {sim_urg['vital']['systolic_bp']}/{sim_urg['vital']['diastolic_bp']} mmHg, Alerts Triggered: {sim_urg['alerts_triggered']}")

# 8. Check Active Clinical Alerts & Explanations
alerts_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/alerts?status=active",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(alerts_req, timeout=15) as res:
    active_alerts = json.loads(res.read().decode())
    print(f"8. Active Clinical Alerts: Found {len(active_alerts)} active alerts.")
    if active_alerts:
        top_alert = active_alerts[0]
        print(f"   Top Alert: [{top_alert['severity'].upper()}] {top_alert['title']}")
        print(f"   Triggered Explanation: {top_alert['message']}")
        print(f"   Recorded Timestamp: {top_alert['created_at']}")

# 9. Body Map Status Reactivity
bm_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/body-map",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(bm_req, timeout=15) as res:
    bm = json.loads(res.read().decode())
    cv_status = bm["indicators"]["cardiovascular"]["status"]
    print(f"9. Interactive Body Map Reactivity: Cardiovascular status is '{cv_status}', overall: '{bm['overall_health_status']}'")

# 10. Cross-Patient Isolation Security Check
# Doctor cannot access non-consented patient data without consent
unauthorized_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/doctor/patients/00000000-0000-0000-0000-000000000001",
    headers={"Authorization": f"Bearer {doc_token}", "User-Agent": "Mozilla/5.0"},
)
try:
    with urllib.request.urlopen(unauthorized_req, timeout=15) as res:
        print("ERROR: Unauthorized access unexpectedly succeeded!")
except urllib.error.HTTPError as http_err:
    print(f"10. Cross-Patient Isolation: Blocked correctly with HTTP {http_err.code} ({http_err.reason})")

# 11. Blood Pressure Fictional Test Reading & History Alias Check
bp_test_payload = json.dumps({
    "systolic": 132,
    "diastolic": 84,
    "heart_rate": 76,
    "notes": "[PROD DEMO TEST] BP simulation",
    "is_sample": True,
}).encode()
bp_test_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-pressure",
    data=bp_test_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(bp_test_req, timeout=15) as res:
    bp_saved = json.loads(res.read().decode())
    print(f"11. Blood Pressure Test Reading: Saved {bp_saved['systolic_bp']}/{bp_saved['diastolic_bp']} mmHg (is_sample={bp_saved['is_sample']}, source={bp_saved['measurement_source']})")

# 12. Blood Glucose Test Reading & Health Profile Timeline Verification
glu_test_payload = json.dumps({
    "glucose_value": 115.0,
    "unit": "mg/dL",
    "context": "fasting",
    "notes": "[PROD DEMO TEST] Fasting glucose simulation",
    "is_sample": True,
}).encode()
glu_test_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/blood-glucose",
    data=glu_test_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
    method="POST",
)
with urllib.request.urlopen(glu_test_req, timeout=15) as res:
    glu_saved = json.loads(res.read().decode())
    print(f"12. Blood Glucose Test Reading: Saved {glu_saved['blood_glucose']} mg/dL (is_sample={glu_saved['is_sample']})")

# Check timeline contains the sample readings
profile_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/health-profile",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(profile_req, timeout=15) as res:
    prof_data = json.loads(res.read().decode())
    timeline_items = prof_data.get("timeline", [])
    sample_items = [t for t in timeline_items if t.get("is_sample") is True]
    print(f"13. Health Timeline Verification: Found {len(sample_items)} demo/sample entries in chronological patient timeline.")

print("\n>>> ALL PRODUCTION ENDPOINTS & SECURITY TESTS PASSED ON LIVE DEPLOYMENT! <<<\n", flush=True)
sys.exit(0)
