"""audit_logs table

Revision ID: 0004_audit_logs
Revises: 0003_encounters
Create Date: 2026-09-22 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0004_audit_logs'
down_revision: Union[str, None] = '0003_encounters'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    action_enum = postgresql.ENUM(
        'view_record', 'create_record', 'update_record', 'delete_record',
        'login_success', 'login_failure', 'logout', 'patient_merge',
        'export_health_data', 'role_change',
        name='audit_action',
        create_type=False
    )
    action_enum.create(op.get_bind(), checkfirst=True)

    sev_enum = postgresql.ENUM('info', 'warning', 'critical', name='audit_severity', create_type=False)
    sev_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.Enum('view_record', 'create_record', 'update_record', 'delete_record', 'login_success', 'login_failure', 'logout', 'patient_merge', 'export_health_data', 'role_change', name='audit_action'), nullable=False),
        sa.Column('severity', sa.Enum('info', 'warning', 'critical', name='audit_severity'), nullable=False, server_default='info'),
        sa.Column('resource_type', sa.String(length=100), nullable=False),
        sa.Column('resource_id', sa.String(length=100), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_severity'), 'audit_logs', ['severity'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.execute('DROP TYPE IF EXISTS audit_severity')
    op.execute('DROP TYPE IF EXISTS audit_action')
