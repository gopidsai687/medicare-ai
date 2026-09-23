"""encounters table with SOAP documentation

Revision ID: 0003_encounters
Revises: 0002_clinical_tables
Create Date: 2026-09-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0003_encounters'
down_revision: Union[str, None] = '0002_clinical_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    enc_type = postgresql.ENUM('outpatient', 'inpatient', 'emergency', 'telehealth', 'follow_up', name='encounter_type', create_type=False)
    enc_type.create(op.get_bind(), checkfirst=True)

    enc_stat = postgresql.ENUM('in_progress', 'signed', 'addended', name='encounter_status', create_type=False)
    enc_stat.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'encounters',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('appointment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('appointments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('encounter_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('encounter_type', sa.Enum('outpatient', 'inpatient', 'emergency', 'telehealth', 'follow_up', name='encounter_type'), nullable=False, server_default='outpatient'),
        sa.Column('status', sa.Enum('in_progress', 'signed', 'addended', name='encounter_status'), nullable=False, server_default='in_progress'),
        sa.Column('chief_complaint', sa.String(length=500), nullable=False),
        sa.Column('subjective', sa.Text(), nullable=True),
        sa.Column('objective', sa.Text(), nullable=True),
        sa.Column('assessment', sa.Text(), nullable=True),
        sa.Column('plan', sa.Text(), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_encounters_id'), 'encounters', ['id'], unique=False)
    op.create_index(op.f('ix_encounters_patient_id'), 'encounters', ['patient_id'], unique=False)
    op.create_index(op.f('ix_encounters_doctor_id'), 'encounters', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_encounters_encounter_date'), 'encounters', ['encounter_date'], unique=False)
    op.create_index(op.f('ix_encounters_status'), 'encounters', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('encounters')
    op.execute('DROP TYPE IF EXISTS encounter_status')
    op.execute('DROP TYPE IF EXISTS encounter_type')
