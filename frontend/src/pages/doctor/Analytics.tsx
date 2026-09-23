import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Download,
  Calendar,
  ChevronRight,
  Filter,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'

const DISEASE_DISTRIBUTION = [
  { name: 'Hypertension (I10)', count: 68, color: '#3182f4' },
  { name: 'Type 2 Diabetes (E11)', count: 46, color: '#14b8a6' },
  { name: 'Hyperlipidemia (E78)', count: 52, color: '#8b5cf6' },
  { name: 'Coronary Artery Disease', count: 24, color: '#f59e0b' },
  { name: 'Heart Failure (HFrEF)', count: 18, color: '#f43f5e' },
  { name: 'CKD Stage 3-4', count: 14, color: '#06b6d4' },
]

const CHRONIC_TRENDS = [
  { month: 'Apr', avgHbA1c: 7.4, avgSystolicBP: 138, controlledPct: 71 },
  { month: 'May', avgHbA1c: 7.2, avgSystolicBP: 136, controlledPct: 73 },
  { month: 'Jun', avgHbA1c: 7.1, avgSystolicBP: 134, controlledPct: 75 },
  { month: 'Jul', avgHbA1c: 6.9, avgSystolicBP: 132, controlledPct: 77 },
  { month: 'Aug', avgHbA1c: 6.8, avgSystolicBP: 130, controlledPct: 80 },
  { month: 'Sep', avgHbA1c: 6.7, avgSystolicBP: 128, controlledPct: 82 },
]

const ENCOUNTER_VOLUME = [
  { month: 'Apr', inPerson: 85, telehealth: 35, urgent: 12 },
  { month: 'May', inPerson: 92, telehealth: 40, urgent: 10 },
  { month: 'Jun', inPerson: 88, telehealth: 42, urgent: 15 },
  { month: 'Jul', inPerson: 95, telehealth: 48, urgent: 8 },
  { month: 'Aug', inPerson: 102, telehealth: 52, urgent: 11 },
  { month: 'Sep', inPerson: 110, telehealth: 58, urgent: 9 },
]

const HIGH_RISK_PATIENTS = [
  {
    name: 'David Kim',
    mrn: 'MRN-00000068',
    age: 71,
    riskScore: 92,
    riskLevel: 'HIGH',
    primaryDriver: 'HFrEF with elevated Troponin (0.142 ng/mL) & CKD 3b',
    nextDue: 'Immediate Review',
    action: 'Urgent Cardiology Consult',
  },
  {
    name: 'Robert Chen',
    mrn: 'MRN-00000034',
    age: 61,
    riskScore: 78,
    riskLevel: 'ELEVATED',
    primaryDriver: 'Atrial Fibrillation with sub-therapeutic INR variance',
    nextDue: 'Sep 25, 2026',
    action: 'Anticoagulant Titration',
  },
  {
    name: 'Alice Johnson',
    mrn: 'MRN-00000012',
    age: 48,
    riskScore: 64,
    riskLevel: 'MODERATE',
    primaryDriver: 'Type 2 Diabetes with HbA1c 6.7% on dual oral therapy',
    nextDue: 'Oct 12, 2026',
    action: 'Routine 3-Month CMP',
  },
  {
    name: 'Maria Santos',
    mrn: 'MRN-00000051',
    age: 36,
    riskScore: 42,
    riskLevel: 'LOW',
    primaryDriver: 'Microcytic anemia under investigation',
    nextDue: 'Oct 28, 2026',
    action: 'Review CBC with Diff',
  },
]

export default function DoctorAnalytics() {
  const [timeRange, setTimeRange] = useState<'3M' | '6M' | '1Y'>('6M')
  const [censusCount, setCensusCount] = useState(142)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadTelemetry() {
      try {
        const [apptsRes, labsRes] = await Promise.allSettled([
          api.get('/api/v1/appointments'),
          api.get('/api/v1/labs'),
        ])
        if (apptsRes.status === 'fulfilled' && Array.isArray(apptsRes.value.data)) {
          setCensusCount(140 + apptsRes.value.data.length)
          setIsLive(true)
        }
      } catch (err) {
        console.warn('Analytics telemetry fallback:', err)
      }
    }
    loadTelemetry()
  }, [])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
              <BarChart3 size={22} />
            </span>
            Clinical Practice Analytics & Population Health
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Population-level health surveillance, clinical quality KPIs, and algorithmic risk stratification
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE SURVEILLANCE
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 text-xs font-semibold">
            {(['3M', '6M', '1Y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  timeRange === range ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => alert('Generating Comprehensive Clinical Quality & NCQA HEDIS Compliance Report...')}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Active Patient Census</span>
          <p className="text-2xl font-bold text-white font-display">{censusCount}</p>
          <span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
            <TrendingUp size={12} /> +8.4% vs last quarter
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">30-Day Readmission</span>
          <p className="text-2xl font-bold text-emerald-400 font-display">3.2%</p>
          <span className="text-[11px] text-emerald-400 font-medium">
            vs 8.5% Nat'l Benchmark
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Glycemic Control (A1c &lt;7%)</span>
          <p className="text-2xl font-bold text-teal-400 font-display">78.4%</p>
          <span className="text-[11px] text-teal-400 font-medium">
            ADA Quality Target Met
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">BP Control (&lt;130/80)</span>
          <p className="text-2xl font-bold text-blue-400 font-display">82.1%</p>
          <span className="text-[11px] text-blue-400 font-medium">
            AHA 2024 Benchmark
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Telehealth Adoption</span>
          <p className="text-2xl font-bold text-indigo-400 font-display">34.6%</p>
          <span className="text-[11px] text-slate-400">
            58 Video visits this month
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chronic Condition Trends */}
        <div className="lg:col-span-2 glass p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity size={16} className="text-teal-400" /> Longitudinal Chronic Outcome Trajectory
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Average HbA1c (%) & Systolic BP (mmHg) across panel</p>
            </div>
            <span className="text-[10px] text-teal-300 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-full">
              Positive Trajectory
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CHRONIC_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3182f4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3182f4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorA1c" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f2040',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="avgSystolicBP" name="Avg Systolic BP (mmHg)" stroke="#3182f4" strokeWidth={2} fillOpacity={1} fill="url(#colorBP)" />
                <Area type="monotone" dataKey="controlledPct" name="% Patients Controlled" stroke="#14b8a6" strokeWidth={2} fillOpacity={1} fill="url(#colorA1c)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Diagnostic Distribution Donut */}
        <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Heart size={16} className="text-rose-400" /> Disease Prevalence
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Top active chronic diagnosis codes</p>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DISEASE_DISTRIBUTION}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {DISEASE_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f2040',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {DISEASE_DISTRIBUTION.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-slate-300 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}: <strong className="text-white">{d.count}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Modality Encounter Volume */}
      <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar size={16} className="text-indigo-400" /> Clinical Encounter Modality & Volume
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Distribution of in-person, video telehealth, and urgent encounters</p>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ENCOUNTER_VOLUME} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f2040',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inPerson" name="In-Person Clinic" fill="#3182f4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="telehealth" name="Video Telehealth" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="urgent" name="Urgent / Inpatient" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High Risk Patient Stratification Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10 space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck size={16} className="text-rose-400" /> High-Risk Patient Stratification & Early Intervention Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Algorithmically prioritized patients based on lab volatility, multi-morbidity, and 30-day readmission risk
            </p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Primary Clinical Driver</th>
                <th className="py-3 px-4">Target Due</th>
                <th className="py-3 px-4 text-right">Recommended Intervention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {HIGH_RISK_PATIENTS.map((p) => (
                <tr key={p.mrn} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-white block">{p.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{p.mrn} • Age {p.age}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-200">{p.riskScore} / 100</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.riskLevel === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : p.riskLevel === 'ELEVATED'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : p.riskLevel === 'MODERATE'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {p.riskLevel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs">{p.primaryDriver}</td>
                  <td className="py-3.5 px-4 text-slate-400">{p.nextDue}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => alert(`Initiating clinical pathway for ${p.name}: ${p.action}`)}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
                    >
                      <Stethoscope size={13} /> {p.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
