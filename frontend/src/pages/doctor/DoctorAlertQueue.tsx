import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  User,
  Activity,
  Heart,
  Droplet,
  FileText,
  Search,
  Check,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

interface VitalAlert {
  id: string
  patient_id: string
  vital_sign_id?: string | null
  alert_type: string
  severity: 'info' | 'warning' | 'urgent' | 'crisis'
  title: string
  message: string
  clinical_recommendation?: string | null
  triggered_value?: string | null
  threshold_rule?: string | null
  status: 'active' | 'acknowledged' | 'resolved'
  acknowledged_at?: string | null
  doctor_review_notes?: string | null
  follow_up_action?: string | null
  created_at: string
  patient_name?: string
}

export default function DoctorAlertQueue() {
  const [alerts, setAlerts] = useState<VitalAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [selectedAlert, setSelectedAlert] = useState<VitalAlert | null>(null)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [followUpAction, setFollowUpAction] = useState('contact_patient')
  const [submittingAction, setSubmittingAction] = useState(false)

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (severityFilter !== 'all') params.severity = severityFilter
      const res = await api.get('/api/v1/vitals/doctor/alerts', { params })
      setAlerts(res.data || [])
    } catch (err) {
      console.error('Failed to load doctor clinical alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [statusFilter, severityFilter])

  const handleOpenActionModal = (alertItem: VitalAlert) => {
    setSelectedAlert(alertItem)
    setReviewNotes(alertItem.doctor_review_notes || '')
    setFollowUpAction(alertItem.follow_up_action || 'contact_patient')
    setActionModalOpen(true)
  }

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAlert) return

    try {
      setSubmittingAction(true)
      await api.post(`/api/v1/vitals/doctor/alerts/${selectedAlert.id}/action`, {
        doctor_review_notes: reviewNotes,
        follow_up_action: followUpAction,
      })

      setActionModalOpen(false)
      setSelectedAlert(null)
      await fetchAlerts()
    } catch (err) {
      alert('Failed to save clinical review action.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'crisis':
        return { text: '#ef4444', bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.5)', label: 'Crisis Alert' }
      case 'urgent':
        return { text: '#f97316', bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.45)', label: 'Urgent Alert' }
      case 'warning':
        return { text: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', label: 'Warning' }
      default:
        return { text: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', label: 'Informational' }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return { text: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', label: 'Resolved' }
      case 'acknowledged':
        return { text: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)', label: 'Reviewed' }
      default:
        return { text: '#f43f5e', bg: 'rgba(244,63,94,0.15)', border: 'rgba(244,63,94,0.3)', label: 'Action Required' }
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 6 }}>
            <ShieldAlert size={12} color="#38bdf8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Doctor Clinical Portal
            </span>
          </div>
          <h1 className="page-title">Clinical Telemetry Alert Triage Queue</h1>
          <p className="page-subtitle">
            AHA/ACC and ADA clinical alert triage for assigned patients with documented clinical review notes.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="btn-secondary"
          style={{ fontSize: '0.825rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Clinical Disclaimer Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 12,
          padding: '12px 18px',
        }}
      >
        <ShieldCheck size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45 }}>
          <strong>Clinical Acknowledgment Standard:</strong> Acknowledging an alert logs your clinical review and follow-up plan in the audit log. It does <em>not</em> erase the underlying telemetry reading or imply that the patient has returned to hemodynamic baseline.
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
            <Filter size={14} />
            <span>Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                background: 'rgba(10,22,40,0.8)',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: '0.8rem',
              }}
            >
              <option value="all">All Severities</option>
              <option value="crisis">Hypertensive Crisis / Severe Low</option>
              <option value="urgent">Urgent</option>
              <option value="warning">Warning</option>
              <option value="info">Informational</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'rgba(10,22,40,0.8)',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: '0.8rem',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Needs Review)</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
          Total Alerts: <strong style={{ color: '#cbd5e1' }}>{alerts.length}</strong>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="glass" style={{ padding: '24px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Patient / ID</th>
                <th>Alert Severity</th>
                <th>Condition & Trigger</th>
                <th>Recorded Value</th>
                <th>Triggered At</th>
                <th>Review Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((al) => {
                const sBadge = getSeverityBadge(al.severity)
                const stBadge = getStatusBadge(al.status)

                return (
                  <tr key={al.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'rgba(14,165,233,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <User size={14} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                            {al.patient_name || 'Assigned Patient'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            MPI: {al.patient_id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: sBadge.text,
                          background: sBadge.bg,
                          border: `1px solid ${sBadge.border}`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sBadge.label}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                        {al.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {al.message}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {al.triggered_value || 'Telemetry Stale'}
                      </span>
                    </td>

                    <td style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {format(new Date(al.created_at), 'MMM dd, h:mm a')}
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: stBadge.text,
                          background: stBadge.bg,
                          border: `1px solid ${stBadge.border}`,
                          padding: '3px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stBadge.label}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenActionModal(al)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      >
                        <MessageSquare size={13} />
                        <span>{al.status === 'active' ? 'Review & Plan' : 'View Notes'}</span>
                      </button>
                    </td>
                  </tr>
                )
              })}

              {alerts.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    No alerts in queue matching the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinical Review & Action Modal */}
      {actionModalOpen && selectedAlert && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: 540,
              padding: 28,
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldAlert size={22} color="#38bdf8" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Doctor Clinical Triage Action
                </h3>
              </div>
              <button
                onClick={() => setActionModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px', marginBottom: 18 }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                {selectedAlert.title}
              </div>
              <div style={{ fontSize: '0.825rem', color: '#cbd5e1', marginBottom: 8, lineHeight: 1.45 }}>
                {selectedAlert.message}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Triggered Reading: <strong style={{ color: '#f8fafc' }}>{selectedAlert.triggered_value}</strong> | Rule: {selectedAlert.threshold_rule}
              </div>
            </div>

            <form onSubmit={handleSaveAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Follow-up Action Plan
                </label>
                <select
                  value={followUpAction}
                  onChange={(e) => setFollowUpAction(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(10,22,40,0.8)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="contact_patient">Immediate Patient Outreach / Phone Call</option>
                  <option value="schedule_appointment">Schedule Clinical Encounter / Appointment</option>
                  <option value="medication_review">Flag for Medication Regimen Review</option>
                  <option value="er_referral">Direct Patient to Nearest Emergency Department</option>
                  <option value="routine_monitoring">Continue Routine Telemetry Monitoring</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  Clinical Review Notes *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Document your clinical assessment, patient communication, or diagnostic next steps..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(10,22,40,0.8)',
                    color: '#f8fafc',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  {submittingAction ? 'Documenting...' : 'Acknowledge & Record Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
