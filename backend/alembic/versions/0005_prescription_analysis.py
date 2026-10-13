"""prescription_analysis tables

Revision ID: 0005_prescription_analysis
Revises: 0004_audit_logs
Create Date: 2026-10-11 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0005_prescription_analysis'
down_revision: Union[str, None] = '0004_audit_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Handle PostgreSQL enums if in postgres
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    upload_status_enum = sa.Enum(
        'uploaded', 'extracted', 'confirmed', 'analyzed', 'failed',
        name='prescription_upload_status'
    )
    review_status_enum = sa.Enum(
        'pending_review', 'reviewed_by_clinician', 'flagged_for_pharmacist',
        name='prescription_review_status'
    )

    if is_postgres:
        upload_status_enum.create(bind, checkfirst=True)
        review_status_enum.create(bind, checkfirst=True)

    uuid_type = postgresql.UUID(as_uuid=True) if is_postgres else sa.String(32)

    # 1. prescription_uploads
    op.create_table(
        'prescription_uploads',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('ocr_raw_text', sa.Text(), nullable=True),
        sa.Column('status', upload_status_enum, nullable=False, server_default='uploaded'),
        sa.Column('is_manual_entry', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_prescription_uploads_id'), 'prescription_uploads', ['id'], unique=False)
    op.create_index(op.f('ix_prescription_uploads_patient_id'), 'prescription_uploads', ['patient_id'], unique=False)
    op.create_index(op.f('ix_prescription_uploads_status'), 'prescription_uploads', ['status'], unique=False)

    # 2. prescription_extracted_items
    op.create_table(
        'prescription_extracted_items',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('upload_id', uuid_type, sa.ForeignKey('prescription_uploads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('medication_name', sa.String(length=255), nullable=False),
        sa.Column('strength', sa.String(length=100), nullable=True),
        sa.Column('dosage', sa.String(length=100), nullable=True),
        sa.Column('route', sa.String(length=50), server_default='Oral', nullable=True),
        sa.Column('frequency', sa.String(length=100), nullable=True),
        sa.Column('duration', sa.String(length=100), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('is_uncertain', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('uncertainty_reason', sa.String(length=255), nullable=True),
        sa.Column('patient_verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('patient_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_prescription_extracted_items_id'), 'prescription_extracted_items', ['id'], unique=False)
    op.create_index(op.f('ix_prescription_extracted_items_upload_id'), 'prescription_extracted_items', ['upload_id'], unique=False)
    op.create_index(op.f('ix_prescription_extracted_items_medication_name'), 'prescription_extracted_items', ['medication_name'], unique=False)

    # 3. prescription_analysis_reports
    op.create_table(
        'prescription_analysis_reports',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('upload_id', uuid_type, sa.ForeignKey('prescription_uploads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('summary_data', sa.JSON(), nullable=False),
        sa.Column('medication_guidance', sa.JSON(), nullable=False),
        sa.Column('next_steps', sa.JSON(), nullable=False),
        sa.Column('safety_review', sa.JSON(), nullable=False),
        sa.Column('review_status', review_status_enum, nullable=False, server_default='pending_review'),
        sa.Column('reviewed_by_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('ai_provider', sa.String(length=100), nullable=False, server_default='medicare-clinical-ai'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_prescription_analysis_reports_id'), 'prescription_analysis_reports', ['id'], unique=False)
    op.create_index(op.f('ix_prescription_analysis_reports_patient_id'), 'prescription_analysis_reports', ['patient_id'], unique=False)
    op.create_index(op.f('ix_prescription_analysis_reports_review_status'), 'prescription_analysis_reports', ['review_status'], unique=False)

    # 4. medication_reminders
    op.create_table(
        'medication_reminders',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('report_id', uuid_type, sa.ForeignKey('prescription_analysis_reports.id', ondelete='SET NULL'), nullable=True),
        sa.Column('medication_name', sa.String(length=255), nullable=False),
        sa.Column('dosage', sa.String(length=100), nullable=False),
        sa.Column('time_of_day', sa.String(length=50), nullable=False),
        sa.Column('frequency', sa.String(length=100), nullable=False),
        sa.Column('instructions', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('last_taken_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_medication_reminders_id'), 'medication_reminders', ['id'], unique=False)
    op.create_index(op.f('ix_medication_reminders_patient_id'), 'medication_reminders', ['patient_id'], unique=False)

    # 5. prescription_chat_messages
    op.create_table(
        'prescription_chat_messages',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('report_id', uuid_type, sa.ForeignKey('prescription_analysis_reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_emergency', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_prescription_chat_messages_id'), 'prescription_chat_messages', ['id'], unique=False)
    op.create_index(op.f('ix_prescription_chat_messages_report_id'), 'prescription_chat_messages', ['report_id'], unique=False)


def downgrade() -> None:
    op.drop_table('prescription_chat_messages')
    op.drop_table('medication_reminders')
    op.drop_table('prescription_analysis_reports')
    op.drop_table('prescription_extracted_items')
    op.drop_table('prescription_uploads')
