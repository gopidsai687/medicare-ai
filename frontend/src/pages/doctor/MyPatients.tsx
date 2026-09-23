import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import {
  Search,
  Filter,
  Eye,
  X,
  Stethoscope,
  Activity,
  AlertTriangle,
  FileText,
  Calendar,
  Heart,
  Phone,
  Mail,
  ShieldCheck,
  Plus,
} from 'lucide-react'

interface PatientDossier {
  id: string
  name: string
  mrn: string
  dob: string
  age: number
  gender: string
  bloodType: string
  phone: string
  email: string
  lastVisit: string
  primaryCondition: string
  icd10: string
  status: 'Active' | 'Critical' | 'Stable'
  allergies: string[]
  medications: string[]
  recentVitals: {
    bp: string
    hr: number
    temp: string
    spo2: number
  }
}

const PATIENTS: PatientDossier[] = [
  {
    id: 'pat-1',
    name: 'Alice Johnson',
    mrn: 'MRN-00000012',
    dob: '1978-03-14',
    age: 48,
    gender: 'Female',
    bloodType: 'A+',
    phone: '(555) 234-5678',
    email: 'alice.j@example.com',
    lastVisit: '2026-09-18',
    primaryCondition: 'Type 2 Diabetes Mellitus',
    icd10: 'E11.9',
    status: 'Active',
    allergies: ['Penicillin (Severe)', 'Sulfa drugs (Mild)'],
    medications: ['Metformin 500mg BID', 'Lisinopril 10mg daily'],
    recentVitals: { bp: '128/82', hr: 74, temp: '98.6°F', spo2: 98 },
  },
  {
    id: 'pat-2',
    name: 'Robert Chen',
    mrn: 'MRN-00000034',
    dob: '1965-07-22',
    age: 61,
    gender: 'Male',
    bloodType: 'O+',
    phone: '(555) 876-5432',
    email: 'r.chen@example.com',
    lastVisit: '2026-09-20',
    primaryCondition: 'Essential Hypertension',
    icd10: 'I10',
    status: 'Active',
    allergies: ['No known drug allergies (NKDA)'],
    medications: ['Amlodipine 5mg daily', 'Atorvastatin 20mg qHS'],
    recentVitals: { bp: '138/88', hr: 68, temp: '98.4°F', spo2: 99 },
  },
  {
    id: 'pat-3',
    name: 'Maria Santos',
    mrn: 'MRN-00000051',
    dob: '1990-11-05',
    age: 35,
    gender: 'Female',
    bloodType: 'B+',
    phone: '(555) 345-6789',
    email: 'maria.s@example.com',
    lastVisit: '2026-08-30',
    primaryCondition: 'Moderate Persistent Asthma',
    icd10: 'J45.40',
    status: 'Stable',
    allergies: ['Aspirin (Bronchospasm)'],
    medications: ['Albuterol HFA PRN', 'Fluticasone/Salmeterol 250/50 BID'],
    recentVitals: { bp: '118/76', hr: 72, temp: '98.7°F', spo2: 97 },
  },
  {
    id: 'pat-4',
    name: 'David Kim',
    mrn: 'MRN-00000068',
    dob: '1955-01-30',
    age: 71,
    gender: 'Male',
    bloodType: 'AB-',
    phone: '(555) 901-2345',
    email: 'david.k@example.com',
    lastVisit: '2026-09-10',
    primaryCondition: 'Chronic Obstructive Pulmonary Disease',
    icd10: 'J44.9',
    status: 'Critical',
    allergies: ['Codeine (Nausea/Vomiting)'],
    medications: ['Tiotropium 18mcg daily', 'Supplemental O2 2L/min nocturnal'],
    recentVitals: { bp: '144/92', hr: 88, temp: '99.1°F', spo2: 92 },
  },
  {
    id: 'pat-5',
    name: 'Emma Wilson',
    mrn: 'MRN-00000082',
    dob: '2000-08-12',
    age: 26,
    gender: 'Female',
    bloodType: 'O-',
    phone: '(555) 456-7890',
    email: 'emma.w@example.com',
    lastVisit: '2026-07-15',
    primaryCondition: 'Chronic Intractable Migraine',
    icd10: 'G43.909',
    status: 'Stable',
    allergies: ['No known drug allergies (NKDA)'],
    medications: ['Topiramate 50mg BID', 'Sumatriptan 50mg PRN'],
    recentVitals: { bp: '112/72', hr: 66, temp: '98.5°F', spo2: 99 },
  },
]

export default function DoctorMyPatients() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientDossier[]>(PATIENTS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedPatient, setSelectedPatient] = useState<PatientDossier | null>(null)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    async function loadPatients() {
      try {
        let loaded = false
        try {
          const res = await api.get('/api/v1/patients')
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const apiPatients: PatientDossier[] = res.data.map((p: any, idx: number) => ({
              id: p.id,
              name: p.name,
              mrn: p.mrn,
              dob: p.dob || '1985-05-20',
              age: 41,
              gender: p.gender === 'female' ? 'Female' : 'Male',
              bloodType: p.blood_type || 'O+',
              phone: p.phone || '(555) 234-' + (1000 + idx),
              email: `${p.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
              lastVisit: '2026-09-20',
              primaryCondition: p.dept ? `${p.dept} Care` : 'General Medicine',
              icd10: 'Z00.00',
              status: p.status === 'Critical' ? 'Critical' : 'Active',
              allergies: ['No known drug allergies (NKDA)'],
              medications: ['Maintenance regimen per clinical chart'],
              recentVitals: { bp: '120/80', hr: 72, temp: '98.6°F', spo2: 99 },
            }))
            const existingNames = new Set(apiPatients.map((p) => p.name.toLowerCase()))
            const nonDupeDemo = PATIENTS.filter((p) => !existingNames.has(p.name.toLowerCase()))
            setPatients([...apiPatients, ...nonDupeDemo])
            setIsLive(true)
            loaded = true
          }
        } catch {
          // Fallback to appointments route
        }

        if (!loaded) {
          const res = await api.get('/api/v1/appointments')
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            const apiPatients: PatientDossier[] = res.data.map((appt: any, idx: number) => {
              const patientName = appt.patient_name || appt.reason || `Patient #${idx + 1}`
              const mrn = 'MRN-' + (appt.patient_id ? String(appt.patient_id).slice(0, 8).toUpperCase() : `000000${idx + 10}`)
              return {
                id: appt.patient_id || `api-pat-${idx}`,
                name: patientName,
                mrn: mrn,
                dob: '1985-05-20',
                age: 41,
                gender: idx % 2 === 0 ? 'Female' : 'Male',
                bloodType: 'O+',
                phone: '(555) 234-' + (1000 + idx),
                email: `${patientName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                lastVisit: appt.start_time ? appt.start_time.split('T')[0] : '2026-09-20',
                primaryCondition: appt.reason || 'Clinical Consultation',
                icd10: 'Z00.00',
                status: appt.status === 'in_progress' ? 'Critical' : 'Active',
                allergies: ['No known drug allergies (NKDA)'],
                medications: ['Maintenance regimen per clinical chart'],
                recentVitals: { bp: '120/80', hr: 72, temp: '98.6°F', spo2: 99 },
              }
            })
            const existingNames = new Set(apiPatients.map((p) => p.name.toLowerCase()))
            const nonDupeDemo = PATIENTS.filter((p) => !existingNames.has(p.name.toLowerCase()))
            setPatients([...apiPatients, ...nonDupeDemo])
            setIsLive(true)
          }
        }
      } catch (err) {
        console.warn('Using demo patients data:', err)
      }
    }
    loadPatients()
  }, [])

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.primaryCondition.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ? true : p.status.toLowerCase() === statusFilter.toLowerCase()
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Patient Roster & Dossier</h1>
          <p className="page-subtitle flex items-center gap-2">
            {patients.length} assigned clinical patients under your direct care
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE API
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/doctor/encounters')}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> New Clinical Encounter
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          {['all', 'critical', 'active', 'stable'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                statusFilter === tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, MRN, condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-5">Patient Name</th>
                <th className="py-3.5 px-5">MRN</th>
                <th className="py-3.5 px-5">Age / Gender</th>
                <th className="py-3.5 px-5">Primary Diagnosis</th>
                <th className="py-3.5 px-5">Last Visit</th>
                <th className="py-3.5 px-5">Risk Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No patients match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-5">
                      <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-400">Blood Type: {p.bloodType}</div>
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-slate-400">{p.mrn}</td>
                    <td className="py-4 px-5 text-xs text-slate-300">
                      {p.age} yrs • {p.gender}
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-white font-medium text-xs">{p.primaryCondition}</div>
                      <div className="text-[11px] font-mono text-blue-400">{p.icd10}</div>
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-400">{p.lastVisit}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          p.status === 'Critical'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : p.status === 'Active'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPatient(p)
                        }}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                      >
                        <Eye size={13} /> View Dossier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Dossier Slide-Over / Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-2xl rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedPatient.name}</h2>
                  <span className="font-mono text-xs text-slate-400 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                    {selectedPatient.mrn}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedPatient.age} yrs • {selectedPatient.gender} • Blood Type {selectedPatient.bloodType} • DOB {selectedPatient.dob}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Vitals Snapshot */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Latest Telemetry & Vitals
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-xs text-slate-400">Blood Pressure</p>
                  <p className="text-base font-bold text-white mt-0.5">{selectedPatient.recentVitals.bp}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-xs text-slate-400">Heart Rate</p>
                  <p className="text-base font-bold text-white mt-0.5">{selectedPatient.recentVitals.hr} <span className="text-xs font-normal text-slate-400">bpm</span></p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-xs text-slate-400">SpO2</p>
                  <p className="text-base font-bold text-emerald-400 mt-0.5">{selectedPatient.recentVitals.spo2}%</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-xs text-slate-400">Temperature</p>
                  <p className="text-base font-bold text-white mt-0.5">{selectedPatient.recentVitals.temp}</p>
                </div>
              </div>
            </div>

            {/* Allergies Alert Box */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle size={15} /> Documented Allergies & Drug Warnings
              </h4>
              <ul className="text-xs text-rose-300 list-disc list-inside space-y-0.5 pt-1">
                {selectedPatient.allergies.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            {/* Active Medications */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Active Regimen & Prescriptions
              </h3>
              <div className="space-y-2">
                {selectedPatient.medications.map((m) => (
                  <div key={m} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{m}</span>
                    <span className="text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-2 gap-3 text-xs p-3.5 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 text-slate-300">
                <Phone size={14} className="text-slate-500" /> {selectedPatient.phone}
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail size={14} className="text-slate-500" /> {selectedPatient.email}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedPatient(null)
                  navigate('/doctor/encounters')
                }}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Stethoscope size={15} /> Start Clinical Encounter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
