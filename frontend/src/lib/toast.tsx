import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const VARIANTS = {
  success: {
    icon: CheckCircle,
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(52,211,153,0.25)',
    iconColor: '#34d399',
    titleColor: '#fff',
    bar: '#10b981',
  },
  error: {
    icon: XCircle,
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(251,113,133,0.25)',
    iconColor: '#fb7185',
    titleColor: '#fff',
    bar: '#f43f5e',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(251,191,36,0.25)',
    iconColor: '#fbbf24',
    titleColor: '#fff',
    bar: '#f59e0b',
  },
  info: {
    icon: Info,
    bg: 'rgba(49,130,244,0.12)',
    border: 'rgba(87,163,249,0.25)',
    iconColor: '#57a3f9',
    titleColor: '#fff',
    bar: '#3182f4',
  },
}

const DURATION = 4500

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const v = VARIANTS[toast.variant]
  const Icon = v.icon
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))

    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, DURATION)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, onDismiss])

  return (
    <div
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: 14,
        padding: '12px 14px 12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 280,
        maxWidth: 380,
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
        willChange: 'transform, opacity',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: '100%',
          background: `${v.bar}30`,
        }}
      >
        <div
          style={{
            height: '100%',
            background: v.bar,
            animation: `toast-progress ${DURATION}ms linear forwards`,
          }}
        />
      </div>

      <div style={{ color: v.iconColor, flexShrink: 0, marginTop: 1 }}>
        <Icon size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.83rem', color: v.titleColor, lineHeight: 1.3 }}>
          {toast.title}
        </p>
        {toast.description && (
          <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#8fa8c8', lineHeight: 1.4 }}>
            {toast.description}
          </p>
        )}
      </div>

      <button
        onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300) }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#3a5070',
          padding: 2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          marginTop: 1,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#8fa8c8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#3a5070')}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }])
  }, [])

  const success = useCallback((title: string, description?: string) =>
    toast({ title, description, variant: 'success' }), [toast])
  const error = useCallback((title: string, description?: string) =>
    toast({ title, description, variant: 'error' }), [toast])
  const warning = useCallback((title: string, description?: string) =>
    toast({ title, description, variant: 'warning' }), [toast])
  const info = useCallback((title: string, description?: string) =>
    toast({ title, description, variant: 'info' }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <style>{`
          @keyframes toast-progress {
            from { width: 100%; }
            to   { width: 0%; }
          }
        `}</style>
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
