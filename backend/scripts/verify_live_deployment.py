import urllib.request
import json

BASE = "https://medicare-ai-iv31.onrender.com"

print("--- 1. Testing Live Health Check ---")
with urllib.request.urlopen(f"{BASE}/api/health", timeout=15) as res:
    print("Health:", res.status, res.read().decode())

print("\n--- 2. Testing Live Patient Login (Alice Johnson) ---")
login_data = json.dumps({"email": "alice.johnson@medicare.ai", "password": "PatientPass123!"}).encode()
req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(req, timeout=15) as res:
    pat_token = json.loads(res.read().decode())["access_token"]
    print("Patient login success! Token received.")

print("\n--- 3. Testing Live Patient VitalSense Telemetry ---")
vitals_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals?days=30",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(vitals_req, timeout=15) as res:
    vitals_data = json.loads(res.read().decode())
    print(f"Loaded {len(vitals_data)} live telemetry records for Alice Johnson.")
    if vitals_data:
        first = vitals_data[0]
        print(f"Sample Vital: BP {first.get('systolic_bp')}/{first.get('diastolic_bp')} mmHg, Category: {first.get('bp_category')}, Glucose: {first.get('blood_glucose')} mg/dL, Source: {first.get('measurement_source')}")

print("\n--- 4. Testing Live AI Trend Analyzer ---")
trend_payload = json.dumps({"days": 30, "measurement_type": "all"}).encode()
trend_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/analyze-trends",
    data=trend_payload,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(trend_req, timeout=20) as res:
    trend_res = json.loads(res.read().decode())
    print("Trend Analysis Response:", trend_res["observations"][:2])
    print("MAP:", trend_res["stats"].get("mean_arterial_pressure"))
    print("Grounded Explanation Excerpt:", trend_res["trend_explanation"][:120], "...")

print("\n--- 5. Testing Live Doctor Login (Dr. Sarah Chen) ---")
doc_login_data = json.dumps({"email": "sarah.chen@medicare.ai", "password": "DoctorPass123!"}).encode()
doc_req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=doc_login_data,
    headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_req, timeout=15) as res:
    doc_token = json.loads(res.read().decode())["access_token"]
    print("Doctor login success! Token received.")

print("\n--- 6. Testing Live Doctor Consented Patients ---")
doc_pat_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/doctor/patients",
    headers={"Authorization": f"Bearer {doc_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(doc_pat_req, timeout=15) as res:
    doc_patients = json.loads(res.read().decode())
    print(f"Doctor has {len(doc_patients)} consented patients. First: {doc_patients[0]['name']} (MRN: {doc_patients[0]['mrn']})")

print("\n--- 7. Testing Body Map Endpoint ---")
bodymap_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/body-map",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(bodymap_req, timeout=15) as res:
    bodymap_data = json.loads(res.read().decode())
    print(f"Body Map loaded successfully! Hotspots: {list(bodymap_data.get('indicators', {}).keys())}")

print("\n--- 8. Testing Emergency Hospital Discovery ---")
hosp_req = urllib.request.Request(
    f"{BASE}/api/v1/vitals/emergency/hospitals?latitude=37.7749&longitude=-122.4194",
    headers={"Authorization": f"Bearer {pat_token}", "User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(hosp_req, timeout=15) as res:
    hosp_data = json.loads(res.read().decode())
    print(f"Emergency hospitals found: {len(hosp_data.get('hospitals', []))}, 911 hotline: {hosp_data.get('emergency_hotline')}")

print("\n--- 9. Testing Frontend HTML Serving ---")
html_req = urllib.request.Request(
    f"{BASE}/patient/body-map",
    headers={"User-Agent": "Mozilla/5.0"},
)
with urllib.request.urlopen(html_req, timeout=15) as res:
    html_content = res.read().decode()
    assert "<div id=\"root\">" in html_content
    print("Frontend SPA HTML correctly returned with status 200!")

print("\nALL LIVE PRODUCTION CHECKS VERIFIED SUCCESSFULLY!")

