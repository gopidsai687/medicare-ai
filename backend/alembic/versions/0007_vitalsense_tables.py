"""vitalsense tables and columns

Revision ID: 0007_vitalsense_tables
Revises: 0006_medical_report_analysis
Create Date: 2026-10-13 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0007_vitalsense_tables'
down_revision: Union[str, None] = '0006_medical_report_analysis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    uuid_type = postgresql.UUID(as_uuid=True) if is_postgres else sa.String(32)

    # 1. Add new columns to vital_signs table
    with op.batch_alter_table('vital_signs', schema=None) as batch_op:
        try:
            batch_op.add_column(sa.Column('measurement_source', sa.String(length=50), nullable=False, server_default='manual_entry'))
            batch_op.add_column(sa.Column('device_name', sa.String(length=100), nullable=True))
            batch_op.add_column(sa.Column('blood_glucose_mmol', sa.Float(), nullable=True))
            batch_op.add_column(sa.Column('glucose_unit', sa.String(length=10), nullable=False, server_default='mg/dL'))
            batch_op.add_column(sa.Column('glucose_context', sa.String(length=50), nullable=True, server_default='fasting'))
            batch_op.add_column(sa.Column('notes', sa.String(length=500), nullable=True))
            batch_op.add_column(sa.Column('clinical_notes', sa.String(length=1000), nullable=True))
            batch_op.add_column(sa.Column('is_patient_entered', sa.Boolean(), nullable=False, server_default=sa.true()))
            batch_op.add_column(sa.Column('is_sample', sa.Boolean(), nullable=False, server_default=sa.false()))
        except Exception:
            pass

    # 2. Create vital_reminders table
    op.create_table(
        'vital_reminders',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('reminder_type', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=150), nullable=False),
        sa.Column('time_of_day', sa.String(length=20), nullable=False),
        sa.Column('frequency', sa.String(length=30), nullable=False, server_default='daily'),
        sa.Column('days_of_week', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    # 3. Create vital_sharing_consents table
    op.create_table(
        'vital_sharing_consents',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('doctor_id', uuid_type, sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('consented_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
    )

    # 4. Create webauthn_credentials table
    op.create_table(
        'webauthn_credentials',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('credential_id', sa.String(length=255), unique=True, nullable=False, index=True),
        sa.Column('public_key', sa.Text(), nullable=False),
        sa.Column('sign_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('device_name', sa.String(length=150), nullable=True),
        sa.Column('aaguid', sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('webauthn_credentials')
    op.drop_table('vital_sharing_consents')
    op.drop_table('vital_reminders')
