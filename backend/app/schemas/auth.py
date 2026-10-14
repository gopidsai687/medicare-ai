"""
Auth schemas: login, tokens, refresh.
"""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasskeyRegisterVerifyRequest(BaseModel):
    challengeId: str
    credential: dict
    deviceName: str | None = None


class PasskeyLoginOptionsRequest(BaseModel):
    email: EmailStr | None = None


class PasskeyLoginVerifyRequest(BaseModel):
    challengeId: str
    credential: dict


class PasskeyCredentialRead(BaseModel):
    id: str
    credential_id: str
    device_name: str | None
    created_at: str
    last_used_at: str | None

