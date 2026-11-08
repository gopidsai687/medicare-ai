import React, { useState, useEffect } from 'react'
import { X, Edit2, ShieldAlert, Check, AlertCircle, RefreshCw, Clock, RotateCcw, Cpu } from 'lucide-react'
import api from '@/lib/api'
import { LabResultItem } from './AddLabResultModal'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: any) => void
  labToEdit: LabResultItem | null
}

export const EditLabResultModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  labToEdit,
}) => {
  const [value, setValue] = useState<string>('')
  const [unit, setUnit] = useState<string>('')
  const [referenceRange, setReferenceRange] = useState<string>('')
  const [measurementTime, setMeasurementTime] = useState<string>('')
  const [measurementType, setMeasurementType] = useState<string>('')
  const [fastingStatus, setFastingStatus] = useState<string>('')
  const [deviceName, setDeviceName] = useState<string>('')
  const [orderingPhysician, setOrderingPhysician] = useState<string>('')
  const [laboratoryName, setLaboratoryName] = useState<string>('')
  const [clinicalNotes, setClinicalNotes] = useState<string>('')
  const [amendmentReason, setAmendmentReason] = useState<string>('')

  // Repeat Check Fields
  const [hasRepeatReading, setHasRepeatReading] = useState(false)
  const [repeatValue, setRepeatValue] = useState<string>('')
  const [repeatTime, setRepeatTime] = useState<string>('')
  const [repeatNotes, setRepeatNotes] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (labToEdit) {
      setValue(String(labToEdit.value))
      setUnit(labToEdit.unit || '')
      setReferenceRange(labToEdit.reference_range || '')
      setMeasurementTime(labToEdit.measurement_time || '')
      setMeasurementType(labToEdit.measurement_type || '')
      setFastingStatus(labToEdit.fasting_status || '')
      setDeviceName(labToEdit.device_name || labToEdit.laboratory_name || '')
      setOrderingPhysician(labToEdit.orderedBy || '')
      setLaboratoryName(labToEdit.laboratory_name || '')
      setClinicalNotes(labToEdit.clinical_notes || '')
      setAmendmentReason('')

      if (labToEdit.repeat_value !== undefined && labToEdit.repeat_value !== null) {
        setHasRepeatReading(true)
        setRepeatValue(String(labToEdit.repeat_value))
        setRepeatTime(labToEdit.repeat_time || '')
        setRepeatNotes(labToEdit.repeat_notes || '')
      } else {
        setHasRepeatReading(false)
        setRepeatValue('')
        setRepeatTime('')
        setRepeatNotes('')
      }
      setErrorMessage(null)
    }
  }, [labToEdit])

  if (!isOpen || !labToEdit) return null

  const isOfficial = labToEdit.source !== 'patient_entered'
  const isHome = labToEdit.result_type === 'home_monitoring' || labToEdit.category === 'Home Monitoring' || (labToEdit.name || '').toLowerCase().includes('fingerstick')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numVal = parseFloat(value)
    if (isNaN(numVal)) {
      setErrorMessage('Please enter a valid numerical result value.')
      return
    }

    const repVal = hasRepeatReading && repeatValue.trim() ? parseFloat(repeatValue) : undefined
    if (hasRepeatReading && repVal !== undefined && isNaN(repVal)) {
      setErrorMessage('Please enter a valid numerical repeat check value.')
      return
    }

    if (isOfficial && amendmentReason.trim().length < 5) {
      setErrorMessage('Clinical amendment reason is required (minimum 5 characters).')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      if (isOfficial) {
        // Amendment workflow
        const res = await api.post(`/api/v1/labs/results/${labToEdit.id}/amend`, {
          value: numVal,
          reason: amendmentReason.trim(),
          clinical_notes: clinicalNotes.trim() || undefined,
        })
        onSuccess(res.data)
      } else {
        // Direct edit for patient-entered record
        const res = await api.put(`/api/v1/labs/results/${labToEdit.id}`, {
          value: numVal,
          unit: unit.trim(),
          reference_range: referenceRange.trim() || undefined,
          measurement_time: measurementTime.trim() || undefined,
          measurement_type: measurementType.trim() || undefined,
          fasting_status: fastingStatus.trim() || undefined,
          device_name: deviceName.trim() || undefined,
          repeat_value: repVal,
          repeat_time: hasRepeatReading ? repeatTime.trim() : undefined,
          repeat_notes: hasRepeatReading ? repeatNotes.trim() : undefined,
          ordering_physician: isHome ? `Source: ${deviceName.trim() || 'Home Glucose Meter'}` : (orderingPhysician.trim() || undefined),
          laboratory_name: isHome ? (deviceName.trim() || 'Home Glucose Meter') : (laboratoryName.trim() || undefined),
          clinical_notes: clinicalNotes.trim() || undefined,
        })
        onSuccess(res.data)
      }
      onClose()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to update laboratory record.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b1527] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 md:p-8 space-y-5 my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isOfficial ? 'bg-amber-600/20 text-amber-400' : 'bg-blue-600/20 text-blue-400'}`}>
              {isOfficial ? <ShieldAlert className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isOfficial ? 'Clinical Result Amendment' : 'Edit Diagnostic Measurement'}
              </h3>
              <p className="text-xs text-slate-400">{labToEdit.name} ({labToEdit.panel_name})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provenance Banner */}
        {isOfficial ? (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              Official Laboratory Audit Integrity Protection
            </div>
            <p className="text-slate-300">
              Original laboratory readings are never silently overwritten.
              Your change will be preserved as an amendment with the original value ({labToEdit.value} {labToEdit.unit})
              archived in the legal audit log.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Editing <strong>{isHome ? 'Home Monitoring Check' : 'Patient-Entered Result'}</strong>. Changes update active telemetry with full version audit trail.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-300">
          {/* Primary Reading & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {hasRepeatReading ? 'Initial Reading Value *' : 'Measurement Value *'}
              </label>
              <input
                type="number"
                step="any"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Unit of Measure *
              </label>
              <input
                type="text"
                required
                disabled={isOfficial}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Time & Device for Home Monitoring */}
          {!isOfficial && isHome && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                  <Clock size={12} /> Measurement Time
                </label>
                <input
                  type="time"
                  value={measurementTime}
                  onChange={(e) => setMeasurementTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                  <Cpu size={12} /> Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Contour Next Gen Meter"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Repeat Verification Check Feature (Requirement 2) */}
          {!isOfficial && (
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white mb-2">
                <input
                  type="checkbox"
                  checked={hasRepeatReading}
                  onChange={(e) => setHasRepeatReading(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                />
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={13} className="text-cyan-400" />
                  Include Repeat Verification Reading
                </span>
              </label>

              {hasRepeatReading && (
                <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Repeat Check Value ({unit}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={repeatValue}
                        onChange={(e) => setRepeatValue(e.target.value)}
                        placeholder="e.g. 110"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                        <Clock size={12} /> Repeat Check Time
                      </label>
                      <input
                        type="time"
                        value={repeatTime}
                        onChange={(e) => setRepeatTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Repeat Verification Notes
                    </label>
                    <input
                      type="text"
                      value={repeatNotes}
                      onChange={(e) => setRepeatNotes(e.target.value)}
                      placeholder="e.g. Repeat check on second fingerstick to verify calibration"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reference Range */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Reference Interval / Target Range
            </label>
            <input
              type="text"
              disabled={isOfficial}
              value={referenceRange}
              onChange={(e) => setReferenceRange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Official Amendment Justification */}
          {isOfficial && (
            <div>
              <label className="block text-amber-300 font-semibold mb-1">
                Clinical Justification / Amendment Reason *
              </label>
              <textarea
                required
                rows={2}
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                placeholder="State the clinical rationale for modifying this diagnostic record..."
                className="w-full bg-slate-950 border border-amber-500/50 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* Clinical Notes */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Clinical Notes &amp; Observations
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                isOfficial ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>Saving...</>
              ) : isOfficial ? (
                <>
                  <ShieldAlert size={14} /> Submit Clinical Amendment
                </>
              ) : (
                <>
                  <Check size={14} /> Update Measurement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
