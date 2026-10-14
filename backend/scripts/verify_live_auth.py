import json
import urllib.request
import urllib.error
import sys
import re

BASE = "https://medicare-ai-iv31.onrender.com"

print("==================================================================")
print("MediCare AI — Live Production Authentication & Role Verification")
print(f"Target URL: {BASE}")
print("==================================================================")

# 1. Fetch live index HTML and inspect bundle assets
try:
    req = urllib.request.Request(f"{BASE}/", headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as res:
        html = res.read().decode("utf-8", errors="ignore")
        scripts = re.findall(r'src="([^"]+)"', html)
        css = re.findall(r'href="([^"]+\.css)"', html)
        print(f"\n1. Live HTML Assets:")
        print(f"   Scripts: {scripts}")
        print(f"   CSS: {css}")
        
        has_new_js = any("index-Ix3KBKl5" in s for s in scripts)
        has_new_css = any("index-B0d9Y_eN" in c for c in css)
        print(f"   Matches commit 0efc8e3: JS={has_new_js}, CSS={has_new_css}")
        
        # Check that passkey strings are NOT in index.html
        assert "Passkey" not in html, "Warning: Passkey mentioned in index.html"
        assert "Fingerprint" not in html, "Warning: Fingerprint mentioned in index.html"
        print("   Passkey/Fingerprint strings absent from index.html: PASS")
except Exception as e:
    print(f"Error fetching live index HTML: {e}")

# Helper for login
def do_login(email, password):
    payload = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/v1/auth/login",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST"
    )
    return urllib.request.urlopen(req, timeout=15)

def get_current_user(token):
    req = urllib.request.Request(
        f"{BASE}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode())

# 2. Test Patient Login
print("\n2. Testing Patient Authentication (Alice Johnson)...")
try:
    with do_login("alice.johnson@medicare.ai", "PatientPass123!") as res:
        data = json.loads(res.read().decode())
        patient_token = data.get("access_token")
        assert patient_token, "No access token in response"
        print(f"   Status: {res.status} OK")
        print(f"   Access Token: received (type={data.get('token_type', 'bearer')})")
        
        me = get_current_user(patient_token)
        print(f"   User Info: Name={me.get('full_name')}, Role={me.get('role')}")
        assert me.get("role") == "patient", f"Expected role 'patient', got {me.get('role')}"
        print("   Patient Role Verification: PASS")
except Exception as e:
    print(f"   Patient Login FAILED: {e}")

# 3. Test Doctor Login
print("\n3. Testing Doctor Authentication (Dr. Sarah Chen)...")
try:
    with do_login("sarah.chen@medicare.ai", "DoctorPass123!") as res:
        data = json.loads(res.read().decode())
        doctor_token = data.get("access_token")
        assert doctor_token, "No access token in response"
        print(f"   Status: {res.status} OK")
        print(f"   Access Token: received (type={data.get('token_type', 'bearer')})")
        
        me = get_current_user(doctor_token)
        print(f"   User Info: Name={me.get('full_name')}, Role={me.get('role')}")
        assert me.get("role") == "doctor", f"Expected role 'doctor', got {me.get('role')}"
        print("   Doctor Role Verification: PASS")
except Exception as e:
    print(f"   Doctor Login FAILED: {e}")

# 4. Test Admin Login
print("\n4. Testing Admin Authentication (Admin User)...")
try:
    with do_login("admin@medicare.ai", "AdminPass123!") as res:
        data = json.loads(res.read().decode())
        admin_token = data.get("access_token")
        assert admin_token, "No access token in response"
        print(f"   Status: {res.status} OK")
        print(f"   Access Token: received (type={data.get('token_type', 'bearer')})")
        
        me = get_current_user(admin_token)
        print(f"   User Info: Name={me.get('full_name')}, Role={me.get('role')}")
        assert me.get("role") == "admin", f"Expected role 'admin', got {me.get('role')}"
        print("   Admin Role Verification: PASS")
except Exception as e:
    print(f"   Admin Login FAILED: {e}")

# 5. Test Invalid Credentials Handling (Must respond with 401 and error detail, without hanging)
print("\n5. Testing Invalid Credentials Handling (Alice Johnson with wrong password)...")
try:
    with do_login("alice.johnson@medicare.ai", "WrongPassword999!") as res:
        print("   ERROR: Invalid credentials unexpectedly succeeded!")
except urllib.error.HTTPError as http_err:
    print(f"   Status: {http_err.code} {http_err.reason}")
    body = http_err.read().decode()
    print(f"   Backend Detail: {body}")
    assert http_err.code == 401, f"Expected 401, got {http_err.code}"
    assert "detail" in body, "Response should contain error detail"
    print("   Invalid Credentials Rejection: PASS")
except Exception as e:
    print(f"   Unexpected error: {e}")

# 6. Test Role-Based Access Control Rejection
print("\n6. Testing Role-Based Authorization Isolation...")
# Patient trying to access doctor patient list
try:
    req = urllib.request.Request(
        f"{BASE}/api/v1/patients",
        headers={"Authorization": f"Bearer {patient_token}", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        print("   WARNING: Patient accessed doctor patient list unexpectedly!")
except urllib.error.HTTPError as http_err:
    print(f"   Patient -> Doctor endpoint: Blocked with HTTP {http_err.code} ({http_err.reason})")
    assert http_err.code in (401, 403), f"Expected 401/403, got {http_err.code}"

# Doctor trying to access admin audit logs
try:
    req = urllib.request.Request(
        f"{BASE}/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {doctor_token}", "User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        print("   WARNING: Doctor accessed admin audit logs unexpectedly!")
except urllib.error.HTTPError as http_err:
    print(f"   Doctor -> Admin endpoint: Blocked with HTTP {http_err.code} ({http_err.reason})")
    assert http_err.code in (401, 403), f"Expected 401/403, got {http_err.code}"

print("\n==================================================================")
print("Authentication & Role Authorization Suite Complete!")
print("==================================================================")
