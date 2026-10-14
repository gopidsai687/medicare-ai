import sqlite3
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(backend_dir, "medicare.db")

print("Checking database at:", db_path)
con = sqlite3.connect(db_path)
cur = con.cursor()

# 1. Add columns to vital_signs
cur.execute("PRAGMA table_info(vital_signs)")
existing_cols = {row[1] for row in cur.fetchall()}
print("Existing columns:", existing_cols)

cols_to_add = [
    ("measurement_source", "VARCHAR(50) DEFAULT 'manual_entry'"),
    ("device_name", "VARCHAR(100)"),
    ("blood_glucose_mmol", "FLOAT"),
    ("glucose_unit", "VARCHAR(10) DEFAULT 'mg/dL'"),
    ("glucose_context", "VARCHAR(50) DEFAULT 'fasting'"),
    ("notes", "VARCHAR(500)"),
    ("clinical_notes", "VARCHAR(1000)"),
    ("is_patient_entered", "BOOLEAN DEFAULT 1"),
    ("is_sample", "BOOLEAN DEFAULT 0"),
]

for col_name, col_def in cols_to_add:
    if col_name not in existing_cols:
        print(f"Adding column: {col_name}")
        cur.execute(f"ALTER TABLE vital_signs ADD COLUMN {col_name} {col_def}")

# 2. Create vital_reminders table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS vital_reminders (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL,
    label VARCHAR(150) NOT NULL,
    time_of_day VARCHAR(20) NOT NULL,
    frequency VARCHAR(30) DEFAULT 'daily' NOT NULL,
    days_of_week VARCHAR(100),
    is_active BOOLEAN DEFAULT 1 NOT NULL
)
""")

# 3. Create vital_sharing_consents table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS vital_sharing_consents (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id VARCHAR(36) NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT 1 NOT NULL,
    consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    notes VARCHAR(500)
)
""")

# 4. Create webauthn_credentials table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    sign_count INTEGER DEFAULT 0 NOT NULL,
    device_name VARCHAR(150),
    aaguid VARCHAR(64)
)
""")

# 5. Create vital_alerts table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS vital_alerts (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    vital_id VARCHAR(36) REFERENCES vital_signs(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'attention' NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    clinical_guidance TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    acknowledged_at TIMESTAMP,
    acknowledged_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    clinical_notes TEXT
)
""")

# 6. Create notification_preferences table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS notification_preferences (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT 1 NOT NULL,
    quiet_hours_enabled BOOLEAN DEFAULT 0 NOT NULL,
    quiet_hours_start VARCHAR(10) DEFAULT '22:00' NOT NULL,
    quiet_hours_end VARCHAR(10) DEFAULT '07:00' NOT NULL,
    urgent_override_quiet_hours BOOLEAN DEFAULT 1 NOT NULL,
    bp_alerts_enabled BOOLEAN DEFAULT 1 NOT NULL,
    glucose_alerts_enabled BOOLEAN DEFAULT 1 NOT NULL,
    reminder_alerts_enabled BOOLEAN DEFAULT 1 NOT NULL,
    device_token TEXT
)
""")

con.commit()
con.close()
print("Local database schema migrated successfully!")

