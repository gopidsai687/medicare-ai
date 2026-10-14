"""vital alerts and notification preferences tables

Revision ID: 0008_vital_alerts_and_notifications
Revises: 0007_vitalsense_tables
Create Date: 2026-10-13 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0008_vital_alerts_and_notifications'
down_revision: Union[str, None] = '0007_vitalsense_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    uuid_type = postgresql.UUID(as_uuid=True) if is_postgres else sa.String(32)

    # 1. Create vital_alerts table
    op.create_table(
        'vital_alerts',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vital_id', uuid_type, sa.ForeignKey('vital_signs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('alert_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='attention', nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('clinical_guidance', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_by_id', uuid_type, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('clinical_notes', sa.Text(), nullable=True),
    )
    op.create_index('ix_vital_alerts_patient_id', 'vital_alerts', ['patient_id'])
    op.create_index('ix_vital_alerts_status', 'vital_alerts', ['status'])
    op.create_index('ix_vital_alerts_severity', 'vital_alerts', ['severity'])
    op.create_index('ix_vital_alerts_alert_type', 'vital_alerts', ['alert_type'])

    # 2. Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('push_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('quiet_hours_enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('quiet_hours_start', sa.String(length=10), server_default='22:00', nullable=False),
        sa.Column('quiet_hours_end', sa.String(length=10), server_default='07:00', nullable=False),
        sa.Column('urgent_override_quiet_hours', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('bp_alerts_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('glucose_alerts_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('reminder_alerts_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('device_token', sa.Text(), nullable=True),
    )
    op.create_index('ix_notification_preferences_user_id', 'notification_preferences', ['user_id'])


def downgrade() -> None:
    op.drop_table('notification_preferences')
    op.drop_table('vital_alerts')
