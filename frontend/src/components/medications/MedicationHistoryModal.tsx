import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  Clock,
  RotateCcw,
  Pill,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Search,
} from 'lucide-react'
import api from '@/lib/api'
import { PrescriptionItem } from '../prescriptions/AddPrescriptionModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onRestored?: (rxId: string) => void
}

export const MedicationHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [medications, setMedications] = useState<PrescriptionItem[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'discontinued' | 'archived'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/v1/prescriptions?include_archived=true')
      setMedications(Array.isArray(res.data) ? res.data : [])
    } catch (err: any) {
      setError('Failed to load medication history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen])

  if (!isOpen) return null

  const handleResume = async (rxId: string) => {
    setRestoringId(rxId)
    setSuccessMsg(null)
    try {
      await api.patch(`/api/v1/prescriptions/${rxId}/restore`)
      setSuccessMsg('Medication regimen resumed to active!')
      if (onRestored) onRestored(rxId)
      await loadData()
    } catch (err: any) {
      setError('Failed to resume medication.')
    } finally {
      setRestoringId(null)
    }
  }

  const filtered = medications.filter((m) => {
    const matchesSearch =
      m.medication_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.generic_name && m.generic_name.toLowerCase().includes(search.toLowerCase())) ||
      (m.prescribing_doctor_name && m.prescribing_doctor_name.toLowerCase().includes(search.toLowerCase()))

    if (filter === 'active') return matchesSearch && m.status === 'active' && !m.is_archived
    if (filter === 'discontinued') return matchesSearch && m.status === 'discontinued'
    if (filter === 'archived') return matchesSearch && m.is_archived
    return matchesSearch
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl my-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Medication History & Regimen Timeline
              </h2>
              <p className="text-xs text-slate-400">
                Longitudinal record of all active, completed, discontinued, and archived therapies
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

        {/* Filters */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medication name or prescriber..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(['all', 'active', 'discontinued', 'archived'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  filter === tab
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-teal-400" />
              <p className="text-xs text-slate-400">Loading medication history...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching medications found in history.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((med) => {
                const isDiscontinued = med.status === 'discontinued'
                const isArchived = Boolean(med.is_archived)
                return (
                  <div
                    key={med.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">
                          {med.medication_name}
                        </span>
                        <span className="text-xs text-slate-300">
                          {med.dosage}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            med.status === 'active' && !isArchived
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isDiscontinued
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : isArchived
                              ? 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isArchived ? 'Archived' : med.status}
                        </span>
                        {med.is_verified && (
                          <span className="text-[10px] text-teal-400 flex items-center gap-0.5">
                            <ShieldCheck size={12} /> Clinician Verified
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        {med.frequency} • Route: {med.route || 'Oral'} • Prescriber:{' '}
                        {med.prescribing_doctor_name || 'N/A'}
                      </div>

                      {med.discontinued_reason && (
                        <div className="text-xs text-rose-300/90 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-1">
                          <strong>Cessation Reason:</strong> {med.discontinued_reason}
                        </div>
                      )}

                      {med.archived_reason && (
                        <div className="text-xs text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800 mt-1">
                          <strong>Archive Reason:</strong> {med.archived_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        Started: {med.start_date || 'N/A'}
                      </div>

                      {(isDiscontinued || isArchived) && (
                        <button
                          onClick={() => handleResume(med.id)}
                          disabled={restoringId === med.id}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {restoringId === med.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RotateCcw size={12} />
                          )}
                          Resume Regimen
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Total recorded regimens: {medications.length}
          </span>
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

