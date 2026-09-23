import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.audit_log import AuditAction, AuditSeverity


class AuditLogBase(BaseModel):
    action: AuditAction
    severity: AuditSeverity = AuditSeverity.INFO
    resource_type: str
    resource_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    details: dict | None = None


class AuditLogCreate(AuditLogBase):
    user_id: uuid.UUID | None = None


class AuditLogRead(AuditLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    created_at: datetime
