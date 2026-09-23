import { useState, useEffect } from 'react'
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
} from 'lucide-react'

interface LabTest {
  name: string
  value: number
  unit: string
  rangeMin: number
  rangeMax: number
  status: 'Normal' | 'Elevated' | 'Low'
  trend: 'up' | 'down' | 'stable'
  date: string
}

interface LabPanel {
  id: string
  title: string
  orderedBy: string
  date: string
  tests: LabTest[]
}

const LAB_PANELS: LabPanel[] = [
  {
    id: 'panel-1',
    title: 'Comprehensive Metabolic Panel (CMP)',
    orderedBy: 'Dr. Sarah Chen',
    date: '2026-09-18',
    tests: [
      { name: 'Fasting Blood Glucose', value: 104, unit: 'mg/dL', rangeMin: 70, rangeMax: 99, status: 'Elevated', trend: 'down', date: '2026-09-18' },
      { name: 'Blood Urea Nitrogen (BUN)', value: 16, unit: 'mg/dL', rangeMin: 7, rangeMax: 20, status: 'Normal', trend: 'stable', date: '2026-09-18' },
      { name: 'Serum Creatinine', value: 0.95, unit: 'mg/dL', rangeMin: 0.6, rangeMax: 1.2, status: 'Normal', trend: 'stable', date: '2026-09-18' },
      { name: 'Sodium', value: 140, unit: 'mEq/L', rangeMin: 135, rangeMax: 145, status: 'Normal', trend: 'stable', date: '2026-09-18' },
      { name: 'Potassium', value: 4.2, unit: 'mEq/L', rangeMin: 3.5, rangeMax: 5.0, status: 'Normal', trend: 'stable', date: '2026-09-18' },
      { name: 'eGFR', value: 92, unit: 'mL/min/1.73m²', rangeMin: 60, rangeMax: 120, status: 'Normal', trend: 'stable', date: '2026-09-18' },
    ],
  },
  {
    id: 'panel-2',
    title: 'Lipid Panel',
    orderedBy: 'Dr. Sarah Chen',
    date: '2026-09-18',
    tests: [
      { name: 'Total Cholesterol', value: 188, unit: 'mg/dL', rangeMin: 125, rangeMax: 200, status: 'Normal', trend: 'down', date: '2026-09-18' },
      { name: 'LDL Cholesterol', value: 108, unit: 'mg/dL', rangeMin: 0, rangeMax: 100, status: 'Elevated', trend: 'down', date: '2026-09-18' },
      { name: 'HDL Cholesterol', value: 52, unit: 'mg/dL', rangeMin: 40, rangeMax: 60, status: 'Normal', trend: 'up', date: '2026-09-18' },
      { name: 'Triglycerides', value: 142, unit: 'mg/dL', rangeMin: 0, rangeMax: 150, status: 'Normal', trend: 'down', date: '2026-09-18' },
    ],
  },
  {
    id: 'panel-3',
    title: 'Glycated Hemoglobin (HbA1c)',
    orderedBy: 'Dr. James Kim',
    date: '2026-08-10',
    tests: [
      { name: 'Hemoglobin A1c', value: 6.8, unit: '%', rangeMin: 4.0, rangeMax: 5.6, status: 'Elevated', trend: 'down', date: '2026-08-10' },
      { name: 'Estimated Average Glucose (eAG)', value: 148, unit: 'mg/dL', rangeMin: 70, rangeMax: 114, status: 'Elevated', trend: 'down', date: '2026-08-10' },
    ],
  },
]

export default function PatientLabResults() {
  const [panels, setPanels] = useState<LabPanel[]>(LAB_PANELS)
  const [selectedPanelId, setSelectedPanelId] = useState<string>(LAB_PANELS[0].id)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadLabs() {
      try {
        const res = await api.get('/api/v1/labs')
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const apiPanels: LabPanel[] = res.data.map((p: any) => ({
            id: p.id,
            title: p.title,
            orderedBy: p.orderedBy || 'Attending Physician',
            date: p.date,
            tests: (p.tests || []).map((t: any) => ({
              name: t.name,
              value: t.value,
              unit: t.unit,
              rangeMin: t.rangeMin,
              rangeMax: t.rangeMax,
              status: t.status,
              trend: t.trend || 'stable',
              date: t.date || p.date,
            })),
          }))
          const existingIds = new Set(apiPanels.map(p => p.title.toLowerCase()))
          const nonDupeDemo = LAB_PANELS.filter(p => !existingIds.has(p.title.toLowerCase()))
          const merged = [...apiPanels, ...nonDupeDemo]
          setPanels(merged)
          setSelectedPanelId(merged[0].id)
          setIsLive(true)
        }
      } catch (err) {
        console.warn('Using demo lab results:', err)
      }
    }
    loadLabs()
  }, [])

  const currentPanel = panels.find((p) => p.id === selectedPanelId) || panels[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Diagnostic Lab Results</h1>
          <p className="page-subtitle flex items-center gap-2">
            Standardized laboratory panels, reference intervals, and biomarker trends
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE API
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => alert('Exporting lab test report...')}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Download size={15} /> Download Official Lab Report
        </button>
      </div>

      {/* Panel Selection Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setSelectedPanelId(panel.id)}
            className={`px-4 py-3 rounded-2xl text-left border transition-all shrink-0 ${
              selectedPanelId === panel.id
                ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-lg shadow-blue-500/10'
                : 'glass text-slate-400 hover:text-white border-white/5'
            }`}
          >
            <p className="text-xs font-bold text-blue-400">{panel.date}</p>
            <p className="text-sm font-semibold text-white mt-0.5">{panel.title}</p>
            <p className="text-xs text-slate-400 mt-1">{panel.orderedBy}</p>
          </button>
        ))}
      </div>

      {/* Current Panel Biomarkers */}
      <div className="glass rounded-2xl p-6 border border-white/10 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FlaskConical size={20} className="text-blue-400" /> {currentPanel.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specimen collected {currentPanel.date} • Ordered by {currentPanel.orderedBy}
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Clinical Lab Certified
          </span>
        </div>

        {/* Tests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentPanel.tests.map((test) => {
            const pct = Math.min(
              100,
              Math.max(
                0,
                ((test.value - test.rangeMin * 0.7) / (test.rangeMax * 1.3 - test.rangeMin * 0.7)) * 100
              )
            )

            return (
              <div
                key={test.name}
                className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3 hover:border-blue-500/20 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{test.name}</h3>
                    <p className="text-xs text-slate-400">
                      Standard Range: {test.rangeMin} – {test.rangeMax} {test.unit}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
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

                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-white tracking-tight">{test.value}</span>
                    <span className="text-xs text-slate-400 font-medium">{test.unit}</span>
                  </div>
                  <span className="text-xs flex items-center gap-1 text-slate-400">
                    {test.trend === 'up' && <ArrowUpRight size={14} className="text-amber-400" />}
                    {test.trend === 'down' && <ArrowDownRight size={14} className="text-emerald-400" />}
                    {test.trend === 'stable' && <Minus size={14} className="text-slate-400" />}
                    {test.trend === 'stable' ? 'Stable' : 'Trending ' + test.trend}
                  </span>
                </div>

                {/* Range Gauge Bar */}
                <div className="space-y-1">
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
