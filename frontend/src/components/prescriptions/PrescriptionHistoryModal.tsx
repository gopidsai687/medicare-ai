import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  Clock,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from './AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  prescription?: PrescriptionItem | null
  onReopenAnalysis?: (reportId: string) => void
  onRestored?: (restoredId: string) => void
}

interface AuditItem {
  id: string
  prescription_id: string
  medication_name: string
  status: string
  action: string
  performed_by_name: string
  reason?: string
  previous_value?: string
  new_value?: string
  timestamp: string
}

interface VersionItem {
  id: string
  version_number: number
  action: string
  change_summary: string
  reason?: string
  changed_by_name: string
  snapshot: Record<string, any>
  timestamp: string
}

export const PrescriptionHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  prescription,
  onReopenAnalysis,
  onRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'versions'>('audit')
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([])
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        if (prescription) {
          // Fetch both audit logs for patient & single rx versions
          const [histRes, verRes] = await Promise.allSettled([
            api.get('/api/v1/prescriptions/history'),
            api.get(`/api/v1/prescriptions/${prescription.id}/history`),
          ])

          if (histRes.status === 'fulfilled' && Array.isArray(histRes.value.data)) {
            // Filter audit logs for this prescription
            const filtered = histRes.value.data.filter(
              (item: AuditItem) => item.prescription_id === prescription.id
            )
            setAuditLogs(filtered.length > 0 ? filtered : histRes.value.data)
          }

          if (verRes.status === 'fulfilled' && Array.isArray(verRes.value.data)) {
            setVersions(verRes.value.data)
          }
        } else {
          // General history across all prescriptions
          const res = await api.get('/api/v1/prescriptions/history')
          setAuditLogs(Array.isArray(res.data) ? res.data : [])
        }
      } catch (err: any) {
        setError('Failed to load prescription history.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isOpen, prescription])

  if (!isOpen) return null

  const handleRestore = async (rxId: string) => {
    setRestoringId(rxId)
    setRestoreMessage(null)
    try {
      await api.patch(`/api/v1/prescriptions/${rxId}/restore`)
      setRestoreMessage('Prescription successfully restored to active profile!')
      if (onRestored) onRestored(rxId)
      // refresh
      const res = await api.get('/api/v1/prescriptions/history')
      setAuditLogs(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to restore prescription.')
    } finally {
      setRestoringId(null)
    }
  }

  const getActionBadge = (action: string) => {
    const a = action.toLowerCase()
    if (a.includes('created')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    if (a.includes('amend')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    if (a.includes('discontinue')) return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    if (a.includes('archive')) return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    if (a.includes('restore')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    if (a.includes('refill')) return 'bg-violet-500/10 text-violet-400 border-violet-500/30'
    if (a.includes('verified')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    return 'bg-slate-700/50 text-slate-300 border-slate-600'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Prescription History & Audit Trail
                {prescription && (
                  <span className="text-xs font-normal text-slate-400">
                    — {prescription.medication_name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Immutable electronic health record event timeline & version history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Reopen Analysis Quick Action Banner if linked report exists */}
        {prescription?.analysis_report_id && (
          <div className="px-6 py-3 bg-gradient-to-r from-violet-900/30 via-slate-900 to-blue-900/30 border-b border-violet-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-violet-300">
              <Sparkles size={16} className="text-violet-400 shrink-0" />
              <span>
                An AI clinical analysis report is linked to this prescription record.
              </span>
            </div>
            <button
              onClick={() => {
                if (onReopenAnalysis && prescription.analysis_report_id) {
                  onReopenAnalysis(prescription.analysis_report_id)
                  onClose()
                }
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Eye size={13} /> Reopen AI Analysis
            </button>
          </div>
        )}

        {/* Tab switcher if specific prescription selected */}
        {prescription && (
          <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === 'audit'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Activity Timeline ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeTab === 'versions'
                  ? 'border-violet-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Version Snapshots ({versions.length})
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {restoreMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{restoreMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-violet-400" />
              <p className="text-xs text-slate-400">Loading audit history...</p>
            </div>
          ) : activeTab === 'audit' ? (
            auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No activity logs found for this prescription.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                {auditLogs.map((log) => {
                  const isArchived = log.action.toLowerCase() === 'archived'
                  return (
                    <div
                      key={log.id}
                      className="relative pl-8 p-4 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition space-y-2"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-2.5 top-5 w-2.5 h-2.5 rounded-full bg-violet-400 ring-4 ring-slate-900" />

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider border ${getActionBadge(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {log.medication_name}
                          </span>
                          <span className="text-xs text-slate-400">
                            by {log.performed_by_name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>

                      {log.reason && (
                        <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <strong className="text-slate-400 font-medium">Reason / Note: </strong>
                          {log.reason}
                        </div>
                      )}

                      {(log.previous_value || log.new_value) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                          {log.previous_value && (
                            <div className="p-2 rounded bg-slate-950/40 text-slate-400">
                              <span className="block font-medium text-rose-400/80 mb-0.5">
                                Previous Value
                              </span>
                              {log.previous_value}
                            </div>
                          )}
                          {log.new_value && (
                            <div className="p-2 rounded bg-slate-950/40 text-slate-300">
                              <span className="block font-medium text-emerald-400/80 mb-0.5">
                                New Value
                              </span>
                              {log.new_value}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Restore option if archived */}
                      {isArchived && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleRestore(log.prescription_id)}
                            disabled={restoringId === log.prescription_id}
                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            {restoringId === log.prescription_id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RotateCcw size={12} />
                            )}
                            Restore to Active Prescriptions
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            /* Versions Snapshots */
            versions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No version snapshots recorded yet.
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold">
                          v{ver.version_number}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {ver.change_summary}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ver.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {ver.reason && (
                      <p className="text-xs text-slate-400 italic">
                        Documented reason: {ver.reason}
                      </p>
                    )}

                    {ver.snapshot && (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(ver.snapshot, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={15} className="text-emerald-400" />
            <span>Audit entries are immutable and encrypted</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

