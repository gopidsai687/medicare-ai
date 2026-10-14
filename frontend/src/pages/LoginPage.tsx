import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Shield, Stethoscope, User, AlertCircle, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { BrandLogo } from '@/components/brand/BrandLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const portals = [
  { role: 'patient', label: 'Patient', icon: User,        color: '#14b8a6', desc: 'View records & appointments' },
  { role: 'doctor',  label: 'Doctor',  icon: Stethoscope, color: '#3182f4', desc: 'Clinical tools & scheduling' },
  { role: 'admin',   label: 'Admin',   icon: Shield,       color: '#f59e0b', desc: 'System & staff management' },
]

const DEMO_CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin:   { email: 'admin@medicare.ai', password: 'AdminPass123!' },
  doctor:  { email: 'sarah.chen@medicare.ai', password: 'DoctorPass123!' },
  patient: { email: 'alice.johnson@medicare.ai', password: 'PatientPass123!' },
}

export default function LoginPage() {
  const { login, user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  const initialPortal = from?.includes('doctor') ? 'doctor' : from?.includes('admin') ? 'admin' : 'patient'
  const [showPw, setShowPw] = useState(false)
  const [selectedPortal, setSelectedPortal] = useState(initialPortal)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const roleMap: Record<string, string> = {
    patient: '/patient',
    doctor: '/doctor',
    admin: '/admin',
    nurse: '/doctor',
  }

  // Auto-redirect if user already has an active session
  useEffect(() => {
    if (!authLoading && user) {
      const defaultPath = roleMap[user.role.toLowerCase()] || '/patient'
      const target = (from && from.startsWith(defaultPath)) ? from : defaultPath
      navigate(target, { replace: true })
    }
  }, [user, authLoading, navigate, from])

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: DEMO_CREDENTIALS[initialPortal],
  })

  const handleSelectPortal = (role: string) => {
    setSelectedPortal(role)
    const creds = DEMO_CREDENTIALS[role]
    if (creds) {
      setValue('email', creds.email, { shouldValidate: true })
      setValue('password', creds.password, { shouldValidate: true })
    }
    setError(null)
  }

  const onSubmit = async (data: FormData) => {
    setError(null)
    setIsLoading(true)
    try {
      const authUser = await login(data.email, data.password)
      const verifiedRole = authUser?.role?.toLowerCase() || localStorage.getItem('user_role')?.toLowerCase() || 'patient'
      const defaultPath = roleMap[verifiedRole] ?? '/patient'
      const target = (from && from.startsWith(defaultPath)) ? from : defaultPath
      navigate(target, { replace: true })
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Login failed. Check your credentials.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-animated" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Background orbs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(49,130,244,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 350, height: 350,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', top: '50%', right: '5%', width: 250, height: 250,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.08) 0%, transparent 70%)', filter: 'blur(30px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="animate-fade-in-up text-center" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <BrandLogo size={58} showText={false} />
          </div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.1rem', fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="gradient-text">MediCare</span>
            <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)', color: '#071120', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI</span>
          </h1>
          <p style={{ color: '#5a7a9e', fontSize: '0.9rem', margin: 0 }}>
            Advanced Vital Monitoring & Healthcare Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass animate-fade-in-up" style={{ animationDelay: '80ms', padding: '32px' }}>
          {/* Portal selector */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3a5070', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Select Portal
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {portals.map(({ role, label, icon: Icon, color, desc }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSelectPortal(role)}
                  style={{
                    background: selectedPortal === role ? `${color}18` : 'rgba(15,32,64,0.5)',
                    border: `1px solid ${selectedPortal === role ? `${color}40` : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10, padding: '12px 8px', cursor: 'pointer',
                    transition: 'all 0.2s ease', textAlign: 'center',
                    outline: selectedPortal === role ? `2px solid ${color}30` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <Icon size={18} style={{ color: selectedPortal === role ? color : '#5a7a9e' }} />
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: selectedPortal === role ? color : '#8fa8c8', marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#3a5070' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8fa8c8', marginBottom: 6 }}>
                Email address
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@hospital.com"
                className="input-field"
                autoComplete="email"
              />
              {errors.email && (
                <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: 4 }}>{errors.email.message}</p>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8fa8c8', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field"
                  style={{ paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#3a5070', padding: 2,
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: 4 }}>{errors.password.message}</p>
              )}
            </div>

            {/* Error alert */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18,
                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <AlertCircle size={14} style={{ color: '#fb7185', flexShrink: 0 }} />
                <span style={{ color: '#fb7185', fontSize: '0.8rem' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.9rem', padding: '12px' }}
            >
              {isLoading ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Signing in…</>
              ) : (
                'Sign in to MediCare'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.75rem', color: '#3a5070' }}>
            Don't have an account?{' '}
            <span style={{ color: '#57a3f9', cursor: 'pointer', fontWeight: 600 }}>Contact your administrator</span>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.7rem', color: '#3a5070' }}>
          © 2026 MediCare — Healthcare Management Platform
        </p>
      </div>
    </div>
  )
}
