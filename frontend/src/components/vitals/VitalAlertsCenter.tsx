import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Bell,
  X,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  ShieldCheck,
  Download,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'

export interface VitalAlertItem {
  id: string
  alert_type: string
  severity: string // 'crisis' | 'critical' | 'urgent' | 'warning' | 'info'
  title: string
  message: string
  clinical_recommendation?: string | null
  triggered_value?: string | null
  status: string
  created_at: string
}

export interface VitalReminderItem {
  id: string
  reminder_type: string
  label: string
  time_of_day: string
  frequency: string
  days_of_week?: string | null
  is_active: boolean
}

export interface VitalAlertsCenterProps {
  alerts: VitalAlertItem[]
  reminders?: VitalReminderItem[]
  onAcknowledgeAlert: (alertId: string) => Promise<void> | void
  onOpenRemindersModal?: () => void
}

export const VitalAlertsCenter: React.FC<VitalAlertsCenterProps> = ({
  alerts = [],
  reminders = [],
  onAcknowledgeAlert,
  onOpenRemindersModal,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)

  // Filter out any dismissed alerts
  const activeAlerts = alerts.filter((a) => a.status !== 'resolved' && a.status !== 'dismissed')

  // Separate by severity
  const urgentAlerts = activeAlerts.filter(
    (a) => a.severity === 'crisis' || a.severity === 'critical' || a.severity === 'urgent'
  )
  const attentionAlerts = activeAlerts.filter(
    (a) => a.severity === 'warning' || a.severity === 'attention'
  )
  const infoAlerts = activeAlerts.filter(
    (a) => a.severity === 'info' || (!urgentAlerts.includes(a) && !attentionAlerts.includes(a))
  )

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id)
    try {
      await onAcknowledgeAlert(id)
    } finally {
      setAcknowledgingId(null)
    }
  }

  // Active reminders
  const activeReminders = reminders.filter((r) => r.is_active)

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
            <Bell size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Clinical Notices &amp; Alert Center
              </h3>
              {urgentAlerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {urgentAlerts.length} Urgent
                </span>
              )}
              {attentionAlerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {attentionAlerts.length} Attention
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Evidence-based thresholds grounded strictly in your verified telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenRemindersModal && (
            <button
              onClick={onOpenRemindersModal}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Clock size={13} className="text-teal-400" />
              <span>Reminders ({activeReminders.length})</span>
            </button>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
            title={collapsed ? 'Expand Alert Center' : 'Collapse Alert Center'}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Collapsible Content */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Active Reminders Summary Strip if any */}
          {activeReminders.length > 0 && (
            <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-teal-300">
                <Clock size={14} className="text-teal-400 shrink-0" />
                <span className="font-semibold">Active Schedules:</span>
                <span className="text-slate-300">
                  {activeReminders.map((r) => `${r.label} (${r.time_of_day})`).join(' • ')}
                </span>
              </div>
              {onOpenRemindersModal && (
                <button
                  onClick={onOpenRemindersModal}
                  className="text-teal-400 hover:text-teal-300 font-medium underline text-[11px] cursor-pointer"
                >
                  Edit Schedules
                </button>
              )}
            </div>
          )}

          {/* Alerts Grid or Healthy State */}
          {activeAlerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeAlerts.map((alert) => {
                const isUrgent =
                  alert.severity === 'crisis' ||
                  alert.severity === 'critical' ||
                  alert.severity === 'urgent'
                const isAttention = alert.severity === 'warning' || alert.severity === 'attention'

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      isUrgent
                        ? 'bg-rose-950/25 border-rose-500/40 text-slate-200'
                        : isAttention
                        ? 'bg-amber-950/20 border-amber-500/30 text-slate-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      {/* Alert Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isUrgent
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isAttention
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          }`}
                        >
                          {isUrgent && <AlertTriangle size={11} />}
                          {isAttention && <Info size={11} />}
                          {alert.severity} • {alert.alert_type}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock size={11} />
                          {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>

                      {/* Title & Details */}
                      <h4 className="text-xs font-bold text-white mb-1.5">{alert.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>

                      {/* Clinical Guidance */}
                      {alert.clinical_recommendation && (
                        <div className="mt-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300">
                          <strong className="text-teal-400">Clinical Guidance:</strong>{' '}
                          {alert.clinical_recommendation}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 italic text-[10px]">
                        Educational rule notification
                      </span>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledgingId === alert.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {acknowledgingId === alert.id ? 'Saving...' : 'Acknowledge Notice'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Healthy State: Zero Active Alerts */
            <div className="py-4 px-3 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-300">
                  No Active Clinical Warnings
                </p>
                <p className="text-[11px] text-slate-500">
                  All recorded measurements reside within expected physiological parameters or have been acknowledged.
                </p>
              </div>
            </div>
          )}

          {/* Clinical Safety Notice Disclaimer */}
          <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 flex items-center justify-between">
            <span>
              Clinical rules reflect published AHA 2017 &amp; ADA 2024 standards. Never use demo data for medical decisions.
            </span>
            <span className="text-slate-400 font-mono">MediCare AI Clinical Safety Engine</span>
          </div>
        </div>
      )}
    </div>
  )
}
