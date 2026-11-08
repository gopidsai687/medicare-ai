import React, { useState, useEffect } from 'react'
import { X, History, Shield, Calendar, RefreshCw, Archive, CheckCircle, RotateCcw, AlertCircle, FileText, Activity } from 'lucide-react'
import api from '@/lib/api'
import { MedicalRecordData } from './AddRecordModal'

interface AuditEvent {
  id: string
  record_id: string
  title: string
  category: string
  action: string
  performed_by_name: string
  reason?: string
  previous_value?: string
  new_value?: string
  timestamp: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onRecordRestored?: () => void
}

export const RecordHistoryModal: React.FC<Props> = ({ isOpen, onClose, onRecordRestored }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'archived'>('audit')
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([])
  const [archivedRecords, setArchivedRecords] = useState<MedicalRecordData[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const fetchData = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        // Fetch audit logs
        const logRes = await api.get('/api/v1/records/history', {
          params: { category: categoryFilter !== 'all' ? categoryFilter : undefined }
        })
        if (Array.isArray(logRes.data)) {
          setAuditLogs(logRes.data)
        }

        // Fetch archived records
        const recRes = await api.get('/api/v1/records', {
          params: { include_archived: true }
        })
        if (Array.isArray(recRes.data)) {
          const arch = recRes.data.filter((r: any) => r.is_archived === true)
          setArchivedRecords(arch)
        }
      } catch (err: any) {
        console.error('Failed to load records history:', err)
        setErrorMessage('Unable to load EHR version history.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isOpen, categoryFilter])

  if (!isOpen) return null

  const handleRestore = async (recordId: string) => {
    setRestoringId(recordId)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await api.patch(`/api/v1/records/${recordId}/restore`)
      setArchivedRecords(prev => prev.filter(r => r.id !== recordId))
      setSuccessMessage('Medical record successfully restored to active health profile.')
      if (onRecordRestored) onRecordRestored()

      // Refresh audit logs
      const logRes = await api.get('/api/v1/records/history')
      if (Array.isArray(logRes.data)) {
        setAuditLogs(logRes.data)
      }
    } catch (err: any) {
      console.error('Failed to restore record:', err)
      setErrorMessage('Failed to restore record.')
    } finally {
      setRestoringId(null)
    }
  }

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">Created</span>
      case 'amended':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">Amended</span>
      case 'updated':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide">Updated</span>
      case 'archived':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">Archived</span>
      case 'restored':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-wide">Restored</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-300 border border-slate-500/20 uppercase tracking-wide">{action}</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl p-6 relative border border-white/10 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Medical Records History & Audit Log</h2>
              <p className="text-xs text-slate-400">
                Immutable HIPAA § 164.526 historical activity trail & archived records repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Activity Audit Log ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'archived'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Archive size={13} /> Archived Records ({archivedRecords.length})
            </button>
          </div>

          {activeTab === 'audit' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Categories</option>
                <option value="diagnosis">Diagnoses</option>
                <option value="allergy">Allergies</option>
                <option value="surgery">Surgeries</option>
                <option value="immunization">Immunizations</option>
              </select>
            </div>
          )}
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Loading EHR history audit trail...</span>
            </div>
          ) : activeTab === 'audit' ? (
            auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No history audit entries found for this category.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getActionBadge(log.action)}
                      <span className="font-semibold text-white text-xs">{log.title}</span>
                      <span className="text-[11px] text-slate-400 capitalize">({log.category})</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-300">By: {log.performed_by_name}</span>
                    {log.reason && (
                      <span className="text-amber-300/90 italic">
                        • Reason: "{log.reason}"
                      </span>
                    )}
                  </div>

                  {log.previous_value && log.new_value && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 p-2 rounded-xl bg-black/30 border border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] font-bold tracking-wider">Before</span>
                        <span className="text-rose-300 font-mono line-clamp-2">{log.previous_value}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block uppercase text-[9px] font-bold tracking-wider">After</span>
                        <span className="text-emerald-300 font-mono line-clamp-2">{log.new_value}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            archivedRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No archived medical records. All current records are active.
              </div>
            ) : (
              archivedRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 uppercase">
                        {rec.category}
                      </span>
                      <span className="font-semibold text-white text-xs">{rec.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Date: {rec.date}</span>
                      <span>Provider: {rec.provider}</span>
                      {rec.amendment_reason && (
                        <span className="text-amber-300/80">Archival Note: {rec.amendment_reason}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(rec.id)}
                    disabled={restoringId === rec.id}
                    className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RotateCcw size={13} className={restoringId === rec.id ? 'animate-spin' : ''} />
                    {restoringId === rec.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5 text-blue-400">
            <Shield size={14} /> HIPAA § 164.526 Protected Audit Trail
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
