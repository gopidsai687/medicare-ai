import { useState, useEffect } from 'react'
import api from '@/lib/api'
import {
  Building2,
  Users,
  Bed,
  Activity,
  Plus,
  Search,
  Filter,
  Phone,
  MapPin,
  X,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Edit2,
  CheckCircle2,
} from 'lucide-react'

interface Department {
  id: string
  name: string
  code: string
  director: string
  location: string
  bedsTotal: number
  bedsOccupied: number
  staffCount: number
  monthlyVisits: number
  status: 'Operational' | 'High Occupancy' | 'Maintenance'
  phone: string
}

const INITIAL_DEPARTMENTS: Department[] = [
  {
    id: 'dept-1',
    name: 'Cardiovascular Medicine & Surgery',
    code: 'CARD',
    director: 'Dr. Sarah Chen, MD, FACC',
    location: 'North Tower — Floor 4',
    bedsTotal: 65,
    bedsOccupied: 60,
    staffCount: 18,
    monthlyVisits: 640,
    status: 'High Occupancy',
    phone: '(555) 019-2831',
  },
  {
    id: 'dept-2',
    name: 'Endocrinology & Metabolic Disease',
    code: 'ENDO',
    director: 'Dr. James Kim, MD',
    location: 'West Wing — Floor 3',
    bedsTotal: 45,
    bedsOccupied: 38,
    staffCount: 12,
    monthlyVisits: 480,
    status: 'Operational',
    phone: '(555) 019-2832',
  },
  {
    id: 'dept-3',
    name: 'Emergency & Level 1 Trauma Center',
    code: 'EMERG',
    director: 'Dr. Marcus Vance, MD, FACEP',
    location: 'Ground Level — Pavilion A',
    bedsTotal: 80,
    bedsOccupied: 77,
    staffCount: 28,
    monthlyVisits: 1120,
    status: 'High Occupancy',
    phone: '(555) 019-9911',
  },
  {
    id: 'dept-4',
    name: 'Pulmonology & Critical Care',
    code: 'PULM',
    director: 'Dr. Alex Taylor, MD, FCCP',
    location: 'North Tower — Floor 5',
    bedsTotal: 50,
    bedsOccupied: 44,
    staffCount: 14,
    monthlyVisits: 410,
    status: 'Operational',
    phone: '(555) 019-2834',
  },
  {
    id: 'dept-5',
    name: 'General Internal Medicine',
    code: 'INTMED',
    director: 'Dr. Maria Lopez, MD',
    location: 'East Pavilion — Floor 2',
    bedsTotal: 90,
    bedsOccupied: 74,
    staffCount: 24,
    monthlyVisits: 890,
    status: 'Operational',
    phone: '(555) 019-2835',
  },
  {
    id: 'dept-6',
    name: 'Neurology & Comprehensive Stroke',
    code: 'NEURO',
    director: 'Dr. Elena Rostova, MD, PhD',
    location: 'West Wing — Floor 4',
    bedsTotal: 55,
    bedsOccupied: 50,
    staffCount: 16,
    monthlyVisits: 520,
    status: 'Operational',
    phone: '(555) 019-2836',
  },
  {
    id: 'dept-7',
    name: 'Orthopedics & Joint Replacement',
    code: 'ORTHO',
    director: 'Dr. Brian Hayes, MD, FAAOS',
    location: 'Surgical Center — Floor 2',
    bedsTotal: 45,
    bedsOccupied: 35,
    staffCount: 10,
    monthlyVisits: 380,
    status: 'Operational',
    phone: '(555) 019-2837',
  },
  {
    id: 'dept-8',
    name: 'Oncology & Infusion Center',
    code: 'ONC',
    director: 'Dr. Clara Thorne, MD',
    location: 'East Pavilion — Floor 4',
    bedsTotal: 50,
    bedsOccupied: 46,
    staffCount: 15,
    monthlyVisits: 490,
    status: 'Operational',
    phone: '(555) 019-2838',
  },
]

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS)
  const [searchQuery, setSearchQuery] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editDept, setEditDept] = useState<Department | null>(null)
  const [isLive, setIsLive] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formDirector, setFormDirector] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formBeds, setFormBeds] = useState(50)
  const [formStaff, setFormStaff] = useState(12)
  const [formPhone, setFormPhone] = useState('')

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await api.get('/api/v1/departments')
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const apiDepts: Department[] = res.data.map((d: any) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            director: d.director || 'Dr. Department Chair',
            location: d.location || 'Central Facility',
            bedsTotal: d.bedsTotal ?? 50,
            bedsOccupied: d.bedsOccupied ?? 35,
            staffCount: d.staffCount ?? 15,
            monthlyVisits: d.monthlyVisits ?? 400,
            status: d.status || 'Operational',
            phone: d.phone || '(555) 019-2830',
          }))
          const existingCodes = new Set(apiDepts.map(d => d.code.toUpperCase()))
          const nonDupeDemo = INITIAL_DEPARTMENTS.filter(d => !existingCodes.has(d.code.toUpperCase()))
          setDepartments([...apiDepts, ...nonDupeDemo])
          setIsLive(true)
        }
      } catch (err) {
        console.warn('Using demo departments data:', err)
      }
    }
    loadDepartments()
  }, [])

  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault()
    if (editDept) {
      setDepartments(
        departments.map((d) =>
          d.id === editDept.id
            ? {
                ...d,
                name: formName,
                code: formCode.toUpperCase(),
                director: formDirector,
                location: formLocation,
                bedsTotal: Number(formBeds),
                staffCount: Number(formStaff),
                phone: formPhone,
              }
            : d
        )
      )
      setEditDept(null)
    } else {
      const newDept: Department = {
        id: `dept-${Date.now()}`,
        name: formName,
        code: formCode.toUpperCase(),
        director: formDirector || 'Dr. Department Chair',
        location: formLocation || 'Main Hospital Facility',
        bedsTotal: Number(formBeds),
        bedsOccupied: Math.floor(Number(formBeds) * 0.75),
        staffCount: Number(formStaff),
        monthlyVisits: 350,
        status: 'Operational',
        phone: formPhone || '(555) 019-2800',
      }

      api.post('/api/v1/departments', {
        name: formName,
        code: formCode.toUpperCase(),
        director: formDirector,
        location: formLocation,
        bedsTotal: Number(formBeds),
        staffCount: Number(formStaff),
        phone: formPhone,
      }).catch(err => console.warn('Could not persist department to backend:', err))

      setDepartments([...departments, newDept])
      setShowAddModal(false)
    }

    // Reset
    setFormName('')
    setFormCode('')
    setFormDirector('')
    setFormLocation('')
    setFormPhone('')
  }

  const openEdit = (dept: Department) => {
    setEditDept(dept)
    setFormName(dept.name)
    setFormCode(dept.code)
    setFormDirector(dept.director)
    setFormLocation(dept.location)
    setFormBeds(dept.bedsTotal)
    setFormStaff(dept.staffCount)
    setFormPhone(dept.phone)
  }

  const filteredDepts = departments.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.director.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLocation =
      locationFilter === 'ALL' || d.location.toLowerCase().includes(locationFilter.toLowerCase())
    return matchesSearch && matchesLocation
  })

  const totalBeds = departments.reduce((acc, d) => acc + d.bedsTotal, 0)
  const occupiedBeds = departments.reduce((acc, d) => acc + d.bedsOccupied, 0)
  const totalStaff = departments.reduce((acc, d) => acc + d.staffCount, 0)
  const totalVisits = departments.reduce((acc, d) => acc + d.monthlyVisits, 0)
  const occupancyPct = Math.round((occupiedBeds / totalBeds) * 100)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
              <Building2 size={22} />
            </span>
            Hospital Departments & Resource Governance
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Clinical unit census, bed capacity, staffing allocation, and departmental directorate
            {isLive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE CENSUS
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => {
            setEditDept(null)
            setFormName('')
            setFormCode('')
            setFormDirector('')
            setFormLocation('')
            setFormPhone('')
            setShowAddModal(true)
          }}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} /> Add Clinical Department
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Active Departments</span>
          <p className="text-2xl font-bold text-white font-display">{departments.length}</p>
          <span className="text-[11px] text-teal-400 font-medium">Full clinical service spectrum</span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Inpatient Bed Capacity</span>
          <p className="text-2xl font-bold text-white font-display">
            {occupiedBeds} <span className="text-sm font-normal text-slate-400">/ {totalBeds}</span>
          </p>
          <span className="text-[11px] text-amber-400 font-medium">
            {occupancyPct}% Hospital Occupancy Rate
          </span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Clinical Staff Census</span>
          <p className="text-2xl font-bold text-blue-400 font-display">{totalStaff}</p>
          <span className="text-[11px] text-slate-400">Attending MDs & Specialists</span>
        </div>

        <div className="glass p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Monthly Patient Encounters</span>
          <p className="text-2xl font-bold text-emerald-400 font-display">{totalVisits.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp size={12} /> Across all specialized wings
          </span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by department, director, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {(['ALL', 'North Tower', 'West Wing', 'East Pavilion', 'Surgical'] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                locationFilter === loc
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {filteredDepts.map((dept) => {
          const occRate = Math.round((dept.bedsOccupied / dept.bedsTotal) * 100)
          return (
            <div
              key={dept.id}
              className="glass p-5 rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all space-y-4 relative group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">
                      {dept.code}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        dept.status === 'High Occupancy'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {dept.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base leading-snug">{dept.name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin size={12} className="text-teal-400 shrink-0" /> {dept.location}
                  </p>
                </div>

                <button
                  onClick={() => openEdit(dept)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Edit Department Details"
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {/* Directorate & Contact */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Medical Director:</span>
                  <span className="font-semibold text-white">{dept.director}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Direct Contact:</span>
                  <span className="font-mono text-slate-300">{dept.phone}</span>
                </div>
              </div>

              {/* Bed Occupancy Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Bed size={13} className="text-blue-400" /> Inpatient Bed Capacity:
                  </span>
                  <span className="font-semibold text-white">
                    {dept.bedsOccupied} / {dept.bedsTotal} beds ({occRate}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      occRate >= 90 ? 'bg-rose-500' : occRate >= 80 ? 'bg-amber-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${occRate}%` }}
                  />
                </div>
              </div>

              {/* Bottom stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users size={14} className="text-indigo-400 shrink-0" />
                  <span>
                    Staff: <strong className="text-white">{dept.staffCount} MDs/Nurses</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 justify-end">
                  <Activity size={14} className="text-emerald-400 shrink-0" />
                  <span>
                    Volume: <strong className="text-white">{dept.monthlyVisits} / mo</strong>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editDept) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass w-full max-w-lg rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 size={18} className="text-blue-400" />
                {editDept ? 'Update Department Configuration' : 'Register New Clinical Department'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditDept(null)
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Department Name:</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dermatology & Cutaneous Surgery"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Unit Code:</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="DERM"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono uppercase focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Medical Director / Department Head:</label>
                <input
                  type="text"
                  value={formDirector}
                  onChange={(e) => setFormDirector(e.target.value)}
                  placeholder="e.g. Dr. Robert Vance, MD"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Hospital Location / Wing:</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="North Tower — Floor 6"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Direct Phone Extension:</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(555) 019-2840"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Total Inpatient Beds:</label>
                  <input
                    type="number"
                    value={formBeds}
                    onChange={(e) => setFormBeds(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Clinical Staff Count:</label>
                  <input
                    type="number"
                    value={formStaff}
                    onChange={(e) => setFormStaff(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditDept(null)
                  }}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary px-5 py-2">
                  {editDept ? 'Update Department' : 'Save & Allocate Beds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
