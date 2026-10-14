import { useState, useEffect } from 'react'
import {
  Fingerprint,
  Key,
  ShieldCheck,
  Smartphone,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Laptop,
} from 'lucide-react'
import {
  isPasskeySupported,
  registerPasskey,
  listUserPasskeys,
  deleteUserPasskey,
  PasskeyCredential,
} from '@/lib/passkey'

export function PasskeySettingsCard() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    async function checkSupportAndLoad() {
      try {
        const isSupp = await isPasskeySupported()
        setSupported(isSupp)
        if (isSupp) {
          const list = await listUserPasskeys()
          setCredentials(list)
        }
      } catch (err) {
        console.error('Failed to load passkey credentials:', err)
      } finally {
        setLoading(false)
      }
    }
    checkSupportAndLoad()
  }, [])

  const handleStartRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setRegistering(true)

    try {
      const res = await registerPasskey(deviceName.trim() || undefined)
      setSuccessMsg(`Passkey "${res.device_name}" registered successfully! You can now sign in using your fingerprint or device authenticator.`)
      setShowModal(false)
      setDeviceName('')
      const updated = await listUserPasskeys()
      setCredentials(updated)
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to register passkey.'
      if (msg.includes('cancelled') || msg.includes('AbortError') || msg.includes('not allowed')) {
        setError('Passkey registration was cancelled or timed out. Please try again.')
      } else {
        setError(msg)
      }
    } finally {
      setRegistering(false)
    }
  }

  const handleDelete = async (credId: string, name: string | null) => {
    if (!confirm(`Are you sure you want to revoke the passkey "${name || 'this authenticator'}"? You will no longer be able to sign in using this device key.`)) {
      return
    }

    try {
      await deleteUserPasskey(credId)
      setCredentials((prev) => prev.filter((c) => c.id !== credId && c.credential_id !== credId))
      setSuccessMsg('Passkey credential revoked successfully.')
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to revoke passkey credential.')
    }
  }

  return (
    <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Fingerprint size={18} className="text-sky-400" />
            Passkey & Biometric Credentials (FIDO2 / WebAuthn)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sign in securely using Windows Hello, Touch ID, Face ID, Android biometrics, or hardware security keys.
          </p>
        </div>

        {supported && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setSuccessMsg(null)
              setShowModal(true)
            }}
            className="btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 self-start sm:self-auto"
          >
            <Plus size={14} />
            Set Up Passkey / Fingerprint Login
          </button>
        )}
      </div>

      {/* Support Status Banner */}
      {supported === false && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">Device Authenticator Not Detected</p>
            <p className="mt-0.5 text-slate-300">
              Your current browser or hardware environment does not support WebAuthn biometric authenticators. Password-based authentication remains active as your primary login method.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
          <AlertCircle size={15} className="shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Privacy Guarantee Notice */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400 flex items-start gap-2.5">
        <ShieldCheck size={15} className="shrink-0 text-teal-400 mt-0.5" />
        <p>
          <strong className="text-slate-300">Biometric Privacy Guarantee:</strong> MediCare stores only public cryptographic keys. Your fingerprint, face scan, or device PIN never leaves your device's Secure Enclave or TPM chip.
        </p>
      </div>

      {/* Registered Passkeys List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Active Authenticator Credentials ({credentials.length})
        </h3>

        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <Loader2 size={16} className="animate-spin mx-auto mb-2 text-sky-400" />
            Loading registered credentials…
          </div>
        ) : credentials.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-slate-400">
            No passkeys registered on this account yet. Click "Set Up Passkey / Fingerprint Login" to add your device.
          </div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            {credentials.map((c) => (
              <div key={c.id} className="p-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Laptop size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {c.device_name || 'Biometric Authenticator'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Registered: {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Active'}
                      {c.last_used_at && ` • Last used: ${new Date(c.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.device_name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Revoke passkey"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 rounded-2xl border border-sky-500/30 space-y-4 animate-fade-in shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold">
                <Fingerprint size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Set Up Passkey Login</h3>
                <p className="text-xs text-slate-400">Use your device biometrics to sign in seamlessly</p>
              </div>
            </div>

            <form onSubmit={handleStartRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Device Nickname (Optional)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. MacBook Touch ID, Windows Hello, iPhone"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  autoFocus
                />
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200">
                When you click "Register Passkey", your operating system will prompt you for your fingerprint, face scan, or device PIN.
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={registering}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5"
                >
                  {registering ? (
                    <><Loader2 size={14} className="animate-spin" /> Waiting for device…</>
                  ) : (
                    <><Key size={14} /> Register Passkey</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
