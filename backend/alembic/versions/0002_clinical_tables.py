"""clinical tables: appointments, medical_records, prescriptions, vital_signs

Revision ID: 0002_clinical_tables
Revises: 0001_initial_tables
Create Date: 2026-09-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0002_clinical_tables'
down_revision: Union[str, None] = '0001_initial_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    appt_status = postgresql.ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', name='appointment_status', create_type=False)
    appt_status.create(op.get_bind(), checkfirst=True)

    appt_type = postgresql.ENUM('in_person', 'telehealth', 'follow_up', 'annual_checkup', 'urgent', name='appointment_type', create_type=False)
    appt_type.create(op.get_bind(), checkfirst=True)

    rec_cat = postgresql.ENUM('diagnosis', 'allergy', 'surgery', 'immunization', 'lab_result', 'document', name='record_category', create_type=False)
    rec_cat.create(op.get_bind(), checkfirst=True)

    rec_stat = postgresql.ENUM('active', 'resolved', 'inactive', 'chronic', name='record_status', create_type=False)
    rec_stat.create(op.get_bind(), checkfirst=True)

    rx_stat = postgresql.ENUM('active', 'completed', 'discontinued', 'pending_refill', name='prescription_status', create_type=False)
    rx_stat.create(op.get_bind(), checkfirst=True)

    # Table: appointments
    op.create_table(
        'appointments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('status', sa.Enum('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', name='appointment_status'), nullable=False, server_default='scheduled'),
        sa.Column('appointment_type', sa.Enum('in_person', 'telehealth', 'follow_up', 'annual_checkup', 'urgent', name='appointment_type'), nullable=False, server_default='in_person'),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('room', sa.String(length=50), nullable=True),
        sa.Column('telehealth_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_appointments_id'), 'appointments', ['id'], unique=False)
    op.create_index(op.f('ix_appointments_patient_id'), 'appointments', ['patient_id'], unique=False)
    op.create_index(op.f('ix_appointments_doctor_id'), 'appointments', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_appointments_scheduled_at'), 'appointments', ['scheduled_at'], unique=False)
    op.create_index(op.f('ix_appointments_status'), 'appointments', ['status'], unique=False)

    # Table: medical_records
    op.create_table(
        'medical_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category', sa.Enum('diagnosis', 'allergy', 'surgery', 'immunization', 'lab_result', 'document', name='record_category'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icd10_code', sa.String(length=20), nullable=True),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('active', 'resolved', 'inactive', 'chronic', name='record_status'), nullable=False, server_default='active'),
        sa.Column('severity', sa.String(length=50), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_medical_records_id'), 'medical_records', ['id'], unique=False)
    op.create_index(op.f('ix_medical_records_patient_id'), 'medical_records', ['patient_id'], unique=False)
    op.create_index(op.f('ix_medical_records_category'), 'medical_records', ['category'], unique=False)
    op.create_index(op.f('ix_medical_records_record_date'), 'medical_records', ['record_date'], unique=False)

    # Table: prescriptions
    op.create_table(
        'prescriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('medication_name', sa.String(length=255), nullable=False),
        sa.Column('dosage', sa.String(length=100), nullable=False),
        sa.Column('frequency', sa.String(length=100), nullable=False),
        sa.Column('route', sa.String(length=50), server_default='Oral'),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('refills_remaining', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('active', 'completed', 'discontinued', 'pending_refill', name='prescription_status'), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_prescriptions_id'), 'prescriptions', ['id'], unique=False)
    op.create_index(op.f('ix_prescriptions_patient_id'), 'prescriptions', ['patient_id'], unique=False)
    op.create_index(op.f('ix_prescriptions_status'), 'prescriptions', ['status'], unique=False)

    # Table: vital_signs
    op.create_table(
        'vital_signs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recorded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('heart_rate', sa.Integer(), nullable=True),
        sa.Column('systolic_bp', sa.Integer(), nullable=True),
        sa.Column('diastolic_bp', sa.Integer(), nullable=True),
        sa.Column('temperature', sa.Float(), nullable=True),
        sa.Column('oxygen_saturation', sa.Float(), nullable=True),
        sa.Column('respiratory_rate', sa.Integer(), nullable=True),
        sa.Column('blood_glucose', sa.Float(), nullable=True),
        sa.Column('weight', sa.Float(), nullable=True),
        sa.Column('height', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_vital_signs_id'), 'vital_signs', ['id'], unique=False)
    op.create_index(op.f('ix_vital_signs_patient_id'), 'vital_signs', ['patient_id'], unique=False)
    op.create_index(op.f('ix_vital_signs_recorded_at'), 'vital_signs', ['recorded_at'], unique=False)


def downgrade() -> None:
    op.drop_table('vital_signs')
    op.drop_table('prescriptions')
    op.drop_table('medical_records')
    op.drop_table('appointments')
    op.execute('DROP TYPE IF EXISTS prescription_status')
    op.execute('DROP TYPE IF EXISTS record_status')
    op.execute('DROP TYPE IF EXISTS record_category')
    op.execute('DROP TYPE IF EXISTS appointment_type')
    op.execute('DROP TYPE IF EXISTS appointment_status')
