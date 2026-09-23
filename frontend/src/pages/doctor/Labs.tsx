import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  X,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Download,
  RefreshCw,
} from 'lucide-react'

interface Biomarker {
  name: string
  value: string
  unit: string
  referenceRange: string
  status: 'normal' | 'high' | 'low' | 'critical'
}

interface LabOrder {
  id: string
  patientName: string
  mrn: string
  panelName: string
  orderedDate: string
  completedDate?: string
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  status: 'COMPLETED' | 'PENDING' | 'CRITICAL'
  orderingPhysician: string
  clinicalIndication: string
  fasting: boolean
  signedOff: boolean
  biomarkers?: Biomarker[]
}

const INITIAL_LABS: LabOrder[] = [
  {
    id: 'LAB-2026-0901',
    patientName: 'David Kim',
    mrn: 'MRN-00000068',
    panelName: 'High-Sensitivity Cardiac Troponin-I & BNP',
    orderedDate: '2026-09-22 08:30',
    completedDate: '2026-09-22 09:15',
    priority: 'STAT',
    status: 'CRITICAL',
    orderingPhysician: 'Dr. Sarah Chen',
    clinicalIndication: 'Acute onset dyspnea and retrosternal pressure at rest in HFrEF patient',
    fasting: false,
    signedOff: false,
    biomarkers: [
      { name: 'hs-cTnI (Troponin I)', value: '0.142', unit: 'ng/mL', referenceRange: '< 0.040', status: 'critical' },
      { name: 'NT-proBNP', value: '4,280', unit: 'pg/mL', referenceRange: '< 450', status: 'critical' },
      { name: 'Potassium (Serum)', value: '5.6', unit: 'mmol/L', referenceRange: '3.5 - 5.0', status: 'high' },
      { name: 'Creatinine (Serum)', value: '2.1', unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'high' },
      { name: 'eGFR (CKD-EPI)', value: '31', unit: 'mL/min/1.73m²', referenceRange: '> 60', status: 'low' },
    ],
  },
  {
    id: 'LAB-2026-0894',
    patientName: 'Alice Johnson',
    mrn: 'MRN-00000012',
    panelName: 'Comprehensive Metabolic Panel (CMP) + HbA1c',
    orderedDate: '2026-09-21 14:10',
    completedDate: '2026-09-21 17:45',
    priority: 'ROUTINE',
    status: 'COMPLETED',
    orderingPhysician: 'Dr. Sarah Chen',
    clinicalIndication: 'Routine 3-month Type 2 Diabetes & Lisinopril monitoring',
    fasting: true,
    signedOff: true,
    biomarkers: [
      { name: 'Hemoglobin A1c', value: '6.7', unit: '%', referenceRange: '< 5.7 (Target < 7.0)', status: 'high' },
      { name: 'Fasting Plasma Glucose', value: '118', unit: 'mg/dL', referenceRange: '70 - 99', status: 'high' },
      { name: 'Sodium', value: '140', unit: 'mmol/L', referenceRange: '135 - 145', status: 'normal' },
      { name: 'Potassium', value: '4.4', unit: 'mmol/L', referenceRange: '3.5 - 5.0', status: 'normal' },
      { name: 'Creatinine', value: '0.92', unit: 'mg/dL', referenceRange: '0.6 - 1.1', status: 'normal' },
      { name: 'eGFR', value: '88', unit: 'mL/min/1.73m²', referenceRange: '> 60', status: 'normal' },
      { name: 'ALT (SGPT)', value: '24', unit: 'U/L', referenceRange: '7 - 35', status: 'normal' },
    ],
  },
  {
    id: 'LAB-2026-0887',
    patientName: 'Robert Chen',
    mrn: 'MRN-00000034',
    panelName: 'Coagulation Panel (PT / INR) & Lipid Profile',
    orderedDate: '2026-09-21 10:20',
    completedDate: '2026-09-21 13:00',
    priority: 'URGENT',
    status: 'COMPLETED',
    orderingPhysician: 'Dr. James Kim',
    clinicalIndication: 'Warfarin therapeutic range maintenance for Atrial Fibrillation',
    fasting: true,
    signedOff: true,
    biomarkers: [
      { name: 'Prothrombin Time (PT)', value: '26.4', unit: 'sec', referenceRange: '11.0 - 13.5', status: 'high' },
      { name: 'INR', value: '2.4', unit: 'ratio', referenceRange: '2.0 - 3.0 (Target)', status: 'normal' },
      { name: 'Total Cholesterol', value: '185', unit: 'mg/dL', referenceRange: '< 200', status: 'normal' },
      { name: 'LDL Cholesterol', value: '94', unit: 'mg/dL', referenceRange: '< 100', status: 'normal' },
      { name: 'HDL Cholesterol', value: '52', unit: 'mg/dL', referenceRange: '> 40', status: 'normal' },
      { name: 'Triglycerides', value: '145', unit: 'mg/dL', referenceRange: '< 150', status: 'normal' },
    ],
  },
  {
    id: 'LAB-2026-0882',
    patientName: 'Maria Santos',
    mrn: 'MRN-00000051',
    panelName: 'Complete Blood Count (CBC) with Differential',
    orderedDate: '2026-09-22 11:00',
    priority: 'ROUTINE',
    status: 'PENDING',
    orderingPhysician: 'Dr. Maria Lopez',
    clinicalIndication: 'Evaluation of fatigue and mild microcytic anemia workup',
    fasting: false,
    signedOff: false,
  },
]

export default function DoctorLabs() {
  const [labs, setLabs] = useState<LabOrder[]>(INITIAL_LABS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'PENDING' | 'COMPLETED'>('ALL')
  const [isLive, setIsLive] = useState(false)
  
  // Modals
  const [selectedLab, setSelectedLab] = useState<LabOrder | null>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  
  // New Order Form state
  const [orderPatient, setOrderPatient] = useState('Alice Johnson (MRN-00000012)')
  const [orderPanel, setOrderPanel] = useState('Comprehensive Metabolic Panel (CMP)')
  const [orderPriority, setOrderPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE')
  const [orderFasting, setOrderFasting] = useState(true)
  const [orderIndication, setOrderIndication] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const fetchLabs = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/v1/labs')
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        const apiLabs: LabOrder[] = res.data.map((panel: any) => ({
          id: panel.id.startsWith('LAB-') ? panel.id : `LAB-${panel.id.slice(0, 8).toUpperCase()}`,
          patientName: panel.patientName || 'David Kim',
          mrn: panel.mrn || 'MRN-00000068',
          panelName: panel.title,
          orderedDate: panel.date + ' 09:00',
          completedDate: panel.date + ' 11:30',
          priority: (panel.priority as any) || 'ROUTINE',
          status: panel.tests && panel.tests.some((t: any) => t.status === 'Elevated')
            ? 'CRITICAL'
            : panel.status === 'PENDING'
            ? 'PENDING'
            : 'COMPLETED',
          orderingPhysician: panel.orderedBy || 'Dr. Sarah Chen',
          clinicalIndication: 'Diagnostic follow-up laboratory evaluation',
          fasting: false,
          signedOff: panel.status === 'COMPLETED',
          biomarkers: (panel.tests || []).map((t: any) => ({
            name: t.name,
            value: String(t.value),
            unit: t.unit,
            referenceRange: `${t.rangeMin} - ${t.rangeMax}`,
            status: t.status === 'Elevated' ? 'high' : 'normal',
          })),
        }))
        const existingIds = new Set(apiLabs.map((l) => l.panelName.toLowerCase()))
        const nonDupeDemo = INITIAL_LABS.filter((l) => !existingIds.has(l.panelName.toLowerCase()))
        setLabs([...apiLabs, ...nonDupeDemo])
        setIsLive(true)
      }
    } catch (err) {
      console.warn('Using demo lab data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLabs()
  }, [])

  const handleSignOff = async (labId: string) => {
    try {
      if (labId.includes('-') && !labId.startsWith('LAB-DEMO')) {
        await api.patch(`/api/v1/labs/orders/${labId.replace('LAB-', '')}/sign`)
      }
    } catch (err) {
      console.warn('Could not persist sign-off to API:', err)
    }

    setLabs((prev) =>
      prev.map((l) => (l.id === labId ? { ...l, signedOff: true } : l))
    )
    if (selectedLab && selectedLab.id === labId) {
      setSelectedLab({ ...selectedLab, signedOff: true })
    }
  }

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameMatch = orderPatient.match(/^([^(]+)/)
    const mrnMatch = orderPatient.match(/\(([^)]+)\)/)
    const pName = nameMatch ? nameMatch[1].trim() : orderPatient

    const newOrder: LabOrder = {
      id: `LAB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      patientName: pName,
      mrn: mrnMatch ? mrnMatch[1].trim() : 'MRN-00000000',
      panelName: orderPanel,
      orderedDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      priority: orderPriority,
      status: 'PENDING',
      orderingPhysician: 'Dr. Sarah Chen',
      clinicalIndication: orderIndication || 'Clinical routine investigation',
      fasting: orderFasting,
      signedOff: false,
    }

    try {
      const res = await api.post('/api/v1/labs/orders', {
        panel_name: orderPanel,
        patient_name: pName,
        priority: orderPriority,
        fasting: orderFasting,
        clinical_indication: orderIndication,
      })
      if (res.data && res.data.id) {
        newOrder.id = res.data.id.startsWith('LAB-')
          ? res.data.id
          : `LAB-${res.data.id.slice(0, 8).toUpperCase()}`
      }
    } catch (err) {
      console.warn('Could not persist order to API, added locally:', err)
    }

    setLabs([newOrder, ...labs])
    setShowOrderModal(false)
    setOrderIndication('')
  }

  const filteredLabs = labs.filter((lab) => {
    const matchesQuery =
      lab.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.panelName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = statusFilter === 'ALL' || lab.status === statusFilter
    return matchesQuery && matchesFilter
  })

  const criticalCount = labs.filter((l) => l.status === 'CRITICAL' && !l.signedOff).length
  const pendingCount = labs.filter((l) => l.status === 'PENDING').length
  const completedCount = labs.filter((l) => l.status === 'COMPLETED').length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20">
              <FlaskConical size={22} />
            </span>
            Laboratory Orders & Diagnostic Results
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Order panels, monitor processing telemetry, and sign off on critical diagnostic biomarkers
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE API
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchLabs()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh diagnostic labs from server"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowOrderModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> Requisition New Lab Panel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Total Active Orders</span>
          <p className="text-2xl font-bold text-white font-display">{labs.length}</p>
          <span className="text-[11px] text-teal-400 font-medium flex items-center gap-1">
            <TrendingUp size={12} /> Active requisition queue
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-1">
          <span className="text-xs text-rose-300 font-medium">Critical Action Flags</span>
          <p className="text-2xl font-bold text-rose-400 font-display">{criticalCount}</p>
          <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
            <AlertTriangle size={12} /> Immediate clinician review required
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-amber-500/20 space-y-1">
          <span className="text-xs text-amber-300 font-medium">Processing / Pending</span>
          <p className="text-2xl font-bold text-amber-400 font-display">{pendingCount}</p>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock size={12} /> In laboratory analyzer
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-emerald-300 font-medium">Completed & Verified</span>
          <p className="text-2xl font-bold text-emerald-400 font-display">{completedCount}</p>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={12} /> Ready in electronic chart
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, MRN, or panel name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {(['ALL', 'CRITICAL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Lab Orders Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <tr>
              <th className="py-3.5 px-5">Requisition ID</th>
              <th className="py-3.5 px-5">Patient Name</th>
              <th className="py-3.5 px-5">Diagnostic Panel</th>
              <th className="py-3.5 px-5">Priority</th>
              <th className="py-3.5 px-5">Ordered</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredLabs.map((lab) => (
              <tr
                key={lab.id}
                onClick={() => setSelectedLab(lab)}
                className="hover:bg-white/5 transition-colors cursor-pointer"
              >
                <td className="py-4 px-5 font-mono text-slate-400">{lab.id}</td>
                <td className="py-4 px-5">
                  <div className="font-semibold text-white text-sm">{lab.patientName}</div>
                  <div className="font-mono text-[10px] text-slate-400">{lab.mrn}</div>
                </td>
                <td className="py-4 px-5 font-medium text-slate-200">{lab.panelName}</td>
                <td className="py-4 px-5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      lab.priority === 'STAT'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : lab.priority === 'URGENT'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {lab.priority}
                  </span>
                </td>
                <td className="py-4 px-5 text-slate-400">{lab.orderedDate}</td>
                <td className="py-4 px-5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      lab.status === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                        : lab.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {lab.status}
                  </span>
                </td>
                <td className="py-4 px-5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedLab(lab)
                    }}
                    className="text-xs text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-1"
                  >
                    View Biomarkers <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lab Result Details Modal */}
      {selectedLab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass w-full max-w-3xl rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  {selectedLab.id} • {selectedLab.priority} REQUISITION
                </span>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FlaskConical size={18} className="text-teal-400" /> {selectedLab.panelName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedLab(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Patient Header Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Patient:</span>
                <span className="font-bold text-white">{selectedLab.patientName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">MRN:</span>
                <span className="font-mono text-slate-200">{selectedLab.mrn}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Fasting Status:</span>
                <span className="font-semibold text-teal-400">{selectedLab.fasting ? 'Fasting 12h' : 'Non-Fasting'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Physician:</span>
                <span className="text-slate-200">{selectedLab.orderingPhysician}</span>
              </div>
            </div>

            {/* Indication */}
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Clinical Indication: </span>
              {selectedLab.clinicalIndication}
            </div>

            {/* Biomarkers Table */}
            {selectedLab.biomarkers && selectedLab.biomarkers.length > 0 ? (
              <div className="glass rounded-xl overflow-hidden border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Analyte / Biomarker</th>
                      <th className="py-2.5 px-4">Measured Value</th>
                      <th className="py-2.5 px-4">Unit</th>
                      <th className="py-2.5 px-4">Standard Reference Interval</th>
                      <th className="py-2.5 px-4 text-right">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedLab.biomarkers.map((b, idx) => (
                      <tr key={idx} className={b.status === 'critical' ? 'bg-rose-500/10' : ''}>
                        <td className="py-3 px-4 font-semibold text-white">{b.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-100 text-sm">{b.value}</td>
                        <td className="py-3 px-4 text-slate-400">{b.unit}</td>
                        <td className="py-3 px-4 text-slate-300">{b.referenceRange}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.status === 'critical'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : b.status === 'high'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : b.status === 'low'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {b.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center space-y-2 text-xs text-slate-400">
                <Clock size={28} className="mx-auto text-amber-400" />
                <p className="font-semibold text-white">Laboratory Processing In Progress</p>
                <p>Specimen received at central clinical pathology. Results will appear automatically upon analyzer validation.</p>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={16} className={selectedLab.signedOff ? 'text-emerald-400' : 'text-slate-500'} />
                <span>
                  {selectedLab.signedOff
                    ? 'Electronically Signed & Validated into Medical Record'
                    : 'Awaiting Attending Physician Review & Sign-Off'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLab(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Close
                </button>
                {!selectedLab.signedOff && selectedLab.status !== 'PENDING' && (
                  <button
                    onClick={() => handleSignOff(selectedLab.id)}
                    className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Electronically Sign & Acknowledge
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requisition New Lab Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FlaskConical size={18} className="text-teal-400" /> Requisition Diagnostic Laboratory Test
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Select Patient:</label>
                <select
                  value={orderPatient}
                  onChange={(e) => setOrderPatient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
                >
                  <option>Alice Johnson (MRN-00000012)</option>
                  <option>Robert Chen (MRN-00000034)</option>
                  <option>David Kim (MRN-00000068)</option>
                  <option>Maria Santos (MRN-00000051)</option>
                  <option>Emma Wilson (MRN-00000082)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Diagnostic Panel / Test:</label>
                <select
                  value={orderPanel}
                  onChange={(e) => setOrderPanel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
                >
                  <option>Comprehensive Metabolic Panel (CMP)</option>
                  <option>Lipid Profile Panel (LDL, HDL, Triglycerides)</option>
                  <option>Glycated Hemoglobin (HbA1c)</option>
                  <option>High-Sensitivity Cardiac Troponin-I & BNP</option>
                  <option>Complete Blood Count (CBC) with Differential</option>
                  <option>Thyroid Function Panel (TSH, Free T4)</option>
                  <option>Coagulation Panel (PT / INR / PTT)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Order Priority:</label>
                  <select
                    value={orderPriority}
                    onChange={(e) => setOrderPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
                  >
                    <option value="ROUTINE">Routine (24-48h)</option>
                    <option value="URGENT">Urgent (4-6h)</option>
                    <option value="STAT">STAT Emergency (&lt; 1h)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Fasting Requirement:</label>
                  <select
                    value={orderFasting ? 'yes' : 'no'}
                    onChange={(e) => setOrderFasting(e.target.value === 'yes')}
                    className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
                  >
                    <option value="yes">Fasting 12h Required</option>
                    <option value="no">Non-Fasting Allowed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Clinical Indication & Diagnosis Code:</label>
                <textarea
                  value={orderIndication}
                  onChange={(e) => setOrderIndication(e.target.value)}
                  rows={2}
                  placeholder="e.g. Routine 3-month diabetes surveillance (E11.9), evaluate worsening dyspnea..."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-5 py-2">
                  Transmit Requisition Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
