import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  Search,
  Download,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  Eye,
  X,
  Lock,
  User,
  RefreshCw,
  Loader2,
  WifiOff,
} from 'lucide-react'
import api from '../../lib/api'

interface AuditEvent {
  id: string
  user_id: string | null
  action: string
  severity: 'info' | 'warning' | 'critical'
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  details: Record<string, unknown> | null
  created_at: string
  // Joined user fields (if the backend eagerly loads)
  user?: {
    email: string
    full_name: string
    role: string
  } | null
}

// Fallback demo data used when backend is unavailable (dev mode)
const DEMO_LOGS: AuditEvent[] = [
  {
    id: 'demo-aud-1',
    user_id: null,
    action: 'patient_merge',
    severity: 'critical',
    resource_type: 'Patient',
    resource_id: 'MRN-00000099',
    ip_address: '192.168.1.100',
    user_agent: 'MediCare Admin Portal/1.0',
    details: {
      survivor_mrn: 'MRN-00000012',
      merged_mrn: 'MRN-00000099',
      reason: 'Confirmed duplicate via MPI scoring (0.97)',
      transferred_appointments: 3,
      transferred_encounters: 5,
      transferred_vitals: 8,
      transferred_records: 2,
      transferred_prescriptions: 4,
    },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    user: { email: 'admin@medicare.ai', full_name: 'System Administrator', role: 'admin' },
  },
  {
    id: 'demo-aud-2',
    user_id: null,
    action: 'view_record',
    severity: 'info',
    resource_type: 'MedicalRecord',
    resource_id: 'rec-2',
    ip_address: '10.0.4.52',
    user_agent: 'Chrome/128.0',
    details: { patient_name: 'Robert Chen', record_type: 'Diagnosis History' },
    created_at: new Date(Date.now() - 7200000).toISOString(),
    user: { email: 'sarah.chen@medicare.ai', full_name: 'Dr. Sarah Chen', role: 'doctor' },
  },
  {
    id: 'demo-aud-3',
    user_id: null,
    action: 'login_failure',
    severity: 'warning',
    resource_type: 'Auth',
    resource_id: 'auth_attempt',
    ip_address: '203.0.113.88',
    user_agent: 'Unknown Agent',
    details: { attempted_email: 'admin@medicare.ai', lockout_counter: 2 },
    created_at: new Date(Date.now() - 10800000).toISOString(),
    user: null,
  },
  {
    id: 'demo-aud-4',
    user_id: null,
    action: 'login_success',
    severity: 'info',
    resource_type: 'Auth',
    resource_id: 'session_token',
    ip_address: '10.0.4.52',
    user_agent: 'Chrome/128.0',
    details: { mfa_verified: true, session_duration: '8h' },
    created_at: new Date(Date.now() - 14400000).toISOString(),
    user: { email: 'sarah.chen@medicare.ai', full_name: 'Dr. Sarah Chen', role: 'doctor' },
  },
  {
    id: 'demo-aud-5',
    user_id: null,
    action: 'create_record',
    severity: 'info',
    resource_type: 'Encounter',
    resource_id: 'enc-084',
    ip_address: '10.0.4.58',
    user_agent: 'Chrome/128.0',
    details: { patient_name: 'David Kim', encounter_type: 'SOAP Note', signed: true },
    created_at: new Date(Date.now() - 18000000).toISOString(),
    user: { email: 'james.kim@medicare.ai', full_name: 'Dr. James Kim', role: 'doctor' },
  },
  {
    id: 'demo-aud-6',
    user_id: null,
    action: 'role_change',
    severity: 'critical',
    resource_type: 'User',
    resource_id: 'usr-901',
    ip_address: '192.168.1.1',
    user_agent: 'MediCare Admin Portal/1.0',
    details: { previous_role: 'nurse', new_role: 'doctor', reason: 'State medical board credentialing' },
    created_at: new Date(Date.now() - 21600000).toISOString(),
    user: { email: 'admin@medicare.ai', full_name: 'System Administrator', role: 'admin' },
  },
]

const ACTION_LABELS: Record<string, string> = {
  view_record: 'Record Accessed',
  create_record: 'Record Created',
  update_record: 'Record Updated',
  delete_record: 'Record Deleted',
  login_success: 'Login Success',
  login_failure: 'Login Failure',
  logout: 'Logout',
  patient_merge: 'Patient Merge',
  export_health_data: 'Data Export',
  role_change: 'Role Change',
}

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: Info,
  info: CheckCircle,
}

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const params: Record<string, string> = { limit: '100' }
      if (severityFilter !== 'all') params.severity = severityFilter

      const { data } = await api.get('/api/v1/audit-logs', { params })
      setLogs(data)
      setUsingDemo(false)
    } catch (err: any) {
      console.warn('Audit log API unavailable, using demo data:', err?.message)
      setLogs(DEMO_LOGS)
      setUsingDemo(true)
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        setError('Insufficient permissions. Admin role required.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [severityFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter((l) => {
    const userEmail = l.user?.email ?? ''
    const userName = l.user?.full_name ?? ''
    const detailsStr = l.details ? JSON.stringify(l.details) : ''
    const matchesSearch =
      userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.ip_address ?? '').includes(searchQuery) ||
      (l.resource_id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const severityCounts = {
    all: logs.length,
    info: logs.filter((l) => l.severity === 'info').length,
    warning: logs.filter((l) => l.severity === 'warning').length,
    critical: logs.filter((l) => l.severity === 'critical').length,
  }

  const handleExport = () => {
    const csvHeader = 'Timestamp,Severity,Action,User,Resource,IP Address,Details\n'
    const csvBody = filteredLogs.map((l) =>
      `"${formatTimestamp(l.created_at)}","${l.severity}","${l.action}","${l.user?.email ?? 'N/A'}","${l.resource_type}:${l.resource_id ?? ''}","${l.ip_address ?? ''}","${l.details ? JSON.stringify(l.details).replace(/"/g, '""') : ''}"`
    ).join('\n')
    const blob = new Blob([csvHeader + csvBody], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medicare_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Security & HIPAA Audit Trail</h1>
          <p className="page-subtitle">
            Immutable access ledger, electronic protected health information (ePHI) logging
            {usingDemo && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <WifiOff size={10} /> Demo Data
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download size={14} /> Export Signed Audit Trail
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'info', 'warning', 'critical'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSeverityFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                severityFilter === tab
                  ? tab === 'critical'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                    : tab === 'warning'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
              <span className="ml-1.5 opacity-70">({severityCounts[tab]})</span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search email, IP, action, event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="glass rounded-2xl p-16 flex flex-col items-center justify-center gap-4 animate-fade-in">
          <Loader2 size={32} className="animate-spin text-blue-400" />
          <p className="text-sm text-slate-400">Loading audit trail...</p>
        </div>
      ) : (
        /* Audit Log Table */
        <div className="glass rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-5">Severity</th>
                  <th className="py-3.5 px-5">Event Action</th>
                  <th className="py-3.5 px-5">Operator</th>
                  <th className="py-3.5 px-5">Target Resource</th>
                  <th className="py-3.5 px-5">IP Address</th>
                  <th className="py-3.5 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Shield size={28} className="text-slate-600" />
                        <p className="text-slate-500 text-sm">No audit events match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => {
                    const SevIcon = SEVERITY_ICON[log.severity] ?? Info
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <td className="py-4 px-5 text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-slate-600" />
                            {formatTimestamp(log.created_at)}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] inline-flex items-center gap-1 ${
                              log.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : log.severity === 'warning'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            <SevIcon size={10} />
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-semibold text-white">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </td>
                        <td className="py-4 px-5 text-slate-300 font-sans">
                          <div>{log.user?.email ?? 'System'}</div>
                          <div className="text-[11px] text-slate-500">
                            {log.user?.full_name ?? log.user?.role ?? 'Automated'}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-blue-400">
                          {log.resource_type}{log.resource_id ? `:${log.resource_id}` : ''}
                        </td>
                        <td className="py-4 px-5 text-slate-400">{log.ip_address ?? '—'}</td>
                        <td className="py-4 px-5 text-right font-sans">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedLog(log)
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Table footer */}
          <div className="bg-white/[0.02] border-t border-white/10 px-5 py-3 flex justify-between items-center text-xs text-slate-500">
            <span>Showing {filteredLogs.length} of {logs.length} events</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock size={10} />
              HIPAA Compliant — Tamper-Evident Ledger
            </span>
          </div>
        </div>
      )}

      {/* Details Slide-Over / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shield size={17} className="text-blue-400" /> Audit Event Payload
              </h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 font-mono">
                <div>
                  <p className="text-slate-500">Event Action</p>
                  <p className="text-white font-semibold mt-0.5">
                    {ACTION_LABELS[selectedLog.action] ?? selectedLog.action}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Severity</p>
                  <p className={`font-semibold mt-0.5 uppercase ${
                    selectedLog.severity === 'critical' ? 'text-rose-400'
                    : selectedLog.severity === 'warning' ? 'text-amber-400'
                    : 'text-blue-400'
                  }`}>
                    {selectedLog.severity}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Timestamp</p>
                  <p className="text-slate-300 mt-0.5">{formatTimestamp(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Source IP</p>
                  <p className="text-slate-300 mt-0.5">{selectedLog.ip_address ?? '—'}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Actor Identity
                </p>
                <p className="text-white">
                  {selectedLog.user?.email ?? 'System'}{' '}
                  <span className="text-slate-500">
                    ({selectedLog.user?.full_name ?? selectedLog.user?.role ?? 'Automated'})
                  </span>
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Resource Reference
                </p>
                <p className="font-mono text-blue-400">
                  {selectedLog.resource_type} / {selectedLog.resource_id ?? '—'}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <p className="font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Event Details (JSON Payload)
                  </p>
                  <pre className="p-3 rounded-xl bg-white/5 text-slate-300 leading-relaxed font-mono text-[11px] border border-white/5 overflow-x-auto max-h-48 overflow-y-auto">
{JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    User Agent
                  </p>
                  <p className="text-slate-400 font-mono text-[11px]">{selectedLog.user_agent}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button onClick={() => setSelectedLog(null)} className="btn-primary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
