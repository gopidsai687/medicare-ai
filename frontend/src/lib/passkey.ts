import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import api from './api'

export interface PasskeyCredential {
  id: string
  credential_id: string
  device_name: string | null
  created_at: string
  last_used_at: string | null
}

export interface PasskeyLoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  role: string
}

/**
 * Checks whether the client browser and hardware platform support WebAuthn and passkeys.
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false
  }
  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      return available
    }
    return true
  } catch {
    return false
  }
}

/**
 * Registers a new passkey (Windows Hello, Touch ID, Face ID, Android Biometric, or FIDO2 key)
 * for the currently authenticated user.
 */
export async function registerPasskey(deviceName?: string): Promise<{ status: string; message: string; device_name: string }> {
  // 1. Fetch challenge & options from server
  const { data: options } = await api.post('/api/v1/auth/passkeys/register-options')
  const challengeId = options.challengeId

  // 2. Invoke native platform authenticator via WebAuthn API
  const credential = await startRegistration({ optionsJSON: options })

  // 3. Send signed attestation to server for cryptographic verification and storage
  const { data: result } = await api.post('/api/v1/auth/passkeys/register-verify', {
    challengeId,
    credential,
    deviceName: deviceName || 'Biometric Passkey',
  })

  return result
}

/**
 * Signs in using a registered passkey (fingerprint, Windows Hello, Touch ID, or security key).
 * Returns JWT tokens bound to the verified user role.
 */
export async function loginWithPasskey(email?: string): Promise<PasskeyLoginResponse> {
  // 1. Fetch challenge & options from server
  const { data: options } = await api.post('/api/v1/auth/passkeys/login-options', {
    email: email ? email.trim().toLowerCase() : undefined,
  })
  const challengeId = options.challengeId

  // 2. Invoke native biometric prompt
  const credential = await startAuthentication({ optionsJSON: options })

  // 3. Verify assertion on server
  const { data: tokenData } = await api.post<PasskeyLoginResponse>('/api/v1/auth/passkeys/login-verify', {
    challengeId,
    credential,
  })

  return tokenData
}

/**
 * Lists all registered passkeys for the current user.
 */
export async function listUserPasskeys(): Promise<PasskeyCredential[]> {
  const { data } = await api.get<PasskeyCredential[]>('/api/v1/auth/passkeys/credentials')
  return data
}

/**
 * Revokes a registered passkey.
 */
export async function deleteUserPasskey(credId: string): Promise<void> {
  await api.delete(`/api/v1/auth/passkeys/credentials/${credId}`)
}
