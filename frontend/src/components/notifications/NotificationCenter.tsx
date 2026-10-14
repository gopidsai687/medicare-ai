import React, { useState, useEffect } from 'react'
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Settings,
  ShieldCheck,
  Send,
  X,
  Volume2,
  VolumeX,
  Moon,
  Info,
  Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

interface VitalAlert {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'urgent' | 'crisis'
  title: string
  message: string
  clinical_recommendation?: string | null
  triggered_value?: string | null
  status: 'active' | 'acknowledged' | 'resolved'
  created_at: string
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  onAlertCountChange?: (count: number) => void
}

export function NotificationCenter({ isOpen, onClose, onAlertCountChange }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<'alerts' | 'preferences'>('alerts')
  const [alerts, setAlerts] = useState<VitalAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied'>('default')
  const [testStatus, setTestStatus] = useState<string | null>(null)

  // Preferences
  const [prefs, setPrefs] = useState({
    push_enabled: true,
    email_enabled: false,
    alert_high_bp: true,
    alert_low_bp: true,
    alert_high_glucose: true,
    alert_low_glucose: true,
    alert_stale_data: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  })

  const checkNotificationPermission = () => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission as any)
    }
  }

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/alerts')
      const list = res.data || []
      setAlerts(list)
      const unack = list.filter((a: VitalAlert) => a.status === 'active').length
      onAlertCountChange?.(unack)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/api/v1/vitals/notifications/preferences')
      if (res.data) setPrefs(res.data)
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  useEffect(() => {
    if (isOpen) {
      checkNotificationPermission()
      fetchAlerts()
      fetchPreferences()
    }
  }, [isOpen])

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported on this browser.')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setPushStatus(permission)

      if (permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        // Mock or real WebPush subscription
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: 'BCV_MediCare_Secure_Push_Key_V1',
            })
          } catch (e) {
            console.log('Push manager mock registration fallback')
          }
        }

        await api.post('/api/v1/vitals/notifications/subscribe', {
          endpoint: subscription?.endpoint || `https://push.browser.mock/${Date.now()}`,
          p256dh: 'mock_p256dh_key',
          auth: 'mock_auth_key',
        })
      }
    } catch (err) {
      console.error('Permission request failed:', err)
    }
  }

  const sendTestNotification = async () => {
    try {
      setTestStatus('Sending privacy-safe test notification...')
      await api.post('/api/v1/vitals/notifications/test')
      setTestStatus('Test notification queued! Check your system notification banner.')
      setTimeout(() => setTestStatus(null), 4000)
    } catch (err) {
      setTestStatus('Test failed. Please ensure notifications are enabled.')
    }
  }

  const savePreferences = async (updated: typeof prefs) => {
    setPrefs(updated)
    try {
      await api.put('/api/v1/vitals/notifications/preferences', updated)
    } catch (err) {
      console.error('Failed to update preferences:', err)
    }
  }

  const handleAcknowledge = async (id: string) => {
    try {
      await api.post(`/api/v1/vitals/alerts/${id}/acknowledge`)
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a))
      )
      const unack = alerts.filter((a) => a.id !== id && a.status === 'active').length
      onAlertCountChange?.(unack)
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  if (!isOpen) return null

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'crisis':
        return { text: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' }
      case 'urgent':
        return { text: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' }
      case 'warning':
        return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
      default:
        return { text: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.25)' }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        right: 16,
        width: '100%',
        maxWidth: 420,
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 50,
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      }}
      className="glass"
    >
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              MediCare Notification Center
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(10,22,40,0.6)', padding: 3, borderRadius: 8 }}>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'alerts' ? 'rgba(56,189,248,0.2)' : 'transparent',
              color: activeTab === 'alerts' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            In-App Alerts ({alerts.filter((a) => a.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === 'preferences' ? 'rgba(56,189,248,0.2)' : 'transparent',
              color: activeTab === 'preferences' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Settings & Quiet Hours
          </button>
        </div>
      </div>

      <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'alerts' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map((al) => {
              const style = getSeverityStyle(al.severity)
              return (
                <div
                  key={al.id}
                  style={{
                    background: 'rgba(10,22,40,0.6)',
                    border: `1px solid ${style.border}`,
                    borderRadius: 12,
                    padding: '14px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: style.text,
                          background: style.bg,
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {al.severity}
                      </span>
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f8fafc' }}>
                        {al.title}
                      </span>
                    </div>

                    {al.status === 'active' ? (
                      <button
                        onClick={() => handleAcknowledge(al.id)}
                        style={{
                          background: 'rgba(56,189,248,0.15)',
                          border: '1px solid rgba(56,189,248,0.3)',
                          color: '#38bdf8',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Check size={11} />
                        Dismiss
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Reviewed</span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {al.message}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                    <span>{format(new Date(al.created_at), 'MMM dd, h:mm a')}</span>
                    {al.triggered_value && <span>Trigger: {al.triggered_value}</span>}
                  </div>
                </div>
              )
            })}

            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b', fontSize: '0.825rem' }}>
                <CheckCircle2 size={24} color="#10b981" className="mx-auto mb-2" />
                No active health alerts. All measurements within configured thresholds.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Push Permission Prompt */}
            <div style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                  Mobile Push Notifications
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: pushStatus === 'granted' ? '#10b981' : '#f59e0b',
                    textTransform: 'capitalize',
                  }}
                >
                  {pushStatus}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 10px' }}>
                Enables immediate device alerts for hypertensive crises or hypoglycemic readings.
              </p>
              {pushStatus !== 'granted' ? (
                <button
                  onClick={requestPushPermission}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', padding: '8px' }}
                >
                  Enable Device Notifications
                </button>
              ) : (
                <button
                  onClick={sendTestNotification}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', padding: '8px' }}
                >
                  Send Test Notification
                </button>
              )}
              {testStatus && (
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: 8 }}>
                  {testStatus}
                </div>
              )}
            </div>

            {/* Privacy Protection Note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: '#94a3b8' }}>
              <ShieldCheck size={14} color="#10b981" />
              <span>Lock-screen notifications obscure sensitive diagnosis details.</span>
            </div>

            {/* Threshold Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase' }}>
                Alert Categories
              </div>

              {[
                { key: 'alert_high_bp', label: 'High Blood Pressure (Crisis / Stage 2)' },
                { key: 'alert_low_bp', label: 'Low Blood Pressure (Hypotension)' },
                { key: 'alert_high_glucose', label: 'High Blood Glucose (> 250 mg/dL)' },
                { key: 'alert_low_glucose', label: 'Low Blood Glucose (< 70 mg/dL)' },
                { key: 'alert_stale_data', label: 'Missing / Stale Measurement Warnings' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(prefs as any)[key]}
                    onChange={(e) => savePreferences({ ...prefs, [key]: e.target.checked })}
                    style={{ accentColor: '#38bdf8' }}
                  />
                </label>
              ))}
            </div>

            {/* Quiet Hours */}
            <div style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Moon size={14} color="#818cf8" />
                  <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc' }}>
                    Non-Urgent Quiet Hours
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.quiet_hours_enabled}
                  onChange={(e) => savePreferences({ ...prefs, quiet_hours_enabled: e.target.checked })}
                  style={{ accentColor: '#818cf8' }}
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 10px' }}>
                Mutes routine reminders during sleep hours. Urgent crisis alerts always pass through.
              </p>
              {prefs.quiet_hours_enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_start}
                      onChange={(e) => savePreferences({ ...prefs, quiet_hours_start: e.target.value })}
                      style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                      End Time
                    </label>
                    <input
                      type="time"
                      value={prefs.quiet_hours_end}
                      onChange={(e) => savePreferences({ ...prefs, quiet_hours_end: e.target.value })}
                      style={{ width: '100%', padding: '6px', borderRadius: 6, background: 'rgba(15,23,42,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
