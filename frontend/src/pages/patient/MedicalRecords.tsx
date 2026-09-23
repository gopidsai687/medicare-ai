import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  FileText,
  Search,
  Filter,
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
} from 'lucide-react'

interface MedicalRecordItem {
  id: string
  category: 'Diagnosis' | 'Allergy' | 'Surgery' | 'Immunization' | 'Document'
  title: string
  icd10?: string
  date: string
  provider: string
  status: 'Active' | 'Resolved' | 'Chronic' | 'Verified'
  severity?: 'Mild' | 'Moderate' | 'Severe' | 'Critical'
  description: string
  notes?: string
}

const INITIAL_RECORDS: MedicalRecordItem[] = [
  {
    id: 'rec-1',
    category: 'Diagnosis',
    title: 'Type 2 Diabetes Mellitus',
    icd10: 'E11.9',
    date: '2023-06-12',
    provider: 'Dr. James Kim (Endocrinology)',
    status: 'Chronic',
    severity: 'Moderate',
    description: 'Managed with Metformin 500mg BID and dietary interventions. Target HbA1c < 7.0%.',
    notes: 'Patient advised to monitor blood glucose twice weekly and maintain low glycemic diet.',
  },
  {
    id: 'rec-2',
    category: 'Diagnosis',
    title: 'Essential Hypertension — Stage 1',
    icd10: 'I10',
    date: '2022-03-18',
    provider: 'Dr. Sarah Chen (Cardiology)',
    status: 'Active',
    severity: 'Mild',
    description: 'Controlled on Lisinopril 10mg daily. Ambulatory BP monitoring recommended every 6 months.',
    notes: 'Average home readings 128/82 mmHg.',
  },
  {
    id: 'rec-3',
    category: 'Allergy',
    title: 'Penicillin & Amoxicillin',
    date: '2015-05-20',
    provider: 'Dr. Maria Lopez (General Practice)',
    status: 'Active',
    severity: 'Severe',
    description: 'Hives, angioedema, and airway tightness upon ingestion. Cross-reactivity warning active.',
    notes: 'Prescribe cephalosporins with caution or alternative macrolide antibiotics.',
  },
  {
    id: 'rec-4',
    category: 'Surgery',
    title: 'Laparoscopic Appendectomy',
    date: '2019-01-14',
    provider: 'Dr. Robert Patel (General Surgery)',
    status: 'Resolved',
    description: 'Uncomplicated acute appendicitis. Three-port laparoscopic resection without rupture.',
    notes: 'Post-operative recovery uneventful. Incisions fully healed.',
  },
  {
    id: 'rec-5',
    category: 'Immunization',
    title: 'Influenza Vaccine (Quadrivalent)',
    date: '2025-10-10',
    provider: 'MetroHealth Pharmacy Clinic',
    status: 'Verified',
    description: 'Annual seasonal flu prophylaxis. Lot #FL-88912.',
    notes: 'No adverse reactions noted post 15-minute observation.',
  },
  {
    id: 'rec-6',
    category: 'Immunization',
    title: 'COVID-19 Updated Booster (mRNA)',
    date: '2025-09-02',
    provider: 'MetroHealth Main Clinic',
    status: 'Verified',
    description: 'Monovalent spike antigen booster. Lot #CV-39210.',
    notes: 'Mild localized arm soreness for 24 hours.',
  },
]

export default function PatientMedicalRecords() {
  const [records, setRecords] = useState<MedicalRecordItem[]>(INITIAL_RECORDS)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordItem | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // New record form state
  const [newCategory, setNewCategory] = useState<MedicalRecordItem['category']>('Diagnosis')
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('2026-09-22')
  const [newProvider, setNewProvider] = useState('')
  const [newDescription, setNewDescription] = useState('')

  useEffect(() => {
    async function loadRecords() {
      try {
        const res = await api.get('/api/v1/records')
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const apiRecords: MedicalRecordItem[] = res.data.map((r: any) => ({
            id: r.id,
            category: (r.category.charAt(0).toUpperCase() + r.category.slice(1).toLowerCase()) as any,
            title: r.title,
            icd10: r.icd10_code || undefined,
            date: r.record_date || new Date().toISOString().split('T')[0],
            provider: 'Dr. Physician (Assigned)',
            status: (r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase()) as any,
            severity: 'Moderate',
            description: r.description || '',
            notes: r.notes || undefined,
          }))
          const existingTitles = new Set(apiRecords.map(r => r.title.toLowerCase()))
          const nonDupeDemo = INITIAL_RECORDS.filter(r => !existingTitles.has(r.title.toLowerCase()))
          setRecords([...apiRecords, ...nonDupeDemo])
          setIsLive(true)
        }
      } catch (err) {
        console.warn('Using demo medical records data:', err)
      }
    }
    loadRecords()
  }, [])

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    const rec: MedicalRecordItem = {
      id: `rec-${Date.now()}`,
      category: newCategory,
      title: newTitle,
      date: newDate,
      provider: newProvider || 'Self-Reported / Outside Provider',
      status: newCategory === 'Allergy' || newCategory === 'Diagnosis' ? 'Active' : 'Verified',
      description: newDescription,
    }

    try {
      await api.post('/api/v1/records', {
        title: newTitle,
        category: newCategory.toLowerCase(),
        description: newDescription,
        record_date: newDate,
        status: (newCategory === 'Allergy' || newCategory === 'Diagnosis' ? 'active' : 'resolved'),
      })
    } catch (err) {
      console.warn('Failed to save record to API, saved locally:', err)
    }

    setRecords([rec, ...records])
    setIsAddModalOpen(false)
    setNewTitle('')
    setNewProvider('')
    setNewDescription('')
  }

  const filteredRecords = records.filter((r) => {
    const matchesCat =
      selectedCategory === 'all' ? true : r.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.icd10 && r.icd10.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  const stats = [
    { label: 'Active Diagnoses', value: records.filter((r) => r.category === 'Diagnosis' && r.status !== 'Resolved').length, icon: Activity, color: '#3182f4' },
    { label: 'Allergies Tracked', value: records.filter((r) => r.category === 'Allergy').length, icon: ShieldAlert, color: '#f43f5e' },
    { label: 'Surgeries Documented', value: records.filter((r) => r.category === 'Surgery').length, icon: Scissors, color: '#10b981' },
    { label: 'Immunizations', value: records.filter((r) => r.category === 'Immunization').length, icon: Syringe, color: '#8b5cf6' },
  ]

  const getCategoryIcon = (category: MedicalRecordItem['category']) => {
    switch (category) {
      case 'Diagnosis': return <Activity size={16} className="text-blue-400" />
      case 'Allergy': return <ShieldAlert size={16} className="text-rose-400" />
      case 'Surgery': return <Scissors size={16} className="text-emerald-400" />
      case 'Immunization': return <Syringe size={16} className="text-purple-400" />
      default: return <FileText size={16} className="text-slate-400" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Medical Records</h1>
          <p className="page-subtitle flex items-center gap-2">
            Your longitudinal electronic health record, diagnoses, and verified history
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE API
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Downloading comprehensive PDF health record...')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-2 transition-all"
          >
            <Download size={15} /> Export Health Summary
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> Add Record
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
          {['all', 'diagnosis', 'allergy', 'surgery', 'immunization'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? 'All Records' : `${cat}s`}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search records, codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
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
                <th className="py-3.5 px-5">Verified Date</th>
                <th className="py-3.5 px-5">Healthcare Provider</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No medical records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRecord(r)}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                        {getCategoryIcon(r.category)}
                        {r.category}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {r.title}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{r.description}</p>
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-blue-400">
                      {r.icd10 || '—'}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-500" />
                        {r.date}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-300">
                      {r.provider}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          r.status === 'Chronic' || r.status === 'Active'
                            ? r.category === 'Allergy'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRecord(r)
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                      >
                        <Info size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Details Slide-Over / Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5">
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

            <div className="space-y-4 text-sm">
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
                  Documented Provider
                </h4>
                <p className="text-white font-medium">{selectedRecord.provider}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Clinical Summary & Treatment
                </h4>
                <p className="text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed">
                  {selectedRecord.description}
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
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
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

      {/* Add Record Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-blue-400" /> Add Medical Record
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Record Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MedicalRecordItem['category'])}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="Diagnosis" className="bg-slate-900 text-white">Diagnosis</option>
                  <option value="Allergy" className="bg-slate-900 text-white">Allergy</option>
                  <option value="Surgery" className="bg-slate-900 text-white">Surgery / Procedure</option>
                  <option value="Immunization" className="bg-slate-900 text-white">Immunization</option>
                  <option value="Document" className="bg-slate-900 text-white">Clinical Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Record Title / Condition
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asthma, Knee Arthroscopy, Tetanus booster"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Date Documented
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Provider / Facility
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Davis or St. Jude"
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Clinical Summary / Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Details, treatment plan, symptoms, or notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
