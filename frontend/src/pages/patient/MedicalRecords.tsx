import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import {
  FileText,
  Search,
  Download,
  Plus,
  X,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Heart,
  Syringe,
  Scissors,
  CheckCircle2,
  Calendar,
  User,
  Info,
  Clock,
  Edit2,
  Archive,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  FlaskConical,
  ClipboardList,
} from 'lucide-react'
import { useToast } from '@/lib/toast'
import { AddRecordModal, MedicalRecordData } from '@/components/records/AddRecordModal'
import { EditRecordModal } from '@/components/records/EditRecordModal'
import { DeleteRecordModal } from '@/components/records/DeleteRecordModal'
import { RecordHistoryModal } from '@/components/records/RecordHistoryModal'
import { ClearRecordHistoryModal } from '@/components/records/ClearRecordHistoryModal'

export default function PatientMedicalRecords() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [records, setRecords] = useState<MedicalRecordData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordData | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [recordToEdit, setRecordToEdit] = useState<MedicalRecordData | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<MedicalRecordData | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)

  const loadRecords = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/v1/records', {
        params: {
          include_archived: showArchived,
        },
      })
      if (res.data && Array.isArray(res.data)) {
        setRecords(res.data)
        setIsLive(true)
      }
    } catch (err) {
      console.warn('Could not load medical records from backend API:', err)
      toastError('Connection Notice', 'Unable to reach medical records service. Displaying cached records.')
    } finally {
      setIsLoading(false)
    }
  }, [showArchived, toastError])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const handleExport = async () => {
    try {
      const res = await api.get('/api/v1/records/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MediCare_Medical_Records_Summary_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      success('Export Completed', 'Official electronic health records summary exported successfully.')
    } catch (err) {
      toastError('Export Failed', 'Unable to export health records summary.')
    }
  }

  const handleOpenEdit = (rec: MedicalRecordData) => {
    setRecordToEdit(rec)
    setIsEditModalOpen(true)
  }

  const handleOpenArchive = (rec: MedicalRecordData) => {
    setRecordToDelete(rec)
    setIsDeleteModalOpen(true)
  }

  const filteredRecords = records.filter((r) => {
    const catCode = (r.category_code || r.category || '').toLowerCase()
    const matchesCat =
      selectedCategory === 'all'
        ? true
        : catCode.includes(selectedCategory.toLowerCase()) ||
          (r.category || '').toLowerCase() === selectedCategory.toLowerCase()

    const matchesSearch =
      (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.provider || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.icd10 && r.icd10.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesCat && matchesSearch
  })

  const stats = [
    {
      label: 'Active Diagnoses',
      value: records.filter((r) => (r.category_code === 'diagnosis' || r.category === 'Diagnosis') && r.status !== 'Resolved').length,
      icon: Activity,
      color: '#3182f4',
    },
    {
      label: 'Allergies Tracked',
      value: records.filter((r) => r.category_code === 'allergy' || r.category === 'Allergy').length,
      icon: ShieldAlert,
      color: '#f43f5e',
    },
    {
      label: 'Surgeries Documented',
      value: records.filter((r) => r.category_code === 'surgery' || r.category === 'Surgery').length,
      icon: Scissors,
      color: '#10b981',
    },
    {
      label: 'Immunizations',
      value: records.filter((r) => r.category_code === 'immunization' || r.category === 'Immunization').length,
      icon: Syringe,
      color: '#8b5cf6',
    },
  ]

  const getCategoryIcon = (category: string) => {
    const c = (category || '').toLowerCase()
    if (c.includes('diagnosis')) return <Activity size={15} className="text-blue-400" />
    if (c.includes('allergy')) return <ShieldAlert size={15} className="text-rose-400" />
    if (c.includes('surgery')) return <Scissors size={15} className="text-emerald-400" />
    if (c.includes('immuniz')) return <Syringe size={15} className="text-purple-400" />
    if (c.includes('lab')) return <FlaskConical size={15} className="text-teal-400" />
    return <FileText size={15} className="text-slate-400" />
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Medical Records</h1>
          <p className="page-subtitle flex items-center gap-2">
            Your longitudinal electronic health record, verified clinical diagnoses, and history
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE DATABASE API
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/patient/labs')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <FlaskConical size={15} /> View Diagnostic Labs
          </button>
          <button
            onClick={handleExport}
            className="btn-primary inline-flex items-center gap-2 cursor-pointer"
          >
            <Download size={15} /> Export Health Summary
          </button>
        </div>
      </div>

      {/* ── My Medical Documents (Image 1 Recommended Layout) ───────────── */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-600/10 text-teal-400 border border-teal-500/20">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">My Medical Documents</span>
            <span className="text-xs text-slate-400">
              Prescription records, discharge summaries, and clinical diagnostic attachments
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/patient/prescriptions')}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus size={14} /> Upload Prescription
          </button>

          <button
            onClick={() => {
              const target = selectedRecord || (records.length > 0 ? records[0] : null)
              if (target?.supporting_document_url) {
                window.open(target.supporting_document_url, '_blank')
              } else {
                toastError('No Document File', 'This record has no external document attachment.')
              }
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileText size={14} className="text-blue-400" /> View Document
          </button>

          <button
            onClick={handleExport}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} className="text-teal-400" /> Download
          </button>

          <button
            onClick={() => {
              if (selectedRecord) handleOpenArchive(selectedRecord)
              else if (records.length > 0) handleOpenArchive(records[0])
              else toastError('No Record Selected', 'Please select a record to archive.')
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Archive size={14} className="text-amber-400" /> Archive
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('record-search-input')
              if (el) el.focus()
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Search size={14} className="text-violet-400" /> Search
          </button>
        </div>
      </div>

      {/* ── Action Area (Exact Recommended Layout from Mockup) ───────────── */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Medical Records</span>
            <span className="text-xs text-slate-400">
              {records.length} Verified EHR Records Available
            </span>
          </div>
        </div>

        {/* 4 Core Action Buttons from Mockup: [+ Add Record] [✏ Edit] [🕒 View History] [🗃 Archive] */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={14} /> Add Record
          </button>

          <button
            onClick={() => {
              if (selectedRecord) {
                handleOpenEdit(selectedRecord)
              } else if (records.length > 0) {
                handleOpenEdit(records[0])
              } else {
                toastError('No Record Selected', 'Please select a record from the table to edit.')
              }
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Edit2 size={14} className="text-blue-400" /> Edit
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Clock size={14} className="text-blue-400" /> View History
          </button>

          <button
            onClick={() => {
              if (selectedRecord) {
                handleOpenArchive(selectedRecord)
              } else if (records.length > 0) {
                handleOpenArchive(records[0])
              } else {
                toastError('No Record Selected', 'Please select a record from the table to archive.')
              }
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-amber-500/10 text-slate-300 hover:text-amber-300 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Archive size={14} className="text-amber-400" /> Archive
          </button>
        </div>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="glass p-4 rounded-2xl flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${s.color}15`, color: s.color }}
              >
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'diagnosis', label: 'Diagnoses' },
            { id: 'allergy', label: 'Allergies' },
            { id: 'surgery', label: 'Surgeries' },
            { id: 'immunization', label: 'Immunizations' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="record-search-input"
              type="text"
              placeholder="Search conditions, ICD-10, providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <button
            onClick={() => setIsClearModalOpen(true)}
            title="Reset Filters / Clear View"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Condition / Procedure</th>
                <th className="py-3.5 px-5">ICD-10 Code</th>
                <th className="py-3.5 px-5">Provenance & Source</th>
                <th className="py-3.5 px-5">Documented Date</th>
                <th className="py-3.5 px-5">Healthcare Provider</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading medical records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No medical records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const isPatientEntered = r.is_patient_reported || r.source === 'patient_reported'
                  const isSelected = selectedRecord?.id === r.id

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      {/* Category */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                          {getCategoryIcon(r.category)}
                          {r.category}
                        </span>
                      </td>

                      {/* Condition / Title */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                          <span>{r.title}</span>
                          {r.is_amended && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                              Amended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{r.description}</p>
                        {r.lab_result_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate('/patient/labs')
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition-colors bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20"
                          >
                            <FlaskConical size={12} /> View Linked Lab Biomarkers →
                          </button>
                        )}
                      </td>

                      {/* ICD-10 */}
                      <td className="py-4 px-5 font-mono text-xs text-blue-400">
                        {r.icd10 || '—'}
                      </td>

                      {/* Provenance Badge */}
                      <td className="py-4 px-5">
                        {isPatientEntered ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                            <UserCheck size={11} /> Patient-Reported
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck size={11} /> Clinician-Confirmed
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-5 text-xs text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-500" />
                          {r.date}
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="py-4 px-5 text-xs text-slate-300">
                        {r.provider}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            r.status === 'Chronic' || r.status === 'Active'
                              ? (r.category_code === 'allergy' || r.category === 'Allergy')
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRecord(r)
                            }}
                            title="View Record Details"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(r)
                            }}
                            title="Edit or Amend Record"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenArchive(r)
                            }}
                            title="Archive Record"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-colors"
                          >
                            <Archive size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Details Slide-Over / Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-3xl p-6 relative border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
                  {selectedRecord.category}
                </span>
                <h2 className="text-lg font-bold text-white">{selectedRecord.title}</h2>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-xs text-slate-400">Diagnosis / Event Date</p>
                  <p className="font-medium text-white mt-0.5">{selectedRecord.date}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Clinical Status</p>
                  <p className="font-medium text-white mt-0.5">{selectedRecord.status}</p>
                </div>
                {selectedRecord.icd10 && (
                  <div>
                    <p className="text-xs text-slate-400">ICD-10 Code</p>
                    <p className="font-mono text-blue-400 font-semibold mt-0.5">{selectedRecord.icd10}</p>
                  </div>
                )}
                {selectedRecord.severity && (
                  <div>
                    <p className="text-xs text-slate-400">Clinical Severity</p>
                    <p className="font-medium text-rose-400 mt-0.5">{selectedRecord.severity}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Documented Provider & Facility
                </h4>
                <p className="text-white font-medium">{selectedRecord.provider}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Clinical Summary & Treatment
                </h4>
                <p className="text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed text-xs">
                  {selectedRecord.description || 'No description provided.'}
                </p>
              </div>

              {selectedRecord.notes && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Physician Notes & Instructions
                  </h4>
                  <p className="text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5 text-xs leading-relaxed">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}

              {/* Linked Lab Card */}
              {selectedRecord.lab_result_id && (
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-medium text-teal-200">
                      Linked Diagnostic Laboratory Biomarkers Available
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedRecord(null)
                      navigate('/patient/labs')
                    }}
                    className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                  >
                    View in Labs →
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord
                    setSelectedRecord(null)
                    handleOpenEdit(rec)
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit2 size={13} /> Edit / Amend
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rec = selectedRecord
                    setSelectedRecord(null)
                    handleOpenArchive(rec)
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-amber-500/10 text-amber-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Archive size={13} /> Archive
                </button>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Helper Modals ──────────────────────────────────────────────────── */}
      <AddRecordModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newRec) => {
          setRecords((prev) => [newRec, ...prev])
          success('Record Added', `${newRec.title} successfully added to your health record.`)
        }}
      />

      <EditRecordModal
        isOpen={isEditModalOpen}
        record={recordToEdit}
        onClose={() => {
          setIsEditModalOpen(false)
          setRecordToEdit(null)
        }}
        onSuccess={(updatedRec) => {
          setRecords((prev) => prev.map((r) => (r.id === updatedRec.id ? updatedRec : r)))
          if (selectedRecord?.id === updatedRec.id) {
            setSelectedRecord(updatedRec)
          }
          success('Record Updated', `${updatedRec.title} updated successfully.`)
        }}
      />

      <DeleteRecordModal
        isOpen={isDeleteModalOpen}
        record={recordToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setRecordToDelete(null)
        }}
        onSuccess={(archivedId) => {
          setRecords((prev) => prev.filter((r) => r.id !== archivedId))
          if (selectedRecord?.id === archivedId) {
            setSelectedRecord(null)
          }
          success('Record Archived', 'The medical record was safely archived to your version history.')
        }}
      />

      <RecordHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRecordRestored={() => {
          loadRecords()
        }}
      />

      <ClearRecordHistoryModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onSuccess={(mode) => {
          if (mode === 'clear_filters') {
            setSearchQuery('')
            setSelectedCategory('all')
            success('Filters Reset', 'Active search filters have been cleared.')
          } else if (mode === 'hide_archived') {
            setShowArchived(false)
            loadRecords()
            success('View Updated', 'Archived records are hidden from view.')
          } else {
            success('Request Submitted', 'Archival review request submitted to Health Information Management.')
          }
        }}
      />
    </div>
  )
}
