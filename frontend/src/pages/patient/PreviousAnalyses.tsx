import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Pill,
  FileSearch,
  Calendar,
  Clock,
  ArrowRight,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  Plus,
  RefreshCw,
  Eye,
} from 'lucide-react'
import api from '@/lib/api'

interface UnifiedAnalysisItem {
  id: string
  type: 'prescription' | 'medical_report'
  title: string
  subtitle: string
  date: string
  itemsCount: number
  hasFlaggedAlerts: boolean
  reviewStatus: string
  rawItem: any
}

export default function PreviousAnalyses() {
  const navigate = useNavigate()
  const [analyses, setAnalyses] = useState<UnifiedAnalysisItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'prescription' | 'medical_report'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const fetchAnalyses = useCallback(async () => {
    setLoading(true)
    try {
      const [rxRes, reportRes] = await Promise.allSettled([
        api.get('/api/v1/prescription-analysis/reports'),
        api.get('/api/v1/medical-report-analysis/reports'),
      ])

      const unified: UnifiedAnalysisItem[] = []

      // Prescriptions
      if (rxRes.status === 'fulfilled' && Array.isArray(rxRes.value.data)) {
        rxRes.value.data.forEach((rx: any) => {
          const medCount = rx.medication_guidance?.length || 0
          const hasFlags = (rx.safety_review?.interactions?.length || 0) > 0 || (rx.safety_review?.allergy_alerts?.length || 0) > 0
          unified.push({
            id: rx.id,
            type: 'prescription',
            title: `Prescription Analysis (${medCount} medication${medCount !== 1 ? 's' : ''})`,
            subtitle: rx.summary_data?.plain_language_summary?.slice(0, 120) || 'Analyzed prescription guidance',
            date: rx.created_at,
            itemsCount: medCount,
            hasFlaggedAlerts: hasFlags,
            reviewStatus: rx.review_status,
            rawItem: rx,
          })
        })
      }

      // Medical Reports
      if (reportRes.status === 'fulfilled' && Array.isArray(reportRes.value.data)) {
        reportRes.value.data.forEach((rep: any) => {
          const findingsCount = rep.extracted_findings?.length || 0
          const hasAbnormal = (rep.abnormal_findings_explained?.length || 0) > 0
          unified.push({
            id: rep.id,
            type: 'medical_report',
            title: rep.document_type || 'Medical Report Analysis',
            subtitle: rep.key_findings_summary?.slice(0, 120) || 'Analyzed clinical diagnostic report',
            date: rep.created_at,
            itemsCount: findingsCount,
            hasFlaggedAlerts: hasAbnormal,
            reviewStatus: rep.review_status,
            rawItem: rep,
          })
        })
      }

      // Sort latest first
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAnalyses(unified)
    } catch (err) {
      console.warn('Could not load unified analyses:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalyses()
  }, [fetchAnalyses])

  const handleDelete = async (item: UnifiedAnalysisItem) => {
    try {
      if (item.type === 'prescription') {
        await api.delete(`/api/v1/prescription-analysis/reports/${item.id}`)
      } else {
        await api.delete(`/api/v1/medical-report-analysis/reports/${item.id}`)
      }
      setAnalyses((prev) => prev.filter((a) => a.id !== item.id))
      setDeleteConfirmId(null)
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Could not delete analysis.')
    }
  }

  const filteredAnalyses = analyses.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    }
    return true
  })

  const prescriptionCount = analyses.filter((a) => a.type === 'prescription').length
  const reportCount = analyses.filter((a) => a.type === 'medical_report').length

  return (
    <div className="animate-fade-in-up" style={{ paddingBottom: 60 }}>
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(49,130,244,0.25))',
              border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={22} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h1 className="page-title flex items-center gap-3">
                Previous AI Analyses
                <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>
                  {analyses.length} Total Records
                </span>
              </h1>
              <p className="page-subtitle">
                Access your history of analyzed prescriptions and diagnostic medical reports
              </p>
            </div>
          </div>

          {/* Quick upload triggers */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate('/patient/prescriptions')}
              className="btn-primary"
              style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Pill size={14} />
              <span>New Prescription</span>
            </button>
            <button
              onClick={() => navigate('/patient/reports')}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileSearch size={14} style={{ color: '#14b8a6' }} />
              <span>New Medical Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Metric Summary Strip ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="glass stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#5a7a9e', marginBottom: 4 }}>Total Document Analyses</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e2eaf4' }}>{analyses.length}</div>
        </div>
        <div className="glass stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#5a7a9e', marginBottom: 4 }}>Prescriptions Analyzed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#3182f4' }}>{prescriptionCount}</div>
        </div>
        <div className="glass stat-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', color: '#5a7a9e', marginBottom: 4 }}>Medical Reports Analyzed</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#14b8a6' }}>{reportCount}</div>
        </div>
      </div>

      {/* ── Search & Filter Strip ────────────────────────────────────────── */}
      <div className="glass" style={{ padding: 18, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ color: '#5a7a9e' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by medication name, test type, or keyword..."
            style={{
              background: 'transparent', border: 'none', color: '#e2eaf4',
              fontSize: '0.85rem', width: '100%', outline: 'none'
            }}
          />
        </div>

        {/* Filter Type Toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilterType('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              background: filterType === 'all' ? '#3182f4' : 'rgba(255,255,255,0.06)',
              color: filterType === 'all' ? 'white' : '#7a9ec2',
              border: 'none', cursor: 'pointer'
            }}
          >
            All ({analyses.length})
          </button>
          <button
            onClick={() => setFilterType('prescription')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              background: filterType === 'prescription' ? '#3182f4' : 'rgba(255,255,255,0.06)',
              color: filterType === 'prescription' ? 'white' : '#7a9ec2',
              border: 'none', cursor: 'pointer'
            }}
          >
            Prescriptions ({prescriptionCount})
          </button>
          <button
            onClick={() => setFilterType('medical_report')}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              background: filterType === 'medical_report' ? '#14b8a6' : 'rgba(255,255,255,0.06)',
              color: filterType === 'medical_report' ? 'white' : '#7a9ec2',
              border: 'none', cursor: 'pointer'
            }}
          >
            Medical Reports ({reportCount})
          </button>
        </div>
      </div>

      {/* ── Analyses List ────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#7a9ec2' }}>
          <Loader2 size={26} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Retrieving clinical analyses records...</div>
        </div>
      ) : filteredAnalyses.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: '#5a7a9e' }}>
          <Sparkles size={40} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', marginBottom: 6 }}>
            No Analysis Records Found
          </h3>
          <p style={{ fontSize: '0.82rem', maxWidth: 420, margin: '0 auto 18px' }}>
            {searchQuery ? 'No analyses match your search criteria.' : 'Upload your prescriptions or medical reports to view their structured analyses here.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => navigate('/patient/prescriptions')} className="btn-primary" style={{ fontSize: '0.8rem', padding: '8px 16px' }}>
              Upload Prescription
            </button>
            <button onClick={() => navigate('/patient/reports')} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '8px 16px' }}>
              Upload Medical Report
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredAnalyses.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="glass stat-card"
              style={{
                padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 16,
                borderLeft: item.type === 'prescription' ? '4px solid #3182f4' : '4px solid #14b8a6'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 280 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: item.type === 'prescription' ? 'rgba(49,130,244,0.15)' : 'rgba(20,184,166,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {item.type === 'prescription' ? (
                    <Pill size={22} style={{ color: '#3182f4' }} />
                  ) : (
                    <FileSearch size={22} style={{ color: '#14b8a6' }} />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={item.type === 'prescription' ? 'badge badge-blue' : 'badge badge-teal'} style={{ fontSize: '0.7rem' }}>
                      {item.type === 'prescription' ? 'Prescription Analysis' : 'Medical Report'}
                    </span>
                    {item.hasFlaggedAlerts ? (
                      <span className="badge badge-rose" style={{ fontSize: '0.68rem' }}>
                        Safety Alert / Out of Range
                      </span>
                    ) : (
                      <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>
                        Normal Profile
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#e2eaf4', margin: '0 0 4px' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#7a9ec2', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {item.subtitle}...
                  </p>
                  <div style={{ fontSize: '0.74rem', color: '#5a7a9e' }}>
                    Analyzed on {new Date(item.date).toLocaleDateString()} • {item.itemsCount} {item.type === 'prescription' ? 'medications' : 'measurements'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => {
                    if (item.type === 'prescription') {
                      navigate('/patient/prescriptions', { state: { reportId: item.id } })
                    } else {
                      navigate('/patient/reports', { state: { reportId: item.id } })
                    }
                  }}
                  className="btn-primary cursor-pointer hover:shadow-lg transition-all"
                  style={{ fontSize: '0.78rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>Open Analysis</span>
                  <ArrowRight size={14} />
                </button>

                {deleteConfirmId === item.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => handleDelete(item)}
                      style={{
                        background: '#f43f5e', color: 'white', border: 'none', borderRadius: 6,
                        padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      Confirm
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
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="btn-secondary"
                    style={{ padding: '8px 12px', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}
                    title="Delete Analysis Record"
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
  )
}
