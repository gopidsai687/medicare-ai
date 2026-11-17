"""connected devices and wearable health tables

Revision ID: 0009_connected_devices_and_wearable_health
Revises: 0008_vital_alerts_and_notifications
Create Date: 2026-11-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0009_connected_devices_and_wearable_health'
down_revision: Union[str, None] = '0008_vital_alerts_and_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    uuid_type = postgresql.UUID(as_uuid=True) if is_postgres else sa.String(32)

    # 1. Create connected_devices table
    op.create_table(
        'connected_devices',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('device_type', sa.String(length=60), nullable=False),
        sa.Column('device_name', sa.String(length=120), nullable=False),
        sa.Column('manufacturer', sa.String(length=100), server_default='Apple / Google / Samsung', nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=True),
        sa.Column('os_version', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='DISCONNECTED', nullable=False),
        sa.Column('is_connected', sa.Boolean(), server_default=sa.text('0' if not is_postgres else 'false'), nullable=False),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_frequency_minutes', sa.Integer(), server_default='15', nullable=False),
        sa.Column('pairing_identifier', sa.String(length=128), nullable=True),
        sa.Column('client_platform', sa.String(length=30), nullable=True),
        sa.Column('is_demo_integration', sa.Boolean(), server_default=sa.text('0' if not is_postgres else 'false'), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
    )
    op.create_index('ix_connected_devices_patient_id', 'connected_devices', ['patient_id'])
    op.create_index('ix_connected_devices_device_type', 'connected_devices', ['device_type'])
    op.create_index('ix_connected_devices_pairing_identifier', 'connected_devices', ['pairing_identifier'])

    # 2. Create health_measurements table
    op.create_table(
        'health_measurements',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('connected_device_id', uuid_type, sa.ForeignKey('connected_devices.id', ondelete='SET NULL'), nullable=True),
        sa.Column('measurement_type', sa.String(length=50), nullable=False),
        sa.Column('value_numeric', sa.Float(), nullable=False),
        sa.Column('secondary_value', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=20), nullable=False),
        sa.Column('measured_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source_device_type', sa.String(length=60), nullable=False),
        sa.Column('source_device_name', sa.String(length=120), nullable=False),
        sa.Column('provenance', sa.String(length=40), server_default='IMPORT_EXTERNAL', nullable=False),
        sa.Column('reading_hash', sa.String(length=64), nullable=False),
        sa.Column('is_sample', sa.Boolean(), server_default=sa.text('0' if not is_postgres else 'false'), nullable=False),
        sa.Column('is_demo', sa.Boolean(), server_default=sa.text('0' if not is_postgres else 'false'), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
    )
    op.create_index('ix_health_measurements_patient_id', 'health_measurements', ['patient_id'])
    op.create_index('ix_health_measurements_connected_device_id', 'health_measurements', ['connected_device_id'])
    op.create_index('ix_health_measurements_measurement_type', 'health_measurements', ['measurement_type'])
    op.create_index('ix_health_measurements_measured_at', 'health_measurements', ['measured_at'])
    op.create_index('ix_health_measurements_reading_hash', 'health_measurements', ['reading_hash'], unique=True)

    # 3. Create device_sync_history table
    op.create_table(
        'device_sync_history',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('connected_device_id', uuid_type, sa.ForeignKey('connected_devices.id', ondelete='SET NULL'), nullable=True),
        sa.Column('sync_source', sa.String(length=60), nullable=False),
        sa.Column('sync_status', sa.String(length=30), server_default='SUCCESS', nullable=False),
        sa.Column('records_received', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_synced', sa.Integer(), server_default='0', nullable=False),
        sa.Column('records_skipped_duplicate', sa.Integer(), server_default='0', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sync_started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('sync_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('client_info', sa.String(length=150), nullable=True),
    )
    op.create_index('ix_device_sync_history_patient_id', 'device_sync_history', ['patient_id'])
    op.create_index('ix_device_sync_history_connected_device_id', 'device_sync_history', ['connected_device_id'])
    op.create_index('ix_device_sync_history_sync_source', 'device_sync_history', ['sync_source'])

    # 4. Create health_permissions table
    op.create_table(
        'health_permissions',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('connected_device_id', uuid_type, sa.ForeignKey('connected_devices.id', ondelete='CASCADE'), nullable=True),
        sa.Column('integration_type', sa.String(length=60), nullable=False),
        sa.Column('permission_category', sa.String(length=50), nullable=False),
        sa.Column('is_granted', sa.Boolean(), server_default=sa.text('1' if not is_postgres else 'true'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('patient_id', 'integration_type', 'permission_category', name='uq_patient_integration_permission'),
    )
    op.create_index('ix_health_permissions_patient_id', 'health_permissions', ['patient_id'])
    op.create_index('ix_health_permissions_connected_device_id', 'health_permissions', ['connected_device_id'])

    # 5. Create health_notifications table
    op.create_table(
        'health_notifications',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('patient_id', uuid_type, sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('notification_type', sa.String(length=50), server_default='SYNC_COMPLETED', nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='INFO', nullable=False),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('0' if not is_postgres else 'false'), nullable=False),
        sa.Column('action_url', sa.String(length=255), nullable=True),
    )
    op.create_index('ix_health_notifications_patient_id', 'health_notifications', ['patient_id'])


def downgrade() -> None:
    op.drop_table('health_notifications')
    op.drop_table('health_permissions')
    op.drop_table('device_sync_history')
    op.drop_table('health_measurements')
    op.drop_table('connected_devices')
