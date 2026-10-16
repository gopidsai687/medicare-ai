import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  Send,
  Bot,
  RefreshCw,
  Info,
  ShieldAlert,
  ArrowRight,
  Eye,
  FileSearch,
  Activity,
  Layers,
  HelpCircle,
  ExternalLink,
  Loader2,
  X,
  FileCheck2,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */
interface Finding {
  name: string
  result_value: string
  unit?: string | null
  reference_range?: string | null
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL' | 'CRITICAL' | 'UNKNOWN'
  clinical_significance?: string | null
  is_uncertain: boolean
  uncertainty_reason?: string | null
}

interface Terminology {
  term: string
  simple_explanation: string
  context?: string | null
}

interface AbnormalFinding {
  test_name: string
  result_value: string
  reference_range?: string | null
  simple_explanation: string
  clinical_significance?: string | null
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
}

interface NextSteps {
  summary: string
  practical_actions: string[]
  doctor_questions: string[]
  clarification_needed?: string | null
  seek_prompt_care_reasons: string[]
  urgency_level: 'ROUTINE' | 'PROMPT_EVALUATION' | 'EMERGENCY'
  disclaimer: string
}

interface MedicalReport {
  id: string
  upload_id?: string | null
  patient_id: string
  document_type: string
  patient_info: Record<string, any>
  facility_info: Record<string, any>
  report_date?: string | null
  extracted_findings: Finding[]
  terminology_explanations: Terminology[]
  abnormal_findings_explained: AbnormalFinding[]
  key_findings_summary: string
  what_report_establishes: string[]
  what_report_does_not_establish: string[]
  missing_information: string[]
  questions_for_doctor: string[]
  next_steps: NextSteps
  confidence_score: number
  is_uncertain: boolean
  uncertainty_reason?: string | null
  review_status: string
  reviewed_by_id?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  ai_provider: string
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  role: 'patient' | 'assistant'
  content: string
  is_emergency: boolean
  created_at: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   SAMPLE MOCK DATA (FOR QUICK TESTING DEMONSTRATION)
   ═══════════════════════════════════════════════════════════════════════════ */
const SAMPLE_CBC_TEXT = `METROHEALTH CLINICAL LABORATORY
PATIENT NAME: Robert Johnson
DOB: 04/12/1982    MRN: MRN-94821
ORDERING PHYSICIAN: Dr. Sarah Chen, MD
COLLECTION DATE: 10/10/2026

COMPLETE BLOOD COUNT WITH DIFFERENTIAL
Test Name                       Result      Units       Reference Interval    Flag
White Blood Cell Count (WBC)    13.8        x10^3/uL    4.5 - 11.0            HIGH
Red Blood Cell Count (RBC)      4.9         x10^6/uL    4.3 - 5.9             NORMAL
Hemoglobin (Hgb)                14.2        g/dL        13.5 - 17.5           NORMAL
Hematocrit (Hct)                43.0        %           41.0 - 50.0           NORMAL
Platelet Count                  130         x10^3/uL    150 - 450             LOW
Neutrophils                     78          %           40 - 75               HIGH
Lymphocytes                     16          %           20 - 45               LOW

IMPRESSION: Mild leukocytosis with relative neutrophilia. Mild thrombocytopenia noted.`

const SAMPLE_CMP_TEXT = `VALLEY REGIONAL HEALTH SYSTEM - DIAGNOSTIC SERVICES
PATIENT: Maria Gonzalez
DOB: 08/21/1975    MRN: MRN-55201
ORDERING CLINICIAN: Dr. James Kim, MD
SPECIMEN DATE: 10/08/2026

COMPREHENSIVE METABOLIC PANEL (CMP)
Test Name                       Result      Units       Reference Interval    Flag
Fasting Blood Glucose           138         mg/dL       70 - 99               HIGH
Serum Creatinine                1.4         mg/dL       0.7 - 1.3             HIGH
Estimated GFR (eGFR)            54          mL/min      > 60                  LOW
Blood Urea Nitrogen (BUN)       24          mg/dL       7 - 20                HIGH
Sodium                          140         mmol/L      136 - 145             NORMAL
Potassium                       4.4         mmol/L      3.5 - 5.1             NORMAL
Total Bilirubin                 0.8         mg/dL       0.1 - 1.2             NORMAL
Alanine Aminotransferase (ALT)  58          U/L         7 - 56                HIGH

NOTE: Fasting status confirmed (12 hours). Patient advised to follow up regarding renal & glycemic findings.`

export default function MedicalReportAnalysis() {
  const { user } = useAuth()
  const location = useLocation()
  const routeReportId = (location.state as any)?.reportId
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'analyzer' | 'history'>('analyzer')

  // Upload & processing state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analysisStep, setAnalysisStep] = useState<string>('')

  // Report state
  const [currentReport, setCurrentReport] = useState<MedicalReport | null>(null)
  const [findingsFilter, setFindingsFilter] = useState<'all' | 'abnormal' | 'normal'>('all')
  const [showRawOcr, setShowRawOcr] = useState(false)

  // Reports history state
  const [reportsHistory, setReportsHistory] = useState<MedicalReport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Follow-up chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  /* ── Load Reports History ──────────────────────────────────────────────── */
  const fetchReportsHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await api.get('/api/v1/medical-report-analysis/reports')
      if (Array.isArray(res.data)) {
        setReportsHistory(res.data)
      }
    } catch (err) {
      console.warn('Could not load report history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchReportsHistory()
  }, [fetchReportsHistory])

  useEffect(() => {
    if (routeReportId) {
      async function loadReportFromRoute() {
        try {
          const res = await api.get(`/api/v1/medical-report-analysis/reports/${routeReportId}`)
          if (res.data) {
            setCurrentReport(res.data)
            setUploadStatus('complete')
            setActiveTab('analyzer')
          }
        } catch (err) {
          console.warn('Could not load specific report from route state:', err)
        }
      }
      loadReportFromRoute()
    }
  }, [routeReportId])

  /* ── Load Chat History When Report Changes ────────────────────────────── */
  useEffect(() => {
    if (!currentReport) {
      setChatMessages([])
      return
    }

    const reportId = currentReport.id
    async function loadChat() {
      try {
        const res = await api.get(`/api/v1/medical-report-analysis/reports/${reportId}/chat`)
        if (Array.isArray(res.data)) {
          setChatMessages(res.data)
        }
      } catch (err) {
        console.warn('Could not fetch chat history:', err)
      }
    }
    loadChat()
  }, [currentReport])

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages, chatLoading])

  /* ── File Selection Handlers ───────────────────────────────────────────── */
  const handleFileSelect = (file: File) => {
    setUploadError(null)

    // Check size (<10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please upload a smaller file.`)
      return
    }

    // Check type
    const ext = (file?.name || '').split('.').pop()?.toLowerCase()
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
      setUploadError(`Unsupported file format '.${ext}'. Please upload a PDF, JPG, JPEG, or PNG document.`)
      return
    }

    setSelectedFile(file)
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreview(url)
    } else {
      setFilePreview(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  /* ── Upload & Analyze Execution ────────────────────────────────────────── */
  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return

    setUploadStatus('uploading')
    setUploadError(null)
    setAnalysisStep('Uploading document securely...')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      setUploadStatus('analyzing')
      setAnalysisStep('Performing optical text extraction (OCR & PDF parsing)...')

      const timer = setTimeout(() => {
        setAnalysisStep('Evaluating laboratory findings, reference ranges, and abnormal markers...')
      }, 1500)

      const timer2 = setTimeout(() => {
        setAnalysisStep('Translating medical terminology and compiling Personalized Next Steps...')
      }, 3000)

      const res = await api.post('/api/v1/medical-report-analysis/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      clearTimeout(timer)
      clearTimeout(timer2)

      setCurrentReport(res.data)
      setUploadStatus('complete')
      fetchReportsHistory()
    } catch (err: any) {
      console.error('Report analysis failed:', err)
      setUploadStatus('error')
      const msg = err.response?.data?.detail || 'Failed to process medical report document. Please try again with a clearer file.'
      setUploadError(msg)
    }
  }

  /* ── Test with Sample Report ───────────────────────────────────────────── */
  const handleLoadSample = (sampleType: 'cbc' | 'cmp') => {
    const text = sampleType === 'cbc' ? SAMPLE_CBC_TEXT : SAMPLE_CMP_TEXT
    const filename = sampleType === 'cbc' ? 'sample_cbc_blood_panel.pdf' : 'sample_cmp_metabolic_report.pdf'
    const blob = new Blob([text], { type: 'application/pdf' })
    const file = new File([blob], filename, { type: 'application/pdf' })
    handleFileSelect(file)
  }

  /* ── Delete Report ─────────────────────────────────────────────────────── */
  const handleDeleteReport = async (reportId: string) => {
    try {
      await api.delete(`/api/v1/medical-report-analysis/reports/${reportId}`)
      if (currentReport?.id === reportId) {
        setCurrentReport(null)
        setSelectedFile(null)
        setFilePreview(null)
        setUploadStatus('idle')
      }
      setReportsHistory((prev) => prev.filter((r) => r.id !== reportId))
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Delete report failed:', err)
      alert('Could not delete report analysis.')
    }
  }

  /* ── Follow-up Chat Message ────────────────────────────────────────────── */
  const handleSendChatMessage = async (msgText?: string) => {
    const textToSend = msgText || chatInput
    if (!textToSend.trim() || !currentReport || chatLoading) return

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'patient',
      content: textToSend.trim(),
      is_emergency: false,
      created_at: new Date().toISOString(),
    }

    setChatMessages((prev) => [...prev, tempUserMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await api.post(`/api/v1/medical-report-analysis/reports/${currentReport.id}/chat`, {
        message: textToSend.trim(),
      })

      const botReply: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        content: res.data.reply,
        is_emergency: res.data.is_emergency,
        created_at: new Date().toISOString(),
      }
      setChatMessages((prev) => [...prev, botReply])
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I could not process your question at this moment. Please try again or consult your doctor.',
        is_emergency: false,
        created_at: new Date().toISOString(),
      }
      setChatMessages((prev) => [...prev, errorReply])
    } finally {
      setChatLoading(false)
    }
  }

  /* ── Filter Findings Table ─────────────────────────────────────────────── */
  const filteredFindings = currentReport?.extracted_findings.filter((f) => {
    if (findingsFilter === 'abnormal') return f.flag !== 'NORMAL'
    if (findingsFilter === 'normal') return f.flag === 'NORMAL'
    return true
  }) || []

  return (
    <div className="animate-fade-in-up" style={{ paddingBottom: 60 }}>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(20,184,166,0.25), rgba(49,130,244,0.25))',
              border: '1px solid rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileSearch size={22} style={{ color: '#2dd4bf' }} />
            </div>
            <div>
              <h1 className="page-title flex items-center gap-3">
                AI Medical Report Analyzer
                <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                  OCR & Lab Intelligence
                </span>
              </h1>
              <p className="page-subtitle">
                Upload laboratory test results, diagnostic reports, and imaging scans for plain-language explanations & guidance
              </p>
            </div>
          </div>

          {/* Navigation Tab Toggle */}
          <div style={{ display: 'flex', background: 'rgba(15,32,64,0.7)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setActiveTab('analyzer')}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                background: activeTab === 'analyzer' ? '#3182f4' : 'transparent',
                color: activeTab === 'analyzer' ? 'white' : '#7a9ec2',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={14} />
              <span>Analyzer</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                background: activeTab === 'history' ? '#3182f4' : 'transparent',
                color: activeTab === 'history' ? 'white' : '#7a9ec2',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <Clock size={14} />
              <span>Saved Analyses ({reportsHistory.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mandatory Medical Disclaimer Alert ───────────────────────────── */}
      <div className="glass-sm" style={{
        padding: '12px 16px', marginBottom: 24, borderRadius: 10,
        background: 'rgba(49,130,244,0.06)', border: '1px solid rgba(49,130,244,0.2)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Info size={18} style={{ color: '#57a3f9', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#9bb8d7', lineHeight: 1.4 }}>
          <strong>Medical Notice:</strong> This AI analyzer provides educational translations of medical documents to help you prepare for discussions with your healthcare provider. It does NOT provide clinical diagnoses or replace evaluation by a licensed physician.
        </p>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 1: ANALYZER & RESULTS VIEW
         ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'analyzer' && (
        <div>
          {/* ── Upload Section (If no report loaded or starting new) ───────── */}
          {!currentReport && (
            <div className="glass animate-fade-in-up" style={{ padding: 32, marginBottom: 28 }}>
              <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 24px' }}>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#e2eaf4', marginBottom: 8 }}>
                  Upload Your Medical Document
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#7a9ec2', lineHeight: 1.5 }}>
                  Support for multi-page PDFs, scanned reports, and laboratory photos (PNG, JPG, JPEG up to 10MB).
                  Our system extracts measurements, highlights flagged results, and explains medical terms in plain words.
                </p>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed #2dd4bf' : '2px dashed rgba(49,130,244,0.3)',
                  borderRadius: 16,
                  padding: '40px 24px',
                  textAlign: 'center',
                  background: isDragging ? 'rgba(20,184,166,0.08)' : 'rgba(15,32,64,0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  maxWidth: 680,
                  margin: '0 auto',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: 'rgba(49,130,244,0.15)', border: '1px solid rgba(49,130,244,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
                }}>
                  <Upload size={26} style={{ color: '#3182f4' }} />
                </div>

                <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#e2eaf4', marginBottom: 6 }}>
                  {selectedFile ? selectedFile.name : 'Click to browse or drag & drop medical document'}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#5a7a9e', margin: '0 0 16px' }}>
                  PDF, Scanned Documents, PNG, JPG (Max 10MB) • Multi-Page Extraction Supported
                </p>

                {selectedFile && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)',
                    borderRadius: 20, padding: '4px 14px', fontSize: '0.78rem', color: '#2dd4bf'
                  }}>
                    <FileCheck2 size={14} />
                    <span>Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setFilePreview(null); }}
                      style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {uploadError && (
                <div style={{
                  maxWidth: 680, margin: '16px auto 0', padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                  display: 'flex', alignItems: 'center', gap: 10, color: '#fb7185', fontSize: '0.82rem'
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 }}>
                <button
                  type="button"
                  disabled={!selectedFile || uploadStatus === 'analyzing' || uploadStatus === 'uploading'}
                  onClick={handleUploadAndAnalyze}
                  className="btn-primary"
                  style={{
                    padding: '12px 28px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8,
                    opacity: (!selectedFile || uploadStatus === 'analyzing') ? 0.6 : 1,
                  }}
                >
                  {uploadStatus === 'analyzing' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{analysisStep || 'Analyzing Document...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Run AI Report Analysis</span>
                    </>
                  )}
                </button>
              </div>

              {/* Try Sample Buttons */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 32, paddingTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#5a7a9e', display: 'block', marginBottom: 10 }}>
                  Or instantly test with real-world clinical test scenarios:
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('cbc')}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Activity size={14} style={{ color: '#2dd4bf' }} />
                    <span>Try Sample CBC Blood Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('cmp')}
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Layers size={14} style={{ color: '#3182f4' }} />
                    <span>Try Sample Metabolic (CMP) Panel</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Active Report Analysis View ───────────────────────────────── */}
          {currentReport && (
            <div className="animate-fade-in-up">
              {/* Report Header Card */}
              <div className="glass" style={{ padding: 24, marginBottom: 24, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className="badge badge-teal" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        {currentReport.document_type}
                      </span>
                      {currentReport.is_uncertain && (
                        <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                          Needs Verification
                        </span>
                      )}
                      <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                        Confidence: {(currentReport.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: '#e2eaf4', margin: '0 0 10px' }}>
                      Clinical Analysis & Findings Summary
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: '0.8rem', color: '#7a9ec2' }}>
                      {currentReport.patient_info?.name && (
                        <div><strong>Patient:</strong> {currentReport.patient_info.name}</div>
                      )}
                      {currentReport.facility_info?.ordering_physician && (
                        <div><strong>Ordering Clinician:</strong> {currentReport.facility_info.ordering_physician}</div>
                      )}
                      {currentReport.report_date && (
                        <div><strong>Specimen Date:</strong> {currentReport.report_date}</div>
                      )}
                      <div><strong>Analyzed on:</strong> {new Date(currentReport.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowRawOcr(!showRawOcr)}
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Eye size={14} />
                      <span>{showRawOcr ? 'Hide Raw Text' : 'View Extracted Text'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCurrentReport(null); setSelectedFile(null); setFilePreview(null); }}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Upload size={14} />
                      <span>Analyze Another File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReport(currentReport.id)}
                      className="btn-secondary"
                      style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}
                      title="Delete Report"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Raw OCR Text Dropdown */}
                {showRawOcr && (
                  <div style={{
                    marginTop: 18, padding: 14, borderRadius: 10,
                    background: 'rgba(5,12,26,0.6)', border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.78rem', fontFamily: 'monospace', color: '#9bb8d7',
                    maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap'
                  }}>
                    {currentReport.key_findings_summary}
                  </div>
                )}
              </div>

              {/* ── Key Findings Summary Card ─────────────────────────────── */}
              <div className="glass" style={{ padding: 24, marginBottom: 24, borderLeft: '4px solid #3182f4' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2eaf4', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Activity size={18} style={{ color: '#3182f4' }} />
                  <span>Executive Plain-Language Summary</span>
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#c3d5eb', lineHeight: 1.6, margin: 0 }}>
                  {currentReport.key_findings_summary}
                </p>
              </div>

              {/* ── Abnormal Findings Callout (If any) ────────────────────── */}
              {currentReport.abnormal_findings_explained.length > 0 && (
                <div className="glass" style={{
                  padding: 24, marginBottom: 24,
                  border: '1px solid rgba(244,63,94,0.3)',
                  background: 'linear-gradient(135deg, rgba(15,32,64,0.8), rgba(244,63,94,0.08))'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'rgba(244,63,94,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <ShieldAlert size={18} style={{ color: '#fb7185' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                        Flagged & Out-of-Range Results ({currentReport.abnormal_findings_explained.length})
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#fca5a5', margin: 0 }}>
                        Explained using the official reference intervals provided in your laboratory report
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    {currentReport.abnormal_findings_explained.map((abn, i) => (
                      <div key={i} className="glass-sm" style={{ padding: 16, border: '1px solid rgba(244,63,94,0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f87171' }}>
                            {abn.test_name}
                          </span>
                          <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
                            {abn.severity} ATTENTION
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#e2eaf4', marginBottom: 4 }}>
                          <strong>Measured Value:</strong> {abn.result_value} (Standard: {abn.reference_range})
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
                          {abn.simple_explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Extracted Findings & Measurements Table ────────────────── */}
              <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                      Extracted Laboratory Measurements & Findings ({currentReport.extracted_findings.length})
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#5a7a9e', margin: 0 }}>
                      Verbatim test measurements extracted from your uploaded document
                    </p>
                  </div>

                  {/* Filter tabs */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setFindingsFilter('all')}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: findingsFilter === 'all' ? '#3182f4' : 'rgba(255,255,255,0.06)',
                        color: findingsFilter === 'all' ? 'white' : '#7a9ec2',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      All ({currentReport.extracted_findings.length})
                    </button>
                    <button
                      onClick={() => setFindingsFilter('abnormal')}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: findingsFilter === 'abnormal' ? '#f43f5e' : 'rgba(255,255,255,0.06)',
                        color: findingsFilter === 'abnormal' ? 'white' : '#7a9ec2',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      Flagged ({currentReport.abnormal_findings_explained.length})
                    </button>
                    <button
                      onClick={() => setFindingsFilter('normal')}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                        background: findingsFilter === 'normal' ? '#10b981' : 'rgba(255,255,255,0.06)',
                        color: findingsFilter === 'normal' ? 'white' : '#7a9ec2',
                        border: 'none', cursor: 'pointer'
                      }}
                    >
                      Normal ({currentReport.extracted_findings.length - currentReport.abnormal_findings_explained.length})
                    </button>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Test / Analyte</th>
                        <th>Measured Result</th>
                        <th>Units</th>
                        <th>Reference Interval</th>
                        <th>Flag Status</th>
                        <th>Clinical Significance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFindings.map((f, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: '#e2eaf4' }}>{f.name}</td>
                          <td style={{ fontWeight: 700, color: f.flag === 'NORMAL' ? '#2dd4bf' : '#fb7185' }}>
                            {f.result_value}
                          </td>
                          <td style={{ color: '#7a9ec2', fontSize: '0.78rem' }}>{f.unit || '—'}</td>
                          <td style={{ color: '#7a9ec2', fontSize: '0.78rem' }}>{f.reference_range || 'Standard'}</td>
                          <td>
                            {f.flag === 'NORMAL' ? (
                              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Normal</span>
                            ) : f.flag === 'HIGH' ? (
                              <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>High</span>
                            ) : f.flag === 'LOW' ? (
                              <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>Low</span>
                            ) : (
                              <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>{f.flag}</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#9bb8d7' }}>
                            {f.clinical_significance || 'Within normal physiological range.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Medical Terminology Explained Cards ───────────────────── */}
              {currentReport.terminology_explanations.length > 0 && (
                <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: 'rgba(49,130,244,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <HelpCircle size={18} style={{ color: '#3182f4' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                        Medical Terminology Explained in Simple Language
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: '#5a7a9e', margin: 0 }}>
                        Clear explanations of medical terms found within your report
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    {currentReport.terminology_explanations.map((t, i) => (
                      <div key={i} className="glass-sm" style={{ padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#57a3f9', marginBottom: 4 }}>
                          {t.term}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
                          {t.simple_explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── What Report Establishes vs What It Does NOT Establish ─── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
                {/* Establishes */}
                <div className="glass" style={{ padding: 24, borderTop: '4px solid #10b981' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                      What This Report Establishes
                    </h3>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentReport.what_report_establishes.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Does NOT Establish */}
                <div className="glass" style={{ padding: 24, borderTop: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                      What This Report Does NOT Establish
                    </h3>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentReport.what_report_does_not_establish.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ── Missing Information Callout ───────────────────────────── */}
              {currentReport.missing_information.length > 0 && (
                <div className="glass-sm" style={{
                  padding: '16px 20px', marginBottom: 24, borderRadius: 12,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <HelpCircle size={16} style={{ color: '#fbbf24' }} />
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                      Missing Clinical Context for Comprehensive Interpretation
                    </h4>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: '#fde68a', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {currentReport.missing_information.map((info, i) => (
                      <li key={i}>{info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── SECTION: “YOUR NEXT STEPS” ────────────────────────────── */}
              <div className="glass" style={{
                padding: 28, marginBottom: 28,
                border: '1px solid rgba(20,184,166,0.3)',
                background: 'linear-gradient(135deg, rgba(15,32,64,0.85), rgba(20,184,166,0.08))'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'linear-gradient(135deg, #14b8a6, #3182f4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Sparkles size={20} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                      Your Next Steps
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#2dd4bf', margin: 0 }}>
                      Personalized, evidence-based recommendations based on your report findings
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: '0.88rem', color: '#e2eaf4', lineHeight: 1.55, marginBottom: 20 }}>
                  <strong>Overview:</strong> {currentReport.next_steps.summary}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  {/* Practical Actions */}
                  <div className="glass-sm" style={{ padding: 18 }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2dd4bf', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} />
                      <span>Practical Actions You Can Take</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {currentReport.next_steps.practical_actions.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Questions to Ask Doctor */}
                  <div className="glass-sm" style={{ padding: 18 }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#57a3f9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HelpCircle size={16} />
                      <span>Questions to Ask Your Doctor</span>
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {currentReport.next_steps.doctor_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Clarification Alert if needed */}
                {currentReport.next_steps.clarification_needed && (
                  <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(49,130,244,0.1)', border: '1px solid rgba(49,130,244,0.25)',
                    fontSize: '0.8rem', color: '#93c5fd'
                  }}>
                    <strong>Clarification Needed:</strong> {currentReport.next_steps.clarification_needed}
                  </div>
                )}

                {/* Urgent Warning Triggers */}
                <div style={{
                  marginTop: 16, padding: '14px 18px', borderRadius: 10,
                  background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
                  fontSize: '0.8rem', color: '#fca5a5'
                }}>
                  <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={15} />
                    <span>When to Seek Prompt Emergency Care</span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: '0.78rem' }}>
                    Seek immediate emergency evaluation (call 911) if you experience any of the following:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {currentReport.next_steps.seek_prompt_care_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ── SECTION: AI CHAT GROUNDED IN DOCUMENT ────────────────── */}
              <div className="glass" style={{ padding: 24, marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: 'rgba(49,130,244,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Bot size={18} style={{ color: '#3182f4' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                      Ask Follow-up Questions About This Document
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#5a7a9e', margin: 0 }}>
                      Answers are grounded strictly in your uploaded medical report
                    </p>
                  </div>
                </div>

                {/* Prompt Suggestion Chips */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {[
                    'Can you explain this report in simple words?',
                    'Which results are marked abnormal?',
                    'What questions should I ask my doctor?',
                    'What does the eGFR level indicate?',
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSendChatMessage(chip)}
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '5px 12px', borderRadius: 20 }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Chat Message Box */}
                <div
                  ref={chatScrollRef}
                  style={{
                    minHeight: 180, maxHeight: 360, overflowY: 'auto',
                    padding: 16, borderRadius: 12, background: 'rgba(5,12,26,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14,
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}
                >
                  {chatMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#5a7a9e', padding: '30px 0', fontSize: '0.82rem' }}>
                      No follow-up questions asked yet. Ask anything about the test measurements or terminology in this document!
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: msg.role === 'patient' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: '0.82rem',
                          lineHeight: 1.5,
                          background: msg.role === 'patient'
                            ? '#3182f4'
                            : msg.is_emergency
                            ? 'rgba(244,63,94,0.18)'
                            : 'rgba(15,32,64,0.8)',
                          color: '#e2eaf4',
                          border: msg.is_emergency
                            ? '1px solid rgba(244,63,94,0.4)'
                            : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {msg.role === 'patient' ? (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>
                    ))
                  )}

                  {chatLoading && (
                    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: '#7a9ec2', fontSize: '0.8rem' }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Consulting document records...</span>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }}
                  style={{ display: 'flex', gap: 10 }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a question about your report findings..."
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10,
                      background: 'rgba(15,32,64,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2eaf4', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || chatLoading}
                    className="btn-primary"
                    style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          TAB 2: PREVIOUS ANALYSES HISTORY VIEW
         ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="glass animate-fade-in-up" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#e2eaf4', margin: 0 }}>
                Previously Analyzed Medical Reports
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#5a7a9e', margin: 0 }}>
                Review past diagnostic results, terminology explanations, and patient next steps
              </p>
            </div>
            <button
              onClick={() => { setActiveTab('analyzer'); setCurrentReport(null); }}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Upload size={14} />
              <span>Analyze New Report</span>
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#7a9ec2' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>Loading saved reports...</div>
            </div>
          ) : reportsHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#5a7a9e' }}>
              <FileSearch size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2eaf4', marginBottom: 6 }}>
                No Medical Reports Analyzed Yet
              </div>
              <p style={{ fontSize: '0.82rem', maxWidth: 400, margin: '0 auto 16px' }}>
                Upload your laboratory results, blood tests, or diagnostic scans to receive structured patient guidance.
              </p>
              <button
                onClick={() => setActiveTab('analyzer')}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '8px 18px' }}
              >
                Upload Document Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reportsHistory.map((rep) => (
                <div
                  key={rep.id}
                  className="glass-sm"
                  style={{
                    padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 14, borderLeft: rep.abnormal_findings_explained.length > 0 ? '4px solid #f43f5e' : '4px solid #10b981'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                        {rep.document_type}
                      </span>
                      {rep.abnormal_findings_explained.length > 0 ? (
                        <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>
                          {rep.abnormal_findings_explained.length} Flagged
                        </span>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                          All Normal
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#e2eaf4', marginBottom: 2 }}>
                      {rep.key_findings_summary.slice(0, 100)}...
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#5a7a9e' }}>
                      Analyzed on {new Date(rep.created_at).toLocaleDateString()} • {rep.extracted_findings.length} findings recorded
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => { setCurrentReport(rep); setActiveTab('analyzer'); }}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span>View Report</span>
                      <ArrowRight size={14} />
                    </button>
                    {deleteConfirmId === rep.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleDeleteReport(rep.id)}
                          style={{
                            background: '#f43f5e', color: 'white', border: 'none', borderRadius: 6,
                            padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
                          }}
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(rep.id)}
                        className="btn-secondary"
                        style={{ padding: '8px 12px', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}
                        title="Delete Report"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
