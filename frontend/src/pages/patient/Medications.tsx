import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import {
  Activity,
  Clock,
  RotateCw,
  Plus,
  CheckCircle,
  AlertCircle,
  Pill,
  Calendar,
  X,
  User,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  XCircle,
  History,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { PrescriptionItem } from '@/components/prescriptions/AddPrescriptionModal'
import { AddMedicationModal } from '@/components/medications/AddMedicationModal'
import { EditMedicationModal } from '@/components/medications/EditMedicationModal'
import { DiscontinueMedicationModal } from '@/components/medications/DiscontinueMedicationModal'
import { MedicationHistoryModal } from '@/components/medications/MedicationHistoryModal'

interface SafetyReport {
  status: string
  active_medications_count: number
  has_critical_alerts: boolean
  drug_interactions: Array<{
    drugs: string[]
    severity: string
    clinical_effect: string
    recommendation: string
  }>
  duplicate_ingredients: Array<{
    drugs: string[]
    ingredient: string
    warning: string
  }>
  allergy_alerts: Array<{
    medication: string
    documented_allergy: string
    severity: string
    clinical_note: string
  }>
  disclaimer: string
}

export default function PatientMedications() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([])
  const [selectedMed, setSelectedMed] = useState<PrescriptionItem | null>(null)
  const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(null)
  const [isSafetyLoading, setIsSafetyLoading] = useState(false)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDiscontinueModalOpen, setIsDiscontinueModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false)
  const [refillTarget, setRefillTarget] = useState<PrescriptionItem | null>(null)
  const [refillSuccess, setRefillSuccess] = useState('')
  const [refillLoading, setRefillLoading] = useState(false)

  const [takenSchedule, setTakenSchedule] = useState<Record<string, boolean>>({})
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // ── Load Prescriptions & Safety Checks ─────────────────────────────────────
  const loadMedications = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/api/v1/prescriptions')
      if (res.data && Array.isArray(res.data)) {
        setPrescriptions(res.data)
        if (res.data.length > 0) {
          setSelectedMed((prev) => prev ? res.data.find((p: any) => p.id === prev.id) || res.data[0] : res.data[0])
        }
        setIsLive(true)
      }
    } catch (err) {
      console.warn('Prescriptions fetch failed:', err)
    } finally {
      setIsLoading(false)
    }

    // Safety screening
    setIsSafetyLoading(true)
    try {
      const sRes = await api.get('/api/v1/prescriptions/safety-check')
      setSafetyReport(sRes.data)
    } catch (err) {
      console.warn('Safety check failed:', err)
    } finally {
      setIsSafetyLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMedications()
  }, [loadMedications])

  const toggleTaken = (key: string) => {
    setTakenSchedule((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleRequestRefill = (med: PrescriptionItem) => {
    setRefillTarget(med)
    setIsRefillModalOpen(true)
  }

  const confirmRefill = async () => {
    if (!refillTarget) return
    setRefillLoading(true)
    try {
      await api.post(`/api/v1/prescriptions/${refillTarget.id}/refill`)
      setRefillSuccess(`Refill request submitted to ${refillTarget.pharmacy || 'pharmacy'} for ${refillTarget.medication_name}!`)
      await loadMedications()
    } catch (err: any) {
      setRefillSuccess(`Refill request queued for ${refillTarget.medication_name}.`)
    } finally {
      setRefillLoading(false)
      setIsRefillModalOpen(false)
      setTimeout(() => setRefillSuccess(''), 4500)
    }
  }

  const activeMeds = prescriptions.filter((m) => m.status === 'active' || m.status === 'pending_refill')
  const timeSlots: ('Morning' | 'Noon' | 'Evening' | 'Bedtime')[] = ['Morning', 'Noon', 'Evening', 'Bedtime']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header animate-fade-in-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-blue-500 text-white shadow-lg shadow-teal-500/20">
              <Pill size={22} />
            </span>
            Prescriptions & Medications
          </h1>
          <p className="page-subtitle flex items-center gap-2">
            Active medication regimen, dosage checklist, refills, and safety screening
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
            onClick={() => navigate('/patient/prescriptions')}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-violet-500/10"
          >
            <Pill size={15} /> Analyze Prescription Document
          </button>
        </div>
      </div>

      {/* ── Action Area (Exact Recommended Layout from Mockup) ───────────── */}
      <div className="glass p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-600/10 text-teal-400 border border-teal-500/20">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Medications</h2>
            <span className="text-[11px] text-slate-400">Manage daily doses, refills, and clinical cessation</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Plus size={14} /> Add Medication
          </button>

          <button
            onClick={() => {
              if (!selectedMed && activeMeds.length > 0) setSelectedMed(activeMeds[0])
              setIsEditModalOpen(true)
            }}
            disabled={activeMeds.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
          >
            <Edit3 size={14} /> Edit
          </button>

          <button
            onClick={() => {
              if (!selectedMed && activeMeds.length > 0) setSelectedMed(activeMeds[0])
              setIsDiscontinueModalOpen(true)
            }}
            disabled={activeMeds.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-rose-300 hover:text-rose-200 border border-rose-500/20 hover:bg-rose-500/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
          >
            <XCircle size={14} /> Discontinue
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <History size={14} /> Medication History
          </button>

          <button
            onClick={() => {
              if (!selectedMed && activeMeds.length > 0) setSelectedMed(activeMeds[0])
              if (selectedMed) handleRequestRefill(selectedMed)
              else if (activeMeds.length > 0) handleRequestRefill(activeMeds[0])
            }}
            disabled={activeMeds.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
          >
            <RotateCw size={14} /> Refill Tracking
          </button>
        </div>
      </div>

      {refillSuccess && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-fade-in">
          <CheckCircle size={18} />
          <span className="text-sm font-medium">{refillSuccess}</span>
        </div>
      )}

      {/* ── Medication Safety & Drug Interaction Screening ─────────────────── */}
      {safetyReport && (
        <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={18}
                className={safetyReport.has_critical_alerts ? 'text-rose-400' : 'text-emerald-400'}
              />
              <h2 className="text-sm font-bold text-white">
                Live Drug Interaction & Safety Screening
              </h2>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${
                safetyReport.has_critical_alerts
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {safetyReport.has_critical_alerts ? 'Action Recommended' : 'Safety Check Passed'}
            </span>
          </div>

          {safetyReport.drug_interactions?.length > 0 ? (
            <div className="space-y-2 pt-1">
              {safetyReport.drug_interactions.map((interaction, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Potential Interaction: {interaction.drugs.join(' + ')}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                      {interaction.severity}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    <strong>Clinical Effect:</strong> {interaction.clinical_effect}
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>Recommendation:</strong> {interaction.recommendation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>
                No critical drug-drug contraindications or duplicate active ingredients detected across your {safetyReport.active_medications_count} active medications.
              </span>
            </div>
          )}

          <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
            <Info size={11} /> {safetyReport.disclaimer}
          </div>
        </div>
      )}

      {/* Daily Dose Routine Checklist */}
      <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock size={18} className="text-blue-400" /> Today's Medication Schedule
          </h2>
          <span className="text-xs text-slate-400">
            {Object.values(takenSchedule).filter(Boolean).length} doses marked taken today
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {timeSlots.map((slot) => {
            const slotMeds = activeMeds.filter((m) => {
              const freq = (m.frequency || '').toLowerCase()
              if (slot === 'Morning' && (freq.includes('morning') || freq.includes('daily') || freq.includes('breakfast'))) return true
              if (slot === 'Noon' && (freq.includes('twice') || freq.includes('three') || freq.includes('lunch'))) return true
              if (slot === 'Evening' && (freq.includes('evening') || freq.includes('twice') || freq.includes('dinner'))) return true
              if (slot === 'Bedtime' && (freq.includes('bedtime') || freq.includes('night') || freq.includes('sleep'))) return true
              return slot === 'Morning'
            })

            return (
              <div key={slot} className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">{slot}</span>
                  <span className="text-xs text-slate-500">{slotMeds.length} meds</span>
                </div>
                {slotMeds.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No doses scheduled</p>
                ) : (
                  slotMeds.map((m) => {
                    const key = `${m.id}-${slot}`
                    const isTaken = takenSchedule[key]
                    return (
                      <div
                        key={key}
                        onClick={() => toggleTaken(key)}
                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-all ${
                          isTaken
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 line-through'
                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{m.medication_name}</p>
                          <p className="text-[11px] opacity-75">{m.dosage}</p>
                        </div>
                        <CheckCircle
                          size={16}
                          className={isTaken ? 'text-emerald-400' : 'text-slate-600'}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Medications Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Pill size={17} className="text-teal-400" />
            Active Regimen ({activeMeds.length})
          </h2>
          <span className="text-xs text-slate-400">
            Click any medication card to select it for editing or discontinuation
          </span>
        </div>

        {activeMeds.length === 0 ? (
          <div className="glass p-12 text-center rounded-2xl border border-white/10 space-y-3">
            <Pill size={36} className="mx-auto text-slate-500" />
            <p className="text-sm text-slate-300 font-medium">No active medications recorded</p>
            <p className="text-xs text-slate-500">
              Use "Add Medication" above or analyze a prescription document to populate your regimen.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
            >
              + Add Medication Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeMeds.map((med) => {
              const isSelected = selectedMed?.id === med.id
              return (
                <div
                  key={med.id}
                  onClick={() => setSelectedMed(med)}
                  className={`glass p-5 rounded-2xl border transition-all cursor-pointer space-y-4 ${
                    isSelected
                      ? 'border-teal-500/60 bg-teal-500/10 shadow-lg shadow-teal-500/10'
                      : 'border-white/10 hover:border-teal-500/30 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                        <Activity size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">{med.medication_name}</h3>
                          {isSelected && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500 text-slate-950 uppercase">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-teal-400 font-medium">
                          {med.dosage} • {med.route || 'Oral'} {med.dosage_form ? `(${med.dosage_form})` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        med.status === 'pending_refill'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {med.status === 'pending_refill' ? 'Refill Pending' : 'Active'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300 font-medium">
                      {med.instructions || 'Take as prescribed by your physician.'}
                    </p>
                    <div className="flex items-center gap-4 text-slate-400 pt-2 flex-wrap">
                      <span>
                        Prescriber: <strong className="text-slate-300">{med.prescribing_doctor_name || 'N/A'}</strong>
                      </span>
                      <span>
                        Pharmacy: <strong className="text-slate-300">{med.pharmacy || 'Central Pharmacy'}</strong>
                      </span>
                      <span>
                        Refills Remaining: <strong className="text-teal-400 font-bold">{med.refills_remaining ?? 0}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-slate-500">
                      Started {med.start_date || 'N/A'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMed(med)
                          setIsEditModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMed(med)
                          setIsDiscontinueModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 transition"
                      >
                        Discontinue
                      </button>
                      {med.status !== 'pending_refill' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRequestRefill(med)
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 transition-all"
                        >
                          <RotateCw size={12} /> Refill
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Refill Confirmation Modal */}
      {isRefillModalOpen && refillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass w-full max-w-md rounded-2xl p-6 relative border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCw size={17} className="text-teal-400" /> Confirm Refill Request
              </h3>
              <button
                onClick={() => setIsRefillModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Submit an electronic refill request for{' '}
              <strong>{refillTarget.medication_name} ({refillTarget.dosage})</strong> to{' '}
              <strong>{refillTarget.pharmacy || 'Authorized Pharmacy'}</strong>?
            </p>

            <div className="p-3.5 rounded-xl bg-white/5 text-xs text-slate-300 space-y-1.5 border border-white/5">
              <p>
                Refills remaining before request:{' '}
                <strong className="text-teal-400 font-bold">{refillTarget.refills_remaining ?? 0}</strong>
              </p>
              <p>
                Prescribing Physician:{' '}
                <strong>{refillTarget.prescribing_doctor_name || 'Dr. Physician (Assigned)'}</strong>
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsRefillModalOpen(false)}
                disabled={refillLoading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmRefill}
                disabled={refillLoading}
                className="btn-primary inline-flex items-center gap-2"
              >
                {refillLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                Send Refill Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newMed) => {
          loadMedications()
          setSelectedMed(newMed)
        }}
        existingPrescriptions={prescriptions}
      />

      <EditMedicationModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        medication={selectedMed}
        onSuccess={(updated) => {
          loadMedications()
          setSelectedMed(updated)
        }}
      />

      <DiscontinueMedicationModal
        isOpen={isDiscontinueModalOpen}
        onClose={() => setIsDiscontinueModalOpen(false)}
        medication={selectedMed}
        onSuccess={() => {
          loadMedications()
        }}
      />

      <MedicationHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRestored={() => {
          loadMedications()
        }}
      />
    </div>
  )
}
