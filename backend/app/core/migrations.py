"""
Self-healing schema migration utility.
Safely checks and adds missing columns and tables to SQLite and PostgreSQL databases
without dropping data or breaking existing records.
"""
import structlog
from sqlalchemy import text, inspect

log = structlog.get_logger(__name__)

MIGRATION_COLUMNS = {
    "blood_pressure_measurements": [
        ("device_identifier", "VARCHAR(100)"),
        ("device_connection_id", "VARCHAR(36)"),
        ("external_reading_id", "VARCHAR(100)"),
        ("reading_hash", "VARCHAR(64)"),
    ],
    "glucose_measurements": [
        ("device_identifier", "VARCHAR(100)"),
        ("device_connection_id", "VARCHAR(36)"),
        ("external_reading_id", "VARCHAR(100)"),
        ("reading_hash", "VARCHAR(64)"),
    ],
    "device_connections": [
        ("battery_level", "INTEGER"),
        ("firmware_version", "VARCHAR(50)"),
        ("hardware_version", "VARCHAR(50)"),
    ],
    "vital_signs": [
        ("measurement_source", "VARCHAR(50) DEFAULT 'manual_entry' NOT NULL"),
        ("device_name", "VARCHAR(100)"),
        ("blood_glucose_mmol", "FLOAT"),
        ("glucose_unit", "VARCHAR(10) DEFAULT 'mg/dL' NOT NULL"),
        ("glucose_context", "VARCHAR(50) DEFAULT 'fasting'"),
        ("notes", "VARCHAR(500)"),
        ("clinical_notes", "VARCHAR(1000)"),
        ("is_patient_entered", "BOOLEAN DEFAULT TRUE NOT NULL"),
        ("is_sample", "BOOLEAN DEFAULT FALSE NOT NULL"),
    ],
    "vital_alerts": [
        ("doctor_review_notes", "VARCHAR(1000)"),
        ("follow_up_action", "VARCHAR(500)"),
        ("actioned_by_id", "VARCHAR(36)"),
        ("actioned_at", "TIMESTAMP"),
    ],
    "appointments": [
        ("booking_reference", "VARCHAR(50)"),
        ("cancellation_reason", "VARCHAR(500)"),
        ("rescheduled_from_id", "VARCHAR(36)"),
        ("department_id", "VARCHAR(36)"),
        ("department_name", "VARCHAR(150)"),
        ("consultation_fee", "FLOAT"),
        ("patient_phone", "VARCHAR(50)"),
        ("patient_email", "VARCHAR(255)"),
        ("patient_address", "VARCHAR(255)"),
        ("patient_dob", "VARCHAR(50)"),
        ("existing_conditions", "TEXT"),
        ("current_medications", "TEXT"),
        ("allergies", "TEXT"),
        ("referral_source", "VARCHAR(100) DEFAULT 'self_referral'"),
        ("referring_doctor_name", "VARCHAR(150)"),
        ("referring_doctor_phone", "VARCHAR(50)"),
        ("referring_doctor_email", "VARCHAR(255)"),
    ],
    "doctors": [
        ("email", "VARCHAR(255)"),
        ("qualifications", "VARCHAR(255) DEFAULT 'MD'"),
        ("experience_years", "INTEGER DEFAULT 10"),
        ("consultation_fee", "FLOAT DEFAULT 120.0"),
        ("languages", "VARCHAR(255) DEFAULT 'English'"),
        ("hospital_affiliation", "VARCHAR(255) DEFAULT 'MediCare Central Medical Center'"),
        ("avatar_url", "VARCHAR(500)"),
        ("rating", "FLOAT DEFAULT 4.9"),
        ("review_count", "INTEGER DEFAULT 24"),
        ("department_id", "VARCHAR(36)"),
        ("is_verified", "BOOLEAN DEFAULT TRUE"),
        ("license_verified_at", "TIMESTAMP"),
    ],
    "dept": [
        ("icon_nm", "VARCHAR(50) DEFAULT 'Stethoscope'"),
        ("email_addr", "VARCHAR(150)"),
        ("head_of_dept", "VARCHAR(150)"),
        ("dr_count", "INTEGER DEFAULT 1"),
    ],
    "medical_devices": [
        ("last_connected_at", "TIMESTAMP"),
        ("connection_protocol_details", "VARCHAR(255)"),
        ("device_secret_key", "VARCHAR(128)"),
    ],
    "device_telemetry_packets": [
        ("sequence_number", "INTEGER"),
        ("auth_signature", "VARCHAR(128)"),
        ("auth_verified", "BOOLEAN DEFAULT FALSE NOT NULL"),
        ("sensor_status", "VARCHAR(60) DEFAULT 'SENSOR_OK'"),
        ("source_type", "VARCHAR(40) DEFAULT 'HARDWARE' NOT NULL"),
    ],
    "medical_records": [
        ("provider", "VARCHAR(255)"),
        ("source", "VARCHAR(50) DEFAULT 'clinician_confirmed'"),
        ("is_patient_reported", "BOOLEAN DEFAULT FALSE"),
        ("notes", "TEXT"),
        ("supporting_document_url", "VARCHAR(500)"),
        ("lab_result_id", "VARCHAR(36)"),
        ("is_amended", "BOOLEAN DEFAULT FALSE"),
        ("amendment_reason", "TEXT"),
        ("original_value", "TEXT"),
        ("amended_by", "VARCHAR(36)"),
        ("amended_at", "TIMESTAMP"),
        ("is_archived", "BOOLEAN DEFAULT FALSE"),
        ("archived_at", "TIMESTAMP"),
        ("archived_reason", "TEXT"),
        ("archived_by", "VARCHAR(36)"),
        ("created_by", "VARCHAR(36)"),
        ("updated_by", "VARCHAR(36)"),
    ],
    "prescriptions": [
        ("prescribing_doctor_name", "VARCHAR(255)"),
        ("brand_name", "VARCHAR(255)"),
        ("generic_name", "VARCHAR(255)"),
        ("strength", "VARCHAR(100)"),
        ("dosage_form", "VARCHAR(100)"),
        ("prescription_date", "DATE"),
        ("pharmacy", "VARCHAR(255)"),
        ("refills_total", "INTEGER DEFAULT 0"),
        ("notes", "TEXT"),
        ("source", "VARCHAR(50) DEFAULT 'patient_manual'"),
        ("is_patient_reported", "BOOLEAN DEFAULT TRUE"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("verified_at", "TIMESTAMP"),
        ("discontinued_reason", "TEXT"),
        ("discontinued_at", "TIMESTAMP"),
        ("discontinued_by", "VARCHAR(36)"),
        ("upload_id", "VARCHAR(36)"),
        ("document_url", "VARCHAR(500)"),
        ("document_name", "VARCHAR(255)"),
        ("analysis_report_id", "VARCHAR(36)"),
        ("is_amended", "BOOLEAN DEFAULT FALSE"),
        ("amendment_reason", "TEXT"),
        ("original_value", "TEXT"),
        ("amended_by", "VARCHAR(36)"),
        ("amended_at", "TIMESTAMP"),
        ("is_archived", "BOOLEAN DEFAULT FALSE"),
        ("archived_at", "TIMESTAMP"),
        ("archived_reason", "TEXT"),
        ("archived_by", "VARCHAR(36)"),
        ("created_by", "VARCHAR(36)"),
        ("updated_by", "VARCHAR(36)"),
    ],
    "lab_results": [
        ("result_type", "VARCHAR(50) DEFAULT 'lab_result'"),
        ("measurement_time", "VARCHAR(30)"),
        ("measurement_type", "VARCHAR(100)"),
        ("fasting_status", "VARCHAR(50)"),
        ("device_name", "VARCHAR(255)"),
        ("repeat_value", "FLOAT"),
        ("repeat_time", "VARCHAR(30)"),
        ("repeat_notes", "TEXT"),
        ("is_repeat_measurement", "BOOLEAN DEFAULT FALSE"),
        ("duplicate_reviewed", "BOOLEAN DEFAULT FALSE"),
        ("educational_notice", "TEXT"),
    ],
}


def _get_existing_columns_sync(sync_conn, table_name: str) -> set:
    inspector = inspect(sync_conn)
    if not inspector.has_table(table_name):
        return set()
    return {c["name"] for c in inspector.get_columns(table_name)}


async def run_schema_migrations(engine) -> None:
    """Check and apply non-destructive schema additions."""
    try:
        from app.models.base import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with engine.connect() as check_conn:
            for table_name, columns in MIGRATION_COLUMNS.items():
                existing_cols = await check_conn.run_sync(_get_existing_columns_sync, table_name)
                if not existing_cols:
                    continue  # Table does not exist yet
                for col_name, col_def in columns:
                    if col_name not in existing_cols:
                        try:
                            async with engine.begin() as alter_conn:
                                await alter_conn.execute(
                                    text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}")
                                )
                            log.info("Added self-healing column", table=table_name, column=col_name)
                        except Exception as err:
                            log.warning("Column addition skipped or existing", table=table_name, column=col_name, error=str(err))
    except Exception as exc:
        log.warning("Self-healing schema migration notice", error=str(exc))
