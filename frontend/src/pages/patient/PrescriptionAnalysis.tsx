import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload,
  FileText,
  Pill,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Sparkles,
  RefreshCw,
  Send,
  Bot,
  Search,
  Eye,
  Edit3,
  Trash2,
  Bell,
  Calendar,
  Info,
  ExternalLink,
  ClipboardList,
  Activity,
  Heart,
  Flag,
  Loader2,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
interface ExtractedItem {
  id?: string
  medication_name: string
  strength: string | null
  dosage: string | null
  route: string | null
  frequency: string | null
  duration: string | null
  instructions: string | null
  confidence_score: number
  is_uncertain: boolean
  uncertainty_reason: string | null
  patient_verified: boolean
  patient_notes?: string | null
}

interface UploadResult {
  upload_id: string
  file_name: string
  file_size_bytes: number
  status: string
  raw_ocr_preview: string | null
  extracted_items: ExtractedItem[]
  message: string
}

interface AnalysisReport {
  id: string
  upload_id: string | null
  patient_id: string
  summary_data: Record<string, any>
  medication_guidance: Record<string, any>[]
  next_steps: Record<string, any>
  safety_review: Record<string, any>
  review_status: string
  reviewed_by_id: string | null
  reviewed_at: string | null
  review_notes: string | null
  ai_provider: string
  created_at: string
  updated_at: string
}

interface MedicationReminder {
  id: string
  medication_name: string
  dosage: string
  time_of_day: string
  frequency: string
  instructions: string | null
  is_active: boolean
}

type WorkflowStep = 'upload' | 'verify' | 'analyzing' | 'results' | 'history'

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PrescriptionAnalysis() {
  const { user } = useAuth()

  // Workflow state
  const [step, setStep] = useState<WorkflowStep>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [editableItems, setEditableItems] = useState<ExtractedItem[]>([])

  // Manual entry
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualItems, setManualItems] = useState<ExtractedItem[]>([{
    medication_name: '', strength: null, dosage: null, route: 'Oral',
    frequency: null, duration: null, instructions: null,
    confidence_score: 1.0, is_uncertain: false, uncertainty_reason: null,
    patient_verified: true,
  }])

  // Analysis results
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [reminders, setReminders] = useState<MedicationReminder[]>([])

  // History
  const [historyReports, setHistoryReports] = useState<AnalysisReport[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Chat
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string; is_emergency?: boolean}>>([])
  const [isChatting, setIsChatting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load History ───────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const res = await api.get('/api/v1/prescription-analysis/reports')
      setHistoryReports(res.data)
    } catch {
      // Fallback empty
      setHistoryReports([])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (step === 'history') loadHistory()
  }, [step, loadHistory])

  // ── File Upload ────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setError(null)
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowed.includes(file.type)) {
      setError('Invalid file type. Please upload a PDF, JPG, or PNG file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90))
      }, 200)

      const res = await api.post('/api/v1/prescription-analysis/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadResult(res.data)
      setEditableItems(res.data.extracted_items)
      setTimeout(() => setStep('verify'), 500)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Upload failed. Please try again.'
      setError(msg)
    } finally {
      setIsUploading(false)
    }
  }

  // ── Manual Entry Submit ────────────────────────────────────────────────
  const handleManualSubmit = async () => {
    const validItems = manualItems.filter(it => it.medication_name.trim())
    if (validItems.length === 0) {
      setError('Please enter at least one medication name.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const res = await api.post('/api/v1/prescription-analysis/manual-entry', {
        items: validItems.map(it => ({
          medication_name: it.medication_name,
          strength: it.strength,
          dosage: it.dosage,
          route: it.route || 'Oral',
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
        })),
      })

      setUploadResult(res.data)
      setEditableItems(res.data.extracted_items)
      setStep('verify')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit prescription details.')
    } finally {
      setIsUploading(false)
    }
  }

  // ── Confirm & Analyze ──────────────────────────────────────────────────
  const handleConfirmAndAnalyze = async () => {
    if (!uploadResult) return
    setIsAnalyzing(true)
    setStep('analyzing')
    setError(null)

    try {
      // Confirm items first
      await api.put(`/api/v1/prescription-analysis/uploads/${uploadResult.upload_id}/items`, {
        items: editableItems.map(it => ({
          medication_name: it.medication_name,
          strength: it.strength,
          dosage: it.dosage,
          route: it.route || 'Oral',
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
          patient_verified: true,
        })),
      })

      // Run analysis
      const res = await api.post(`/api/v1/prescription-analysis/uploads/${uploadResult.upload_id}/analyze`)
      setReport(res.data)

      // Load reminders
      try {
        const remRes = await api.get(`/api/v1/prescription-analysis/reports/${res.data.id}/reminders`)
        setReminders(remRes.data)
      } catch { /* ok */ }

      setStep('results')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Analysis failed. The AI service may be unavailable.')
      setStep('verify')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────
  const handleChat = async () => {
    if (!report || !chatMessage.trim()) return
    const q = chatMessage.trim()
    setChatMessages(prev => [...prev, { role: 'patient', content: q }])
    setChatMessage('')
    setIsChatting(true)

    try {
      const res = await api.post(`/api/v1/prescription-analysis/reports/${report.id}/chat`, {
        message: q,
      })
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        is_emergency: res.data.is_emergency,
      }])
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I am unable to respond right now. Please consult your pharmacist or prescribing clinician for guidance.',
      }])
    } finally {
      setIsChatting(false)
    }
  }

  // ── Flag for Review ────────────────────────────────────────────────────
  const handleFlagForReview = async () => {
    if (!report) return
    try {
      const res = await api.patch(`/api/v1/prescription-analysis/reports/${report.id}/flag-review`)
      setReport(res.data)
    } catch { /* ok */ }
  }

  // ── Toggle Reminder ────────────────────────────────────────────────────
  const handleToggleReminder = async (reminderId: string) => {
    try {
      const res = await api.patch(`/api/v1/prescription-analysis/reminders/${reminderId}/toggle`)
      setReminders(prev => prev.map(r => r.id === reminderId ? res.data : r))
    } catch { /* ok */ }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  // ── Restart ────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setStep('upload')
    setUploadResult(null)
    setEditableItems([])
    setReport(null)
    setReminders([])
    setChatMessages([])
    setError(null)
    setShowManualEntry(false)
    setManualItems([{
      medication_name: '', strength: null, dosage: null, route: 'Oral',
      frequency: null, duration: null, instructions: null,
      confidence_score: 1.0, is_uncertain: false, uncertainty_reason: null,
      patient_verified: true,
    }])
  }

  // ── View History Report ────────────────────────────────────────────────
  const viewHistoryReport = async (reportId: string) => {
    try {
      const res = await api.get(`/api/v1/prescription-analysis/reports/${reportId}`)
      setReport(res.data)
      try {
        const remRes = await api.get(`/api/v1/prescription-analysis/reports/${reportId}/reminders`)
        setReminders(remRes.data)
      } catch { /* ok */ }
      try {
        const chatRes = await api.get(`/api/v1/prescription-analysis/reports/${reportId}/chat`)
        if (Array.isArray(chatRes.data)) {
          setChatMessages(chatRes.data.map((m: any) => ({
            role: m.role,
            content: m.content,
            is_emergency: m.is_emergency,
          })))
        }
      } catch { /* ok */ }
      setStep('results')
    } catch {
      setError('Could not load report.')
    }
  }

  // ── Delete History Report ──────────────────────────────────────────────
  const handleDeleteReport = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await api.delete(`/api/v1/prescription-analysis/reports/${reportId}`)
      if (report?.id === reportId) {
        setReport(null)
        setStep('upload')
      }
      setHistoryReports(prev => prev.filter(r => r.id !== reportId))
    } catch (err) {
      console.error('Delete report failed:', err)
      alert('Could not delete prescription analysis.')
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/20">
              <ClipboardList size={22} />
            </span>
            Prescription Analysis
          </h1>
          <p className="page-subtitle">
            Upload or enter your prescription for AI-powered medication guidance and safety review
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {step !== 'upload' && step !== 'history' && (
            <button onClick={handleRestart}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5">
              <RefreshCw size={13} /> New Analysis
            </button>
          )}
          <button onClick={() => setStep(step === 'history' ? 'upload' : 'history')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              step === 'history'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}>
            <Clock size={13} /> {step === 'history' ? 'Back' : 'History'}
          </button>
        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-start gap-3 text-xs text-amber-200/80">
        <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
        <div>
          <strong className="text-amber-300">Educational Information Only:</strong>{' '}
          AI-generated analysis is for educational purposes and does not replace professional medical advice.
          Always consult your prescribing clinician or pharmacist before making medication changes.
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Progress Steps ─────────────────────────────────────────── */}
      {step !== 'history' && (
        <div className="flex items-center gap-2 text-xs">
          {(['upload', 'verify', 'analyzing', 'results'] as WorkflowStep[]).map((s, i) => {
            const labels = ['Upload', 'Verify', 'Analyzing', 'Results']
            const icons = [Upload, Eye, Sparkles, CheckCircle2]
            const Icon = icons[i]
            const isActive = s === step
            const isPast = ['upload', 'verify', 'analyzing', 'results'].indexOf(step) > i
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isPast ? 'bg-violet-400' : 'bg-white/10'}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  isActive ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' :
                  isPast ? 'text-violet-400' : 'text-slate-500'
                }`}>
                  <Icon size={13} />
                  <span className="font-semibold">{labels[i]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          STEP 1: UPLOAD
          ═════════════════════════════════════════════════════════════════ */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Upload Zone */}
            {!showManualEntry && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`glass p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center ${
                  isDragging
                    ? 'border-violet-400 bg-violet-500/10 scale-[1.01]'
                    : 'border-white/10 hover:border-violet-400/40 hover:bg-white/3'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange} className="hidden" />

                {isUploading ? (
                  <div className="space-y-4">
                    <Loader2 size={40} className="mx-auto text-violet-400 animate-spin" />
                    <p className="text-sm text-slate-300 font-medium">Uploading and extracting...</p>
                    <div className="w-64 mx-auto h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">{uploadProgress}% complete</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
                      <Upload size={28} className="text-violet-400" />
                    </div>
                    <p className="text-base font-semibold text-slate-200 mb-1">
                      Drag & drop your prescription here
                    </p>
                    <p className="text-xs text-slate-400 mb-3">
                      or click to browse files
                    </p>
                    <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-white/5">PDF</span>
                      <span className="px-2 py-0.5 rounded bg-white/5">JPG</span>
                      <span className="px-2 py-0.5 rounded bg-white/5">PNG</span>
                      <span className="text-slate-600">• Max 10 MB</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Manual Entry */}
            {showManualEntry && (
              <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Edit3 size={16} className="text-violet-400" /> Manual Prescription Entry
                  </h2>
                  <button onClick={() => setShowManualEntry(false)}
                    className="text-slate-400 hover:text-white text-xs">Cancel</button>
                </div>

                {manualItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-white/3 border border-white/5">
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-400 block mb-1">Medication Name *</label>
                      <input
                        value={item.medication_name}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], medication_name: e.target.value }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. Amoxicillin"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Strength</label>
                      <input
                        value={item.strength || ''}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], strength: e.target.value || null }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. 500mg"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Dosage</label>
                      <input
                        value={item.dosage || ''}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], dosage: e.target.value || null }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. 1 tablet"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Frequency</label>
                      <input
                        value={item.frequency || ''}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], frequency: e.target.value || null }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. Twice daily"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Duration</label>
                      <input
                        value={item.duration || ''}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], duration: e.target.value || null }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. 7 days"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-2">
                      <label className="text-[11px] text-slate-400 block mb-1">Instructions</label>
                      <input
                        value={item.instructions || ''}
                        onChange={e => {
                          const newItems = [...manualItems]
                          newItems[idx] = { ...newItems[idx], instructions: e.target.value || null }
                          setManualItems(newItems)
                        }}
                        placeholder="e.g. Take with food"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    {manualItems.length > 1 && (
                      <div className="flex items-end">
                        <button onClick={() => setManualItems(manualItems.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-3">
                  <button onClick={() => setManualItems([...manualItems, {
                    medication_name: '', strength: null, dosage: null, route: 'Oral',
                    frequency: null, duration: null, instructions: null,
                    confidence_score: 1.0, is_uncertain: false, uncertainty_reason: null,
                    patient_verified: true,
                  }])}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                    <Plus size={13} /> Add Another Medication
                  </button>

                  <button onClick={handleManualSubmit} disabled={isUploading}
                    className="ml-auto btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2">
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                    Continue to Verify
                  </button>
                </div>
              </div>
            )}

            {/* Toggle */}
            {!showManualEntry && !isUploading && (
              <div className="text-center">
                <button onClick={() => setShowManualEntry(true)}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1.5 mx-auto">
                  <Edit3 size={13} /> Or enter prescription details manually
                </button>
              </div>
            )}
          </div>

          {/* Info Sidebar */}
          <div className="space-y-4">
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield size={14} className="text-violet-400" /> How It Works
              </h3>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'Upload your prescription document or type details manually' },
                  { num: '2', text: 'Review and verify the extracted medication information' },
                  { num: '3', text: 'Our AI analyzes your prescription for safety and guidance' },
                  { num: '4', text: 'Review your personalized health guidance report' },
                ].map(s => (
                  <div key={s.num} className="flex items-start gap-3 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-[10px] shrink-0">
                      {s.num}
                    </div>
                    <span className="text-slate-300 leading-relaxed">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400" /> Important
              </h3>
              <ul className="space-y-2 text-xs text-slate-400 list-none">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  Never stop or change medication without consulting your doctor
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  For emergencies call 911 immediately
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  AI analysis is educational, not a clinical diagnosis
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          STEP 2: VERIFY EXTRACTED ITEMS
          ═════════════════════════════════════════════════════════════════ */}
      {step === 'verify' && (
        <div className="space-y-5">
          {/* OCR Preview */}
          {uploadResult?.raw_ocr_preview && (
            <div className="glass p-4 rounded-2xl border border-white/10">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText size={14} className="text-blue-400" /> Extracted Text Preview
              </h3>
              <div className="p-3 rounded-xl bg-white/3 border border-white/5 text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                {uploadResult.raw_ocr_preview}
              </div>
            </div>
          )}

          {/* Editable Items */}
          <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye size={16} className="text-violet-400" /> Verify Extracted Medications
              </h2>
              <span className="text-xs text-slate-400">
                {editableItems.length} medication{editableItems.length !== 1 ? 's' : ''} found
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Please review the extracted information below. Edit any incorrect details before proceeding to analysis.
            </p>

            {editableItems.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border space-y-3 ${
                item.is_uncertain
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-white/3 border-white/5'
              }`}>
                {item.is_uncertain && (
                  <div className="flex items-center gap-2 text-xs text-amber-300">
                    <AlertTriangle size={13} />
                    <span>Uncertain: {item.uncertainty_reason || 'Some details may need verification'}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Medication Name</label>
                    <input value={item.medication_name}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], medication_name: e.target.value }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Strength</label>
                    <input value={item.strength || ''}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], strength: e.target.value || null }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Dosage</label>
                    <input value={item.dosage || ''}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], dosage: e.target.value || null }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Frequency</label>
                    <input value={item.frequency || ''}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], frequency: e.target.value || null }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Duration</label>
                    <input value={item.duration || ''}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], duration: e.target.value || null }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Instructions</label>
                    <input value={item.instructions || ''}
                      onChange={e => {
                        const newItems = [...editableItems]
                        newItems[idx] = { ...newItems[idx], instructions: e.target.value || null }
                        setEditableItems(newItems)
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500/50" />
                  </div>
                </div>

                {item.confidence_score < 1 && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                        style={{ width: `${item.confidence_score * 100}%` }} />
                    </div>
                    <span>Confidence: {Math.round(item.confidence_score * 100)}%</span>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setStep('upload')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5">
                ← Back to Upload
              </button>
              <button onClick={handleConfirmAndAnalyze} disabled={isAnalyzing}
                className="btn-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-2">
                <Sparkles size={14} /> Confirm & Run AI Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          STEP 3: ANALYZING (loading)
          ═════════════════════════════════════════════════════════════════ */}
      {step === 'analyzing' && (
        <div className="glass p-16 rounded-2xl border border-white/10 text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles size={36} className="text-violet-400 animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-white">Analyzing Your Prescription</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Our AI is reviewing your medications, checking for safety alerts, cross-referencing with your medical profile,
            and preparing your personalized health guidance report.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin text-violet-400" />
            <span>This typically takes 5–15 seconds...</span>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          STEP 4: RESULTS
          ═════════════════════════════════════════════════════════════════ */}
      {step === 'results' && report && (
        <div className="space-y-5">
          {/* Report Header */}
          <div className="glass p-5 rounded-2xl border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Analysis Complete</h2>
                <p className="text-xs text-slate-400">
                  Generated {new Date(report.created_at).toLocaleDateString()} • {report.ai_provider}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                report.review_status === 'reviewed_by_clinician'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : report.review_status === 'flagged_for_pharmacist'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
              }`}>
                {report.review_status.replace(/_/g, ' ')}
              </span>
              {report.review_status === 'pending_review' && (
                <button onClick={handleFlagForReview}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors flex items-center gap-1">
                  <Flag size={10} /> Flag for Pharmacist Review
                </button>
              )}
              <button
                onClick={() => handleDeleteReport(report.id)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-semibold hover:bg-rose-500/20 transition-colors flex items-center gap-1"
                title="Delete this analysis report"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-5">
              {/* Prescription Summary */}
              <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-400" /> Prescription Summary
                </h3>

                {/* Extracted Document Metadata Banner */}
                {(report.summary_data?.patient_info_extracted?.name ||
                  report.summary_data?.prescribing_doctor_info?.name ||
                  report.summary_data?.prescription_date) && (
                  <div className="p-3 rounded-xl bg-white/4 border border-white/6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-2">
                    {report.summary_data?.patient_info_extracted?.name && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient</span>
                        <span className="text-white font-medium">{report.summary_data.patient_info_extracted.name}</span>
                      </div>
                    )}
                    {report.summary_data?.prescribing_doctor_info?.name && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Prescribing Doctor</span>
                        <span className="text-white font-medium">{report.summary_data.prescribing_doctor_info.name}</span>
                        {report.summary_data.prescribing_doctor_info.clinic_name && (
                          <span className="text-slate-400 block text-[10px]">{report.summary_data.prescribing_doctor_info.clinic_name}</span>
                        )}
                      </div>
                    )}
                    {report.summary_data?.prescription_date && (
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Prescription Date</span>
                        <span className="text-white font-medium">{report.summary_data.prescription_date}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings Written on Document */}
                {report.summary_data?.warnings_on_document && report.summary_data.warnings_on_document.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1 mb-2">
                    <div className="font-bold flex items-center gap-1.5 text-amber-300">
                      <AlertTriangle size={13} /> Written Warnings on Document:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-100/90 pl-1">
                      {report.summary_data.warnings_on_document.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {report.summary_data?.plain_language_summary || 'No summary available. Consult your pharmacist for a detailed explanation of your prescription.'}
                </p>
                {report.summary_data?.uncertain_information && report.summary_data.uncertain_information.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
                    <strong>⚠ Uncertain Information:</strong>{' '}
                    {report.summary_data.uncertain_information.join('; ')}
                    <br />Please verify these details directly with your pharmacist or prescribing clinician.
                  </div>
                )}
              </div>

              {/* Medication Guidance Cards */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Pill size={14} className="text-teal-400" /> Medication Guidance
                </h3>
                {report.medication_guidance?.length > 0 ? (
                  report.medication_guidance.map((med: any, idx: number) => (
                    <MedicationCard key={idx} med={med} />
                  ))
                ) : (
                  <div className="glass p-6 rounded-2xl border border-white/10 text-center text-xs text-slate-400">
                    No medication guidance available. Please contact your pharmacist.
                  </div>
                )}
              </div>

              {/* Safety Review */}
              <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Shield size={14} className="text-rose-400" /> Medication Safety Review
                </h3>

                {report.safety_review?.interactions?.length > 0 ? (
                  report.safety_review.interactions.map((interaction: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-xl border text-xs space-y-2 ${
                      interaction.severity === 'CRITICAL' || interaction.severity === 'High'
                        ? 'bg-rose-500/8 border-rose-500/20'
                        : 'bg-amber-500/8 border-amber-500/20'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">
                          {interaction.drugs?.join(' ↔ ') || interaction.medication || 'Drug Interaction'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          interaction.severity === 'CRITICAL' || interaction.severity === 'High'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {interaction.severity || 'Moderate'}
                        </span>
                      </div>
                      <p className="text-slate-300">{interaction.clinical_effect || interaction.effect}</p>
                      {interaction.recommendation && (
                        <p className="text-teal-300 font-medium">
                          Recommendation: {interaction.recommendation}
                        </p>
                      )}
                      {interaction.source && (
                        <p className="text-slate-500 text-[10px]">Source: {interaction.source}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-center space-y-2">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-400" />
                    <p className="text-sm font-bold text-white">No Critical Interactions Detected</p>
                    <p className="text-xs text-emerald-300/80">
                      Based on available data. This is not a comprehensive check — consult your pharmacist for complete screening.
                    </p>
                  </div>
                )}

                {report.safety_review?.allergy_alerts?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-rose-300">Allergy Alerts</h4>
                    {report.safety_review.allergy_alerts.map((alert: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-500/8 border border-rose-500/20 text-xs text-rose-300">
                        <AlertTriangle size={12} className="inline mr-1" />
                        {typeof alert === 'string' ? alert : alert.message || alert.description}
                      </div>
                    ))}
                  </div>
                )}

                {report.safety_review?.requires_pharmacist_review && (
                  <div className="p-3 rounded-xl bg-violet-500/8 border border-violet-500/15 text-xs text-violet-300 flex items-center gap-2">
                    <Info size={14} />
                    <span>This analysis has been flagged for pharmacist or clinician review before acting on any findings.</span>
                  </div>
                )}
              </div>

              {/* Chat */}
              <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Bot size={14} className="text-blue-400" /> Ask Follow-Up Questions
                </h3>
                <p className="text-xs text-slate-500">
                  Ask questions about your analyzed prescription. For emergencies, call 911.
                </p>

                {chatMessages.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto p-2">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-3 rounded-xl text-xs ${
                        msg.role === 'patient'
                          ? 'bg-violet-600/20 text-white ml-8'
                          : msg.is_emergency
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-200 mr-8'
                          : 'bg-white/5 border border-white/5 text-slate-200 mr-8'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={e => { e.preventDefault(); handleChat() }} className="flex gap-2">
                  <input
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    placeholder="Ask about your medication, dosage, side effects..."
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                  />
                  <button type="submit" disabled={!chatMessage.trim() || isChatting}
                    className="btn-primary px-4 py-2.5 rounded-xl disabled:opacity-40 flex items-center gap-1.5 text-xs">
                    {isChatting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Next Steps Section */}
              <div className="glass p-5 rounded-2xl border border-white/10 space-y-3.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-emerald-400" /> Your Next Steps
                </h3>
                {report.next_steps?.summary && (
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {report.next_steps.summary}
                  </p>
                )}
                {report.next_steps?.checklist?.length > 0 ? (
                  <div className="space-y-2">
                    {report.next_steps.checklist.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{typeof item === 'string' ? item : item.task || item.text || item.action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Follow your prescriber's instructions and contact them with any questions.</p>
                )}

                {/* Practical Actions */}
                {report.next_steps?.practical_actions?.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-[11px] font-bold text-teal-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Practical Actions:
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                      {report.next_steps.practical_actions.map((act: string, i: number) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Doctor or Pharmacist Questions */}
                {report.next_steps?.doctor_questions?.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="text-[11px] font-bold text-blue-400 flex items-center gap-1">
                      <HelpCircle size={12} /> Questions for Your Doctor or Pharmacist:
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                      {report.next_steps.doctor_questions.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Clarification Needed */}
                {report.next_steps?.clarification_needed && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                    <strong>Clarification:</strong> {report.next_steps.clarification_needed}
                  </div>
                )}

                {/* Emergency Prompt Care Triggers */}
                {report.next_steps?.seek_prompt_care_reasons?.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-200 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-rose-300">
                      <AlertTriangle size={11} /> Seek Prompt Care (Call 911) If:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-rose-100/90 pl-1">
                      {report.next_steps.seek_prompt_care_reasons.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Medication Reminders */}
              {reminders.length > 0 && (
                <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Bell size={14} className="text-blue-400" /> Medication Reminders
                  </h3>
                  <div className="space-y-2">
                    {reminders.map(rem => (
                      <div key={rem.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 border border-white/5">
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{rem.medication_name}</div>
                          <div className="text-[10px] text-slate-400">{rem.time_of_day} • {rem.frequency}</div>
                        </div>
                        <button onClick={() => handleToggleReminder(rem.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            rem.is_active ? 'bg-emerald-500' : 'bg-white/10'
                          }`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                            rem.is_active ? 'left-4' : 'left-0.5'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-Up */}
              {report.next_steps?.follow_up_recommended && (
                <div className="glass p-5 rounded-2xl border border-white/10 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar size={14} className="text-violet-400" /> Follow-Up
                  </h3>
                  <p className="text-xs text-slate-300">
                    {report.next_steps.follow_up_recommended}
                  </p>
                </div>
              )}

              {/* AI Label */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 text-xs text-slate-500 space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <Sparkles size={12} /> AI-Generated Content
                </div>
                <p className="leading-relaxed">
                  This report was generated by MediCare AI for educational purposes. It does not constitute medical advice.
                  Always verify with your healthcare provider.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════
          HISTORY
          ═════════════════════════════════════════════════════════════════ */}
      {step === 'history' && (
        <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-violet-400" /> Analysis History
          </h2>

          {isLoadingHistory ? (
            <div className="text-center py-8">
              <Loader2 size={24} className="mx-auto animate-spin text-violet-400" />
              <p className="text-xs text-slate-400 mt-2">Loading history...</p>
            </div>
          ) : historyReports.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <ClipboardList size={36} className="mx-auto text-slate-600" />
              <p className="text-sm text-slate-400">No prescription analyses yet</p>
              <p className="text-xs text-slate-500">Upload a prescription to get started</p>
              <button onClick={() => setStep('upload')}
                className="btn-primary px-4 py-2 text-xs font-semibold mt-3">
                Start New Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {historyReports.map(r => (
                <div key={r.id}
                  onClick={() => viewHistoryReport(r.id)}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 hover:border-violet-500/20 cursor-pointer transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                      <Pill size={16} className="text-violet-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        {r.medication_guidance?.length || 0} medication{(r.medication_guidance?.length || 0) !== 1 ? 's' : ''} analyzed
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(r.created_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      r.review_status === 'reviewed_by_clinician'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : r.review_status === 'flagged_for_pharmacist'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {r.review_status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight size={14} className="text-slate-500 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════
   MEDICATION CARD SUB-COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function MedicationCard({ med }: { med: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/3 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-teal-500/20 flex items-center justify-center">
            <Pill size={16} className="text-teal-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">{med.medication || med.medication_name || 'Medication'}</div>
            <div className="text-[10px] text-slate-400">
              {med.common_uses || med.purpose || 'Consult prescriber for information'}
            </div>
          </div>
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {med.instructions && (
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Instructions</span>
              <p className="text-xs text-slate-200 mt-1">{med.instructions}</p>
            </div>
          )}
          {med.precautions && (
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Precautions</span>
              <p className="text-xs text-amber-300 mt-1">{med.precautions}</p>
            </div>
          )}
          {med.side_effects && (
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Possible Side Effects</span>
              <p className="text-xs text-slate-300 mt-1">{med.side_effects}</p>
            </div>
          )}
          {med.warning_signs && (
            <div>
              <span className="text-[10px] font-bold uppercase text-rose-400">⚠ Warning Signs Requiring Medical Attention</span>
              <p className="text-xs text-rose-300 mt-1">{med.warning_signs}</p>
            </div>
          )}
          {med.pharmacist_questions && (
            <div>
              <span className="text-[10px] font-bold uppercase text-violet-400">Questions for Your Pharmacist</span>
              <p className="text-xs text-violet-300 mt-1">{med.pharmacist_questions}</p>
            </div>
          )}

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 flex items-center gap-1">
            <Sparkles size={10} /> AI-generated educational information — verify with your healthcare provider
          </div>
        </div>
      )}
    </div>
  )
}
