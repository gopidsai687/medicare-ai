"""
MediCare WebAuthn & Passkey Authentication Service
Implements FIDO2/WebAuthn Level 3 standard using the python 'webauthn' library.
Supports Windows Hello, Apple Touch ID / Face ID, Android Biometrics, and hardware security keys.
Never stores biometrics or fingerprint data — only public keys and cryptographic challenges.
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import structlog
from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import (
    base64url_to_bytes,
    bytes_to_base64url,
    options_to_json,
)
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticationCredential,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.models.user import User
from app.models.vital_sign import WebAuthnCredential, WebauthnChallenge

log = structlog.get_logger(__name__)

RP_NAME = "MediCare AI"
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "https://medicare-ai-iv31.onrender.com",
]


def get_rp_id(request: Request) -> str:
    """Extracts relying party ID (hostname) from the incoming request."""
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.hostname or "localhost"
    # Remove port if present
    if ":" in host:
        host = host.split(":")[0]
    return host


def get_allowed_origins(request: Request) -> List[str]:
    """Returns the set of permitted origins including request origin if valid."""
    origins = list(DEFAULT_ALLOWED_ORIGINS)
    req_origin = request.headers.get("origin")
    if req_origin and req_origin not in origins:
        origins.append(req_origin)
    return origins


async def create_registration_options(
    db: AsyncSession,
    user: User,
    request: Request,
) -> dict:
    """
    Generates WebAuthn registration options for an authenticated user.
    Stores the challenge in webauthn_challenges table.
    """
    rp_id = get_rp_id(request)

    # Exclude credentials already registered for this user
    existing_stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    res = await db.execute(existing_stmt)
    existing_creds = res.scalars().all()

    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(cred.credential_id))
        for cred in existing_creds
    ]

    # Generate options
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=RP_NAME,
        user_id=user.id.bytes,
        user_name=user.email,
        user_display_name=user.full_name or user.email,
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=exclude_credentials,
    )

    # Save challenge to DB
    challenge_id = secrets.token_urlsafe(32)
    challenge_record = WebauthnChallenge(
        id=challenge_id,
        user_id=user.id,
        challenge=bytes_to_base64url(options.challenge),
        purpose="registration",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(challenge_record)
    await db.commit()

    options_dict = json.loads(options_to_json(options))
    options_dict["challengeId"] = challenge_id
    return options_dict


async def verify_registration(
    db: AsyncSession,
    user: User,
    credential_payload: dict,
    challenge_id: str,
    request: Request,
    device_name: Optional[str] = None,
) -> WebAuthnCredential:
    """
    Verifies a WebAuthn registration response and registers the passkey public key.
    """
    rp_id = get_rp_id(request)
    allowed_origins = get_allowed_origins(request)

    # Retrieve challenge
    challenge_stmt = select(WebauthnChallenge).where(
        WebauthnChallenge.id == challenge_id,
        WebauthnChallenge.purpose == "registration",
        WebauthnChallenge.user_id == user.id,
    )
    res = await db.execute(challenge_stmt)
    challenge_record = res.scalar_one_or_none()

    if not challenge_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration session expired or invalid challenge. Please try again.",
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    exp = challenge_record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        await db.delete(challenge_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passkey registration timed out (5-minute limit exceeded).",
        )

    expected_challenge_bytes = base64url_to_bytes(challenge_record.challenge)

    # Delete challenge immediately (single-use)
    await db.delete(challenge_record)

    try:
        reg_credential = RegistrationCredential.parse_raw(json.dumps(credential_payload))
        verified = verify_registration_response(
            credential=reg_credential,
            expected_challenge=expected_challenge_bytes,
            expected_rp_id=rp_id,
            expected_origin=allowed_origins,
            require_user_verification=False,
        )
    except Exception as e:
        await db.commit()
        log.warning("WebAuthn registration verification failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Biometric passkey registration verification failed: {str(e)}",
        )

    cred_id_str = bytes_to_base64url(verified.credential_id)
    public_key_str = bytes_to_base64url(verified.credential_public_key)

    # Check if this credential ID is already registered
    existing_stmt = select(WebAuthnCredential).where(WebAuthnCredential.credential_id == cred_id_str)
    res = await db.execute(existing_stmt)
    if res.scalar_one_or_none():
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This biometric authenticator is already registered to an account.",
        )

    transports_json = None
    if credential_payload.get("response", {}).get("transports"):
        transports_json = json.dumps(credential_payload["response"]["transports"])

    new_credential = WebAuthnCredential(
        user_id=user.id,
        credential_id=cred_id_str,
        public_key=public_key_str,
        sign_count=verified.sign_count,
        device_name=device_name or "Passkey / Biometric Authenticator",
        aaguid=str(verified.aaguid) if verified.aaguid else None,
        transports=transports_json,
        last_used_at=datetime.now(timezone.utc),
    )
    db.add(new_credential)
    await db.commit()
    await db.refresh(new_credential)

    log.info("Passkey credential registered successfully", user_id=str(user.id), device=new_credential.device_name)
    return new_credential


async def create_authentication_options(
    db: AsyncSession,
    email: Optional[str],
    request: Request,
) -> dict:
    """
    Generates WebAuthn authentication options.
    If email is provided, populates allow_credentials with user's registered keys.
    """
    rp_id = get_rp_id(request)
    allow_credentials: Optional[List[PublicKeyCredentialDescriptor]] = None
    target_user_id: Optional[uuid.UUID] = None

    if email:
        user_stmt = select(User).where(User.email == email.strip().lower())
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        if user:
            target_user_id = user.id
            creds_stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
            creds_res = await db.execute(creds_stmt)
            user_creds = creds_res.scalars().all()
            if user_creds:
                allow_credentials = [
                    PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
                    for c in user_creds
                ]

    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    challenge_id = secrets.token_urlsafe(32)
    challenge_record = WebauthnChallenge(
        id=challenge_id,
        user_id=target_user_id,
        challenge=bytes_to_base64url(options.challenge),
        purpose="authentication",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(challenge_record)
    await db.commit()

    options_dict = json.loads(options_to_json(options))
    options_dict["challengeId"] = challenge_id
    return options_dict


async def verify_authentication(
    db: AsyncSession,
    credential_payload: dict,
    challenge_id: str,
    request: Request,
) -> Tuple[User, WebAuthnCredential]:
    """
    Verifies WebAuthn authentication response against registered credential.
    Updates signature count to prevent replay/clone attacks.
    Returns (User, WebAuthnCredential).
    """
    rp_id = get_rp_id(request)
    allowed_origins = get_allowed_origins(request)

    # Retrieve challenge
    challenge_stmt = select(WebauthnChallenge).where(
        WebauthnChallenge.id == challenge_id,
        WebauthnChallenge.purpose == "authentication",
    )
    res = await db.execute(challenge_stmt)
    challenge_record = res.scalar_one_or_none()

    if not challenge_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication session expired or invalid challenge. Please try again.",
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    exp = challenge_record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        await db.delete(challenge_record)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passkey authentication timed out (5-minute limit exceeded).",
        )

    expected_challenge_bytes = base64url_to_bytes(challenge_record.challenge)

    # Delete challenge immediately (single-use)
    await db.delete(challenge_record)

    # Look up registered credential by ID
    cred_raw_id = credential_payload.get("id")
    if not cred_raw_id:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed WebAuthn response: missing credential ID.",
        )

    cred_stmt = select(WebAuthnCredential).where(WebAuthnCredential.credential_id == cred_raw_id)
    res = await db.execute(cred_stmt)
    registered_cred = res.scalar_one_or_none()

    if not registered_cred:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unrecognized passkey credential. Please register this device first or sign in with password.",
        )

    # Fetch corresponding User
    user_stmt = select(User).where(User.id == registered_cred.user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user or not user.is_active:
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account associated with this passkey is disabled or unavailable.",
        )

    # Verify signature
    public_key_bytes = base64url_to_bytes(registered_cred.public_key)

    try:
        auth_credential = AuthenticationCredential.parse_raw(json.dumps(credential_payload))
        verified = verify_authentication_response(
            credential=auth_credential,
            expected_challenge=expected_challenge_bytes,
            expected_rp_id=rp_id,
            expected_origin=allowed_origins,
            credential_public_key=public_key_bytes,
            credential_current_sign_count=registered_cred.sign_count,
            require_user_verification=False,
        )
    except Exception as e:
        await db.commit()
        log.warning("WebAuthn authentication verification failed", user_id=str(user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Biometric passkey authentication failed: {str(e)}",
        )

    # Update sign counter and last used
    registered_cred.sign_count = verified.new_sign_count
    registered_cred.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    log.info("Passkey login verified successfully", user_id=str(user.id), email=user.email, role=user.role.value)
    return user, registered_cred
