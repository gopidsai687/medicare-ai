import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Shield, Stethoscope, User, AlertCircle, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { BrandLogo } from '@/components/brand/BrandLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const portals = [
  { role: 'patient', label: 'Patient', icon: User,        color: '#14b8a6', desc: 'Personal health portal' },
  { role: 'doctor',  label: 'Doctor',  icon: Stethoscope, color: '#38bdf8', desc: 'Physician & clinical EHR' },
  { role: 'admin',   label: 'Admin',   icon: Shield,       color: '#f59e0b', desc: 'System governance & staff' },
]

const DEMO_CREDENTIALS: Record<string, { email: string; password: string }> = {
  patient: { email: 'alice.johnson@medicare.ai', password: 'PatientPass123!' },
  doctor:  { email: 'sarah.chen@medicare.ai', password: 'DoctorPass123!' },
  admin:   { email: 'admin@medicare.ai', password: 'AdminPass123!' },
}

const roleMap: Record<string, string> = {
  patient: '/patient',
  doctor: '/doctor',
  admin: '/admin',
  nurse: '/doctor',
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      const verifiedRole = user.role?.toLowerCase() || localStorage.getItem('user_role')?.toLowerCase() || 'patient'
      const defaultPath = roleMap[verifiedRole] ?? '/patient'
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
    if (isSubmitting) return // Guard against duplicate submissions
    setError(null)
    setIsSubmitting(true)

    try {
      const authUser = await login(data.email.trim(), data.password)
      const verifiedRole = authUser?.role?.toLowerCase() || localStorage.getItem('user_role')?.toLowerCase() || 'patient'
      const defaultPath = roleMap[verifiedRole] ?? '/patient'
      const target = (from && from.startsWith(defaultPath)) ? from : defaultPath
      navigate(target, { replace: true })
    } catch (err: unknown) {
      // Extract human-friendly error message, prioritizing backend detail over generic error text
      let msg = 'Authentication failed. Please verify your credentials and try again.'
      if (err instanceof Error) {
        msg = err.message
      } else if (typeof err === 'object' && err !== null) {
        const responseDetail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        if (typeof responseDetail === 'string') {
          msg = responseDetail
        }
      }
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-animated min-h-screen flex items-center justify-center p-6 text-slate-100">
      {/* Background radial orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[15%] left-[10%] w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[20%] right-[15%] w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="w-full max-w-[460px] relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2 animate-fade-in-up">
          <div className="flex justify-center mb-3">
            <BrandLogo size={58} showText={false} />
          </div>
          <h1 className="font-outfit text-3xl font-extrabold flex items-center justify-center gap-2">
            <span className="text-white">MediCare</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-teal-500 text-slate-950 font-black tracking-wider uppercase">
              AI
            </span>
          </h1>
          <p className="text-slate-400 text-sm">
            Clinical Health Platform & Physiological Telemetry
          </p>
        </div>

        {/* Login form container */}
        <div className="glass p-8 rounded-2xl border border-slate-800/80 shadow-2xl space-y-6 animate-fade-in-up">
          {/* Portal selection */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Select Clinical Portal
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {portals.map(({ role, label, icon: Icon, color, desc }) => {
                const isSelected = selectedPortal === role
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSelectPortal(role)}
                    className={`p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 shadow-sm'
                        : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40'
                    }`}
                    style={{
                      borderColor: isSelected ? `${color}60` : undefined,
                    }}
                  >
                    <div className="flex justify-center mb-1.5">
                      <Icon size={18} style={{ color: isSelected ? color : '#64748b' }} />
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">{label}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">{desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                disabled={isSubmitting}
                placeholder="name@medicare.ai"
                className="input-field w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50"
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-rose-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 block">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  disabled={isSubmitting}
                  placeholder="••••••••••••"
                  className="input-field w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950/60 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-50"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-rose-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
                <AlertCircle size={15} className="shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, #0d9488, #0ea5e9)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign in to MediCare</span>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Authorized healthcare personnel and registered patients only.
          </p>
        </div>

        <p className="text-center text-xs text-slate-500">
          © 2026 MediCare AI — Secure Healthcare Management Platform
        </p>
      </div>
    </div>
  )
}
