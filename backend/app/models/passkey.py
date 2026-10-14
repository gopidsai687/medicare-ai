"""
Passkey (WebAuthn / FIDO2) credential and challenge models.
Exports WebAuthn models from vital_sign.
"""
from app.models.vital_sign import WebAuthnCredential, WebauthnChallenge

PasskeyCredential = WebAuthnCredential
PasskeyChallenge = WebauthnChallenge

__all__ = [
    "WebAuthnCredential",
    "WebauthnChallenge",
    "PasskeyCredential",
    "PasskeyChallenge",
]
