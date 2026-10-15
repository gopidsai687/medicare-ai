"""
Self-healing schema migration utility.
Safely checks and adds missing columns and tables to SQLite and PostgreSQL databases
without dropping data or breaking existing records.
"""
import structlog
from sqlalchemy import text, inspect

log = structlog.get_logger(__name__)

MIGRATION_COLUMNS = {
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
