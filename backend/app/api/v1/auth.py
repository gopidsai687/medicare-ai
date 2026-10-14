"""
Auth endpoints: login, refresh, logout, /me.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    hash_password,
)
from app.core.dependencies import CurrentUser
from app.models.user import User, UserRole
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserRead

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
        role=user.role.value,
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")  # type: ignore[assignment]
    except JWTError:
        raise credentials_exception

    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception

    return AccessTokenResponse(access_token=create_access_token(str(user.id), user.role.value))


@router.get("/me", response_model=UserRead)
async def get_me(current_user: CurrentUser):
    return current_user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Public registration — creates a Patient account by default."""
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.PATIENT,  # public registration always creates patients
    )
    db.add(user)
    await db.flush()
    return user


@router.get("/demo-status")
async def get_demo_status(db: Annotated[AsyncSession, Depends(get_db)]):
    """Verify and ensure baseline clinical demo accounts are provisioned."""
    from app.core.seed import seed_initial_data
    await seed_initial_data(db)
    res_admin = await db.execute(select(User).where(User.email == "admin@medicare.ai"))
    res_doc = await db.execute(select(User).where(User.email == "sarah.chen@medicare.ai"))
    res_pat = await db.execute(select(User).where(User.email == "alice.johnson@medicare.ai"))
    return {
        "status": "ready",
        "accounts": {
            "admin": res_admin.scalar_one_or_none() is not None,
            "doctor": res_doc.scalar_one_or_none() is not None,
            "patient": res_pat.scalar_one_or_none() is not None,
        }
    }


# ── WebAuthn / Passkey Biometric Authentication ─────────────────────────────────
from fastapi import Request
from app.models.vital_sign import WebAuthnCredential
from app.schemas.auth import (
    PasskeyRegisterVerifyRequest,
    PasskeyLoginOptionsRequest,
    PasskeyLoginVerifyRequest,
    PasskeyCredentialRead,
)
from app.services.webauthn_service import (
    create_registration_options,
    verify_registration,
    create_authentication_options,
    verify_authentication,
)


@router.post("/passkeys/register-options")
async def passkey_register_options(
    request: Request,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generates server-side challenge and WebAuthn options for registering a biometric passkey."""
    return await create_registration_options(db, current_user, request)


@router.post("/passkeys/register-verify")
async def passkey_register_verify(
    body: PasskeyRegisterVerifyRequest,
    request: Request,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verifies client attestation and registers passkey public key to the authenticated account."""
    cred = await verify_registration(
        db=db,
        user=current_user,
        credential_payload=body.credential,
        challenge_id=body.challengeId,
        request=request,
        device_name=body.deviceName,
    )
    return {
        "status": "success",
        "message": "Biometric passkey registered successfully.",
        "credential_id": cred.credential_id,
        "device_name": cred.device_name,
    }


@router.get("/passkeys/credentials", response_model=list[PasskeyCredentialRead])
async def list_user_passkeys(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Lists registered biometric passkeys for the current user."""
    stmt = (
        select(WebAuthnCredential)
        .where(WebAuthnCredential.user_id == current_user.id)
        .order_by(WebAuthnCredential.created_at.desc())
    )
    res = await db.execute(stmt)
    creds = res.scalars().all()
    return [
        PasskeyCredentialRead(
            id=str(c.id),
            credential_id=c.credential_id,
            device_name=c.device_name,
            created_at=c.created_at.isoformat() if c.created_at else "",
            last_used_at=c.last_used_at.isoformat() if c.last_used_at else None,
        )
        for c in creds
    ]


@router.delete("/passkeys/credentials/{cred_id}")
async def delete_user_passkey(
    cred_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revokes a registered biometric passkey."""
    from uuid import UUID
    try:
        parsed_id = UUID(cred_id)
        stmt = select(WebAuthnCredential).where(
            WebAuthnCredential.id == parsed_id,
            WebAuthnCredential.user_id == current_user.id,
        )
    except ValueError:
        stmt = select(WebAuthnCredential).where(
            WebAuthnCredential.credential_id == cred_id,
            WebAuthnCredential.user_id == current_user.id,
        )
    res = await db.execute(stmt)
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey credential not found.")

    await db.delete(cred)
    await db.commit()
    return {"status": "success", "message": "Passkey revoked successfully."}


@router.post("/passkeys/login-options")
async def passkey_login_options(
    body: PasskeyLoginOptionsRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generates server-side challenge and options for passwordless passkey sign-in."""
    return await create_authentication_options(db, body.email, request)


@router.post("/passkeys/login-verify", response_model=TokenResponse)
async def passkey_login_verify(
    body: PasskeyLoginVerifyRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verifies biometric assertion and authenticates the user into their authorized portal role."""
    user, cred = await verify_authentication(
        db=db,
        credential_payload=body.credential,
        challenge_id=body.challengeId,
        request=request,
    )
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role.value),
        refresh_token=create_refresh_token(str(user.id)),
        role=user.role.value,
    )


