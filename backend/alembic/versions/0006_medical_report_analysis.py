"""medical_report_analysis tables

Revision ID: 0006_medical_report_analysis
Revises: 0005_prescription_analysis
Create Date: 2026-10-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0006_medical_report_analysis'
down_revision: Union[str, None] = '0005_prescription_analysis'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    upload_status_enum = sa.Enum(
        'uploaded', 'extracted', 'confirmed', 'analyzed', 'failed',
        name='medical_report_upload_status'
    )
    review_status_enum = sa.Enum(
        'pending_review', 'reviewed_by_clinician', 'flagged_for_pharmacist',
        name='medical_report_review_status'
    )

    if is_postgres:
        upload_status_enum.create(bind, checkfirst=True)
        review_status_enum.create(bind, checkfirst=True)

    uuid_type = postgresql.UUID(as_uuid=True) if is_postgres else sa.String(32)

    # 1. medical_report_uploads
    op.create_table(
        'medical_report_uploads',
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
    op.create_index(op.f('ix_medical_report_uploads_id'), 'medical_report_uploads', ['id'], unique=False)
    op.create_index(op.f('ix_medical_report_uploads_patient_id'), 'medical_report_uploads', ['patient_id'], unique=False)
    op.create_index(op.f('ix_medical_report_uploads_status'), 'medical_report_uploads', ['status'], unique=False)

    # 2. medical_report_analysis_results
    op.create_table(
        'medical_report_analysis_results',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('upload_id', uuid_type, sa.ForeignKey('medical_report_uploads.id', ondelete='CASCADE'), nullable=True),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(length=150), nullable=False, server_default='General Medical Report'),
        sa.Column('patient_info', sa.JSON(), nullable=False),
        sa.Column('facility_info', sa.JSON(), nullable=False),
        sa.Column('report_date', sa.String(length=100), nullable=True),
        sa.Column('extracted_findings', sa.JSON(), nullable=False),
        sa.Column('terminology_explanations', sa.JSON(), nullable=False),
        sa.Column('abnormal_findings_explained', sa.JSON(), nullable=False),
        sa.Column('key_findings_summary', sa.Text(), nullable=False),
        sa.Column('what_report_establishes', sa.JSON(), nullable=False),
        sa.Column('what_report_does_not_establish', sa.JSON(), nullable=False),
        sa.Column('missing_information', sa.JSON(), nullable=False),
        sa.Column('questions_for_doctor', sa.JSON(), nullable=False),
        sa.Column('next_steps', sa.JSON(), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.95'),
        sa.Column('is_uncertain', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('uncertainty_reason', sa.String(length=255), nullable=True),
        sa.Column('review_status', review_status_enum, nullable=False, server_default='pending_review'),
        sa.Column('reviewed_by_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('ai_provider', sa.String(length=100), nullable=False, server_default='medicare-clinical-report-engine'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_medical_report_analysis_results_id'), 'medical_report_analysis_results', ['id'], unique=False)
    op.create_index(op.f('ix_medical_report_analysis_results_upload_id'), 'medical_report_analysis_results', ['upload_id'], unique=False)
    op.create_index(op.f('ix_medical_report_analysis_results_patient_id'), 'medical_report_analysis_results', ['patient_id'], unique=False)
    op.create_index(op.f('ix_medical_report_analysis_results_review_status'), 'medical_report_analysis_results', ['review_status'], unique=False)

    # 3. medical_report_chat_messages
    op.create_table(
        'medical_report_chat_messages',
        sa.Column('id', uuid_type, primary_key=True, nullable=False),
        sa.Column('report_analysis_id', uuid_type, sa.ForeignKey('medical_report_analysis_results.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_emergency', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index(op.f('ix_medical_report_chat_messages_id'), 'medical_report_chat_messages', ['id'], unique=False)
    op.create_index(op.f('ix_medical_report_chat_messages_report_analysis_id'), 'medical_report_chat_messages', ['report_analysis_id'], unique=False)
    op.create_index(op.f('ix_medical_report_chat_messages_patient_id'), 'medical_report_chat_messages', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_table('medical_report_chat_messages')
    op.drop_table('medical_report_analysis_results')
    op.drop_table('medical_report_uploads')
