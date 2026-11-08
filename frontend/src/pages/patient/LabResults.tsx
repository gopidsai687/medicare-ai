import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import {
  FlaskConical,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  Clock,
  Trash2,
  Edit2,
  TrendingUp,
  ShieldCheck,
  Search,
  RefreshCw,
  Home,
  CheckCheck,
  Layers,
  Cpu,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { useToast } from '@/lib/toast'
import { AddLabResultModal, LabResultItem } from '@/components/labs/AddLabResultModal'
import { EditLabResultModal } from '@/components/labs/EditLabResultModal'
import { DeleteLabResultModal } from '@/components/labs/DeleteLabResultModal'
import { LabHistoryModal } from '@/components/labs/LabHistoryModal'
import { ClearLabHistoryModal } from '@/components/labs/ClearLabHistoryModal'

interface LabTest {
  id?: string
  name: string
  panel_name?: string
  category?: string
  result_type?: string
  value: number
  unit: string
  rangeMin: number
  rangeMax: number
  reference_range?: string
  status: 'Normal' | 'Elevated' | 'Low' | string
  trend: 'up' | 'down' | 'stable' | string
  date: string
  measurement_time?: string
  measurement_type?: string
  fasting_status?: string
  device_name?: string
  repeat_value?: number
  repeat_time?: string
  repeat_notes?: string
  is_repeat_measurement?: boolean
  educational_notice?: string
  orderedBy?: string
  laboratory_name?: string
  clinical_notes?: string
  report_url?: string
  source?: string
  is_amended?: boolean
  amendment_reason?: string
  original_value?: number
  is_archived?: boolean
}

interface LabPanel {
  id: string
  panel_id?: string
  title: string
  category?: string
  result_type?: string
  orderedBy: string
  laboratory_name?: string
  date: string
  measurement_time?: string
  device_name?: string
  educational_notice?: string
  tests: LabTest[]
  source?: string
  is_archived?: boolean
}

export default function PatientLabResults() {
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [panels, setPanels] = useState<LabPanel[]>([])
  const [selectedPanelId, setSelectedPanelId] = useState<string>('')
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Filters (Requirement 3: Clear separation of Labs vs Home Monitoring)
  const [selectedResultTypeFilter, setSelectedResultTypeFilter] = useState<'all' | 'lab_result' | 'home_monitoring' | 'patient_reported'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [isConsolidating, setIsConsolidating] = useState(false)

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isClearHistoryOpen, setIsClearHistoryOpen] = useState(false)
  const [selectedHistoryBiomarker, setSelectedHistoryBiomarker] = useState('HbA1c')

  const [labToEdit, setLabToEdit] = useState<LabResultItem | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const [labToDelete, setLabToDelete] = useState<LabResultItem | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const loadLabs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/v1/labs', {
        params: {
          include_archived: showArchived,
          result_type: selectedResultTypeFilter !== 'all' ? selectedResultTypeFilter : undefined,
        },
      })
      if (res.data && Array.isArray(res.data)) {
        const loadedPanels: LabPanel[] = res.data.map((p: any) => ({
          id: p.id,
          panel_id: p.panel_id,
          title: p.title,
          category: p.category,
          result_type: p.result_type,
          orderedBy: p.orderedBy || 'Attending Physician',
          laboratory_name: p.laboratory_name || 'MediCare Central Pathology',
          date: p.date,
          measurement_time: p.measurement_time,
          device_name: p.device_name,
          educational_notice: p.educational_notice,
          source: p.source,
          is_archived: p.is_archived,
          tests: (p.tests || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            panel_name: t.panel_name || p.title,
            category: t.category,
            result_type: t.result_type,
            value: Number(t.value),
            unit: t.unit,
            rangeMin: Number(t.rangeMin),
            rangeMax: Number(t.rangeMax),
            reference_range: t.reference_range,
            status: t.status,
            trend: t.trend || 'stable',
            date: t.date || p.date,
            measurement_time: t.measurement_time || p.measurement_time,
            measurement_type: t.measurement_type,
            fasting_status: t.fasting_status,
            device_name: t.device_name || p.device_name,
            repeat_value: t.repeat_value !== undefined && t.repeat_value !== null ? Number(t.repeat_value) : undefined,
            repeat_time: t.repeat_time,
            repeat_notes: t.repeat_notes,
            is_repeat_measurement: t.is_repeat_measurement,
            educational_notice: t.educational_notice,
            orderedBy: t.orderedBy || p.orderedBy,
            laboratory_name: t.laboratory_name || p.laboratory_name,
            clinical_notes: t.clinical_notes,
            report_url: t.report_url,
            source: t.source,
            is_amended: t.is_amended,
            amendment_reason: t.amendment_reason,
            original_value: t.original_value,
            is_archived: t.is_archived,
          })),
        }))

        setPanels(loadedPanels)
        if (loadedPanels.length > 0) {
          setSelectedPanelId((prev) => {
            const exists = loadedPanels.some((p) => p.id === prev)
            return exists ? prev : loadedPanels[0].id
          })
        }
        setIsLive(true)
      }
    } catch (err) {
      console.warn('Failed to load live lab panels:', err)
      toastError('Connection Notice', 'Could not load lab results from backend.')
    } finally {
      setIsLoading(false)
    }
  }, [showArchived, selectedResultTypeFilter, toastError])

  useEffect(() => {
    loadLabs()
  }, [loadLabs])

  const handleExport = async () => {
    try {
      const res = await api.get('/api/v1/labs/export')
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `medicare_diagnostic_labs_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      success('Export Completed', 'Diagnostic laboratory summary downloaded successfully.')
    } catch (err) {
      toastError('Export Failed', 'Could not export laboratory results.')
    }
  }

  // Deduplication Consolidation Action (Requirement 1 & 10)
  const handleConsolidateDuplicates = async () => {
    setIsConsolidating(true)
    try {
      const res = await api.post('/api/v1/labs/cleanup-duplicates')
      if (res.data?.consolidated_count > 0) {
        success(
          'Deduplication Complete',
          `Successfully consolidated ${res.data.consolidated_count} duplicate submission(s) into verified records.`
        )
      } else {
        success('Integrity Verified', 'All records checked. No redundant duplicate entries detected.')
      }
      await loadLabs()
    } catch (err) {
      toastError('Consolidation Notice', 'Could not execute duplicate consolidation.')
    } finally {
      setIsConsolidating(false)
    }
  }

  // Active Selected Panel
  const currentPanel = useMemo(() => {
    return panels.find((p) => p.id === selectedPanelId) || (panels.length > 0 ? panels[0] : null)
  }, [panels, selectedPanelId])

  // Filtered Tests in Current Panel
  const displayedTests = useMemo(() => {
    if (!currentPanel) return []
    return currentPanel.tests.filter((t) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        (t.clinical_notes || '').toLowerCase().includes(q) ||
        (t.device_name || '').toLowerCase().includes(q) ||
        (t.orderedBy || '').toLowerCase().includes(q)
      )
    })
  }, [currentPanel, searchQuery])

  const handleOpenEdit = (t: LabTest) => {
    const item: LabResultItem = {
      id: t.id || '',
      name: t.name,
      panel_name: t.panel_name || currentPanel?.title || 'Diagnostic Panel',
      category: t.category || 'Other',
      result_type: t.result_type,
      value: t.value,
      unit: t.unit,
      rangeMin: t.rangeMin,
      rangeMax: t.rangeMax,
      reference_range: t.reference_range,
      status: t.status,
      trend: t.trend,
      date: t.date,
      measurement_time: t.measurement_time,
      measurement_type: t.measurement_type,
      fasting_status: t.fasting_status,
      device_name: t.device_name,
      repeat_value: t.repeat_value,
      repeat_time: t.repeat_time,
      repeat_notes: t.repeat_notes,
      orderedBy: t.orderedBy || currentPanel?.orderedBy || '',
      laboratory_name: t.laboratory_name || currentPanel?.laboratory_name,
      clinical_notes: t.clinical_notes,
      report_url: t.report_url,
      source: t.source || 'lab_imported',
      is_amended: t.is_amended,
      amendment_reason: t.amendment_reason,
      original_value: t.original_value,
      is_archived: t.is_archived,
    }
    setLabToEdit(item)
    setIsEditModalOpen(true)
  }

  const handleOpenDelete = (t: LabTest) => {
    const item: LabResultItem = {
      id: t.id || '',
      name: t.name,
      panel_name: t.panel_name || currentPanel?.title || 'Diagnostic Panel',
      category: t.category || 'Other',
      result_type: t.result_type,
      value: t.value,
      unit: t.unit,
      rangeMin: t.rangeMin,
      rangeMax: t.rangeMax,
      reference_range: t.reference_range,
      status: t.status,
      trend: t.trend,
      date: t.date,
      orderedBy: t.orderedBy || '',
      source: t.source || 'lab_imported',
    }
    setLabToDelete(item)
    setIsDeleteModalOpen(true)
  }

  const handleOpenTrend = (biomarkerName: string) => {
    setSelectedHistoryBiomarker(biomarkerName)
    setIsHistoryOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            Diagnostic Lab Results &amp; Telemetry
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Standardized laboratory panels, home fingerstick telemetry, reference intervals, and audit trails
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
            onClick={() => navigate('/patient/reports')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <FlaskConical size={15} /> Analyze with AI Analyzer
          </button>
          <button
            onClick={handleExport}
            className="btn-primary inline-flex items-center gap-2 cursor-pointer"
          >
            <Download size={15} /> Download Official Lab Report
          </button>
        </div>
      </div>

      {/* ── Action Area (Exact Recommended Layout from Mockup + Deduplication Tool) ── */}
      <div className="glass p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white block">Diagnostic Lab Results &amp; Telemetry</span>
            <span className="text-xs text-slate-400">
              {panels.length} Clinical Diagnostic Panels &amp; Home Telemetry Diaries Available
            </span>
          </div>
        </div>

        {/* 4 Core Action Buttons from Mockup + Consolidate Duplicates Tool */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus size={14} /> Add Result
          </button>

          <button
            onClick={() => {
              setSelectedHistoryBiomarker(currentPanel?.result_type === 'home_monitoring' ? 'Blood Glucose (Fasting Fingerstick)' : 'HbA1c')
              setIsHistoryOpen(true)
            }}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Clock size={14} className="text-blue-400" /> View History
          </button>

          <button
            onClick={() => setIsClearHistoryOpen(true)}
            className="px-3.5 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 size={14} className="text-rose-400" /> Clear History
          </button>

          <button
            onClick={handleExport}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={14} className="text-teal-400" /> Export
          </button>

          <button
            onClick={handleConsolidateDuplicates}
            disabled={isConsolidating}
            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            title="Scan and consolidate duplicate measurements into primary records"
          >
            <CheckCheck size={14} /> Consolidate Duplicates
          </button>
        </div>
      </div>

      {/* ── Requirement 3: Clear Separation Between Lab Results and Home Measurements ── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setSelectedResultTypeFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            selectedResultTypeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers size={14} /> All Diagnostic Telemetry
        </button>

        <button
          onClick={() => setSelectedResultTypeFilter('lab_result')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            selectedResultTypeFilter === 'lab_result'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FlaskConical size={14} /> Certified Laboratory Results (CMP, CBC, Lipid, HbA1c)
        </button>

        <button
          onClick={() => setSelectedResultTypeFilter('home_monitoring')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            selectedResultTypeFilter === 'home_monitoring'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Home size={14} /> Home Monitoring (Fingerstick Glucose, Home BP)
        </button>

        <button
          onClick={() => setSelectedResultTypeFilter('patient_reported')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            selectedResultTypeFilter === 'patient_reported'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck size={14} /> Patient-Reported Records
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between border border-white/10">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 shrink-0">
            <Filter size={13} /> Filter:
          </span>
          {['all', 'CMP', 'Lipid Panel', 'HbA1c', 'Home Monitoring'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategoryFilter === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? 'All Panels' : cat}
            </button>
          ))}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border ${
              showArchived
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search test biomarkers, devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Panel Selection Horizontal Tabs */}
      {panels.length === 0 ? (
        <div className="glass p-12 text-center text-slate-400 text-xs rounded-2xl border border-white/10 space-y-2">
          <p>No diagnostic panels recorded in this view.</p>
          <p className="text-slate-500">Click "+ Add Result" to create a new diagnostic or home monitoring measurement.</p>
        </div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {panels
            .filter((p) => {
              if (selectedCategoryFilter === 'all') return true
              return (
                p.title.toLowerCase().includes(selectedCategoryFilter.toLowerCase()) ||
                (p.category || '').toLowerCase().includes(selectedCategoryFilter.toLowerCase())
              )
            })
            .map((panel) => {
              const isHomePanel = panel.result_type === 'home_monitoring' || panel.category === 'Home Monitoring'
              return (
                <button
                  key={panel.id}
                  onClick={() => setSelectedPanelId(panel.id)}
                  className={`px-4 py-3 rounded-2xl text-left border transition-all shrink-0 cursor-pointer ${
                    selectedPanelId === panel.id
                      ? isHomePanel
                        ? 'bg-cyan-600/10 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                        : 'bg-blue-600/10 border-blue-500/50 text-white shadow-lg shadow-blue-500/10'
                      : 'glass text-slate-400 hover:text-white border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-bold ${isHomePanel ? 'text-cyan-400' : 'text-blue-400'}`}>
                      {panel.date}
                    </p>
                    {isHomePanel ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                        <Home size={10} /> Home
                      </span>
                    ) : panel.source === 'patient_entered' ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Patient
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck size={10} /> Certified
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white mt-0.5">{panel.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isHomePanel ? `Source: ${panel.device_name || 'Home Glucose Meter'}` : panel.orderedBy}
                  </p>
                </button>
              )
            })}
        </div>
      )}

      {/* Current Panel Biomarkers Grid */}
      {currentPanel && (
        <div className="glass rounded-2xl p-6 border border-white/10 space-y-6">
          {/* Panel Header & Metadata (Requirement 4) */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {currentPanel.result_type === 'home_monitoring' ? (
                    <Home size={20} className="text-cyan-400" />
                  ) : (
                    <FlaskConical size={20} className="text-blue-400" />
                  )}
                  {currentPanel.title}
                </h2>
                {currentPanel.result_type === 'home_monitoring' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium flex items-center gap-1">
                    <Home size={13} /> Home Monitoring Telemetry
                  </span>
                ) : currentPanel.source === 'patient_entered' ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                    Patient-Reported Entry
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                    <ShieldCheck size={13} /> Clinical Lab Certified
                  </span>
                )}
              </div>

              {/* Requirement 4: Correct metadata labels: "Measurement Date" instead of "Specimen Collected" for home readings */}
              <p className="text-xs text-slate-400 mt-1">
                {currentPanel.result_type === 'home_monitoring' ? (
                  <>
                    Measurement Date: <strong>{currentPanel.date}</strong>
                    {currentPanel.measurement_time && <> • Time: <strong>{currentPanel.measurement_time}</strong></>}
                    {' '}• Device: <strong>{currentPanel.device_name || currentPanel.laboratory_name || 'Home Meter'}</strong>
                    {' '}• <strong>Source: Home Glucose Meter</strong>
                  </>
                ) : (
                  <>
                    Specimen Collected: <strong>{currentPanel.date}</strong>
                    {' '}• Ordered by: <strong>{currentPanel.orderedBy}</strong>
                    {' '}• Facility: <strong>{currentPanel.laboratory_name || 'MediCare Central Pathology'}</strong>
                  </>
                )}
              </p>
            </div>

            {/* Quick Trend Shortcut */}
            <button
              onClick={() => handleOpenTrend(currentPanel.title.split(' (')[0])}
              className="px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <TrendingUp size={14} /> View Panel Biomarker Trends
            </button>
          </div>

          {/* Educational Notice Banner for Home Monitoring (Requirement 8) */}
          {currentPanel.result_type === 'home_monitoring' && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2.5">
              <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-cyan-300">Clinical Data Integrity &amp; Reference Notice:</span>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Home blood glucose meter measurements provide longitudinal glycemic tracking with standard ISO meter calibration (typically ±15% variance).
                  Home measurements are <strong>not equivalent to diagnostic laboratory plasma glucose</strong> and do not constitute a clinical diagnosis of diabetes mellitus.
                </p>
              </div>
            </div>
          )}

          {/* Tests Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedTests.map((test) => {
              const rMin = test.rangeMin || 0
              const rMax = test.rangeMax || 100
              const pct = Math.min(
                100,
                Math.max(0, ((test.value - rMin * 0.7) / (rMax * 1.3 - rMin * 0.7 || 1)) * 100)
              )

              const isHomeReading = test.result_type === 'home_monitoring' || (test.name || '').toLowerCase().includes('fingerstick')

              return (
                <div
                  key={test.id || test.name}
                  className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 hover:border-blue-500/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{test.name}</h3>
                          {test.is_amended && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              title={`Amended from ${test.original_value}: ${test.amendment_reason}`}
                            >
                              Amended
                            </span>
                          )}
                          {isHomeReading ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                              <Home size={10} /> Home Reading
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <FlaskConical size={10} /> Certified Lab
                            </span>
                          )}
                        </div>

                        {/* Measurement Date & Timestamp */}
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock size={11} className="text-slate-500" />
                          {isHomeReading ? 'Measured: ' : 'Specimen: '}
                          <strong>{test.date}</strong>
                          {test.measurement_time && <span className="font-mono text-cyan-400">• {test.measurement_time}</span>}
                          {test.fasting_status && <span className="text-slate-400">({test.fasting_status})</span>}
                        </p>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                          test.status === 'Normal'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : test.status === 'Elevated'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {test.status}
                      </span>
                    </div>

                    {/* Primary Value & Repeat Verification Display (Requirement 2) */}
                    {test.repeat_value !== undefined && test.repeat_value !== null ? (
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/20 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold">Dual Calibration Check:</span>
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            Variance: {roundDiff(test.repeat_value, test.value)} {test.unit} (ISO Standard)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Initial Reading
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-2xl font-bold text-white font-mono">{test.value}</span>
                              <span className="text-xs text-slate-400 font-medium">{test.unit}</span>
                            </div>
                            {test.measurement_time && (
                              <div className="text-[10px] text-slate-500 mt-0.5">Time: {test.measurement_time}</div>
                            )}
                          </div>

                          <div className="border-l border-slate-800 pl-3">
                            <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                              <RotateCcw size={10} /> Repeat Check
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-2xl font-bold text-cyan-300 font-mono">{test.repeat_value}</span>
                              <span className="text-xs text-cyan-400/80 font-medium">{test.unit}</span>
                            </div>
                            {test.repeat_time && (
                              <div className="text-[10px] text-slate-500 mt-0.5">Time: {test.repeat_time}</div>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 leading-relaxed">
                          <strong>Clinical Verification:</strong> Initial reading {test.value} {test.unit} verified with repeat check {test.repeat_value} {test.unit} on {test.device_name || 'Home Glucose Meter'}.
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between mt-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold text-white tracking-tight font-mono">{test.value}</span>
                          <span className="text-xs text-slate-400 font-medium">{test.unit}</span>
                        </div>
                        <span className="text-xs flex items-center gap-1 text-slate-400">
                          {test.trend === 'up' && <ArrowUpRight size={14} className="text-amber-400" />}
                          {test.trend === 'down' && <ArrowDownRight size={14} className="text-emerald-400" />}
                          {test.trend === 'stable' && <Minus size={14} className="text-slate-400" />}
                          {test.trend === 'stable' ? 'Stable' : 'Trending ' + test.trend}
                        </span>
                      </div>
                    )}

                    {/* Reference Range Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Target Range:</span>
                        <span className="font-mono text-slate-300">
                          {test.reference_range || `${test.rangeMin} – ${test.rangeMax} ${test.unit}`}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${
                            test.status === 'Normal'
                              ? 'bg-emerald-400'
                              : test.status === 'Elevated'
                              ? 'bg-amber-400'
                              : 'bg-blue-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Source & Device Metadata (Requirement 4) */}
                    <div className="text-[11px] text-slate-400 space-y-0.5 pt-1">
                      {isHomeReading ? (
                        <>
                          <div>
                            <strong>Device:</strong> {test.device_name || test.laboratory_name || 'Home Glucose Meter'}
                          </div>
                          <div>
                            <strong>Source:</strong> Home Glucose Meter
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong>Ordering Physician:</strong> {test.orderedBy || 'Attending Physician'}
                          </div>
                          <div>
                            <strong>Laboratory:</strong> {test.laboratory_name || 'MediCare Central Pathology'}
                          </div>
                        </>
                      )}
                      {test.clinical_notes && (
                        <div className="text-slate-300 italic pt-1">
                          Notes: {test.clinical_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Test Action Buttons */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleOpenTrend(test.name)}
                      className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <TrendingUp size={13} /> View Trends
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(test)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 transition-all cursor-pointer font-medium"
                        title={test.source === 'patient_entered' ? 'Edit measurement details' : 'Amend official result'}
                      >
                        <Edit2 size={12} className="text-amber-400" />
                        {test.source === 'patient_entered' ? 'Edit' : 'Amend'}
                      </button>

                      <button
                        onClick={() => handleOpenDelete(test)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                        title="Archive record"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AddLabResultModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newLab) => {
          loadLabs()
          success('Result Recorded', `Recorded "${newLab.name}" (${newLab.value} ${newLab.unit}) successfully.`)
        }}
      />

      <EditLabResultModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setLabToEdit(null)
        }}
        onSuccess={() => {
          loadLabs()
          success('Record Updated', 'Diagnostic changes saved to clinical database.')
        }}
        labToEdit={labToEdit}
      />

      <DeleteLabResultModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setLabToDelete(null)
        }}
        onSuccess={() => {
          loadLabs()
          success('Result Archived', 'The diagnostic record has been archived from your active view.')
        }}
        labToDelete={labToDelete}
      />

      <LabHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestored={() => {
          loadLabs()
          success('Result Restored', 'Archived lab result restored to active dashboard.')
        }}
        initialBiomarker={selectedHistoryBiomarker}
      />

      <ClearLabHistoryModal
        isOpen={isClearHistoryOpen}
        onClose={() => setIsClearHistoryOpen(false)}
        onSuccess={(msg) => {
          loadLabs()
          success('History Status', msg)
        }}
        onClearFilters={() => {
          setSearchQuery('')
          setSelectedCategoryFilter('all')
          setSelectedResultTypeFilter('all')
          setShowArchived(false)
        }}
        onHideArchived={() => setShowArchived(false)}
      />
    </div>
  )
}

function roundDiff(repeat: number, initial: number): string {
  const diff = Math.round((repeat - initial) * 10) / 10
  return diff > 0 ? `+${diff}` : `${diff}`
}
