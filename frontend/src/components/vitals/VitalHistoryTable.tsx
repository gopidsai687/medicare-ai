import React, { useState, useMemo } from 'react'
import {
  FileText,
  Clock,
  Trash2,
  Edit2,
  Download,
  Filter,
  FileSpreadsheet,
  FileJson,
  FlaskConical,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'

export interface VitalLogRecord {
  id: string
  patient_id?: string
  recorded_at: string
  systolic_bp?: number | null
  diastolic_bp?: number | null
  heart_rate?: number | null
  blood_glucose?: number | null
  blood_glucose_mmol?: number | null
  glucose_unit?: string
  glucose_context?: string | null
  weight?: number | null
  height?: number | null
  measurement_source: string
  is_patient_entered?: boolean
  is_sample: boolean
  device_name?: string | null
  notes?: string | null
  clinical_notes?: string | null
  bp_category?: string | null
  glucose_category?: string | null
  mean_arterial_pressure?: number | null
  [key: string]: any
}

export interface VitalHistoryTableProps {
  vitals: any[]
  onEdit: (vital: any) => void
  onDelete: (vitalId: string) => void
  onExport: (format: 'csv' | 'json') => void
}

export const VitalHistoryTable: React.FC<VitalHistoryTableProps> = ({
  vitals = [],
  onEdit,
  onDelete,
  onExport,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'bp' | 'glucose' | 'hr' | 'weight'>('all')
  const [filterSource, setFilterSource] = useState<'all' | 'real' | 'manual' | 'demo'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  // Filter records
  const filtered = useMemo(() => {
    return vitals.filter((v) => {
      // Type filter
      if (filterType === 'bp' && (v.systolic_bp == null || v.diastolic_bp == null)) return false
      if (filterType === 'glucose' && v.blood_glucose == null) return false
      if (filterType === 'hr' && v.heart_rate == null) return false
      if (filterType === 'weight' && v.weight == null) return false

      // Source filter
      if (filterSource === 'demo' && !v.is_sample) return false
      if (filterSource === 'real' && (v.is_sample || !v.measurement_source?.includes('device'))) return false
      if (filterSource === 'manual' && (v.is_sample || !v.measurement_source?.startsWith('manual'))) return false

      return true
    })
  }, [vitals, filterType, filterSource])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, currentPage])

  // Provenance Badge
  const renderSourceBadge = (source: string, isSample: boolean, deviceName?: string | null) => {
    if (isSample || source === 'SAMPLE_DATA' || source === 'sample_data') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <FlaskConical size={10} /> DEMO DATA
        </span>
      )
    }
    if (
      source === 'measured_device' ||
      source === 'omron_connect' ||
      source === 'dexcom_cgm' ||
      source?.includes('ble')
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <ShieldCheck size={10} /> REAL DEVICE
        </span>
      )
    }
    if (
      source === 'apple_health' ||
      source === 'google_health_connect' ||
      source === 'ehr_import' ||
      source === 'import'
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
          <Download size={10} /> IMPORTED
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
        <FileText size={10} /> Manual Entry — Not Device Verified
      </span>
    )
  }

  // Guideline Category Badges
  const renderCategoryBadge = (record: VitalLogRecord) => {
    if (record.bp_category) {
      const cat = record.bp_category
      if (cat === 'Normal') {
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Normal (AHA)</span>
      }
      if (cat === 'Elevated') {
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Elevated</span>
      }
      if (cat.includes('Stage 1')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">Stage 1 HTN</span>
      }
      if (cat.includes('Stage 2')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Stage 2 HTN</span>
      }
      if (cat.includes('Crisis')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-200 border border-rose-500">CRISIS</span>
      }
      return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{cat}</span>
    }

    if (record.glucose_category) {
      const cat = record.glucose_category
      if (cat.includes('Hypoglycemia')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40">Hypoglycemia</span>
      }
      if (cat.includes('Normal')) {
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{cat}</span>
      }
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">{cat}</span>
    }

    return <span className="text-[11px] text-slate-500 font-mono">Recorded</span>
  }

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 shadow-xl overflow-hidden space-y-4">
      {/* Table Header & Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Telemetry Audit Log &amp; Measurement History
          </h3>
          <p className="text-[11px] text-slate-400">
            Immutable chronological record with verified data source provenance and physician annotations.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            {(['all', 'bp', 'glucose', 'hr', 'weight'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilterType(t)
                  setCurrentPage(1)
                }}
                className={`px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${
                  filterType === t
                    ? 'bg-slate-800 text-teal-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'bp' ? 'BP' : t === 'hr' ? 'Pulse' : t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Export */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => onExport('csv')}
              title="Export CSV"
              className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet size={13} />
              <span>CSV</span>
            </button>
            <button
              onClick={() => onExport('json')}
              title="Export JSON"
              className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <FileJson size={13} />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800/80">
            <tr>
              <th className="p-3.5 font-medium">Timestamp</th>
              <th className="p-3.5 font-medium">Measurement</th>
              <th className="p-3.5 font-medium">Classification</th>
              <th className="p-3.5 font-medium">Source / Method</th>
              <th className="p-3.5 font-medium">Notes &amp; Context</th>
              <th className="p-3.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginated.length > 0 ? (
              paginated.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Timestamp */}
                  <td className="p-3.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                    {format(new Date(v.recorded_at), 'yyyy-MM-dd HH:mm')}
                  </td>

                  {/* Measurement values */}
                  <td className="p-3.5 font-medium text-white whitespace-nowrap">
                    {v.systolic_bp != null && (
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-teal-400">
                          {v.systolic_bp}/{v.diastolic_bp}
                        </span>
                        <span className="text-[10px] text-slate-400">mmHg</span>
                        {v.heart_rate && (
                          <span className="text-xs text-slate-400 ml-1">({v.heart_rate} bpm)</span>
                        )}
                      </div>
                    )}
                    {v.blood_glucose != null && (
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-cyan-400">{v.blood_glucose}</span>
                        <span className="text-[10px] text-slate-400">mg/dL</span>
                        <span className="text-xs text-teal-400/80 ml-1">
                          ({v.blood_glucose_mmol} mmol/L)
                        </span>
                      </div>
                    )}
                    {v.weight != null && (
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-amber-400">{v.weight}</span>
                        <span className="text-[10px] text-slate-400">kg</span>
                      </div>
                    )}
                    {v.heart_rate != null && v.systolic_bp == null && (
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-rose-400">{v.heart_rate}</span>
                        <span className="text-[10px] text-slate-400">bpm</span>
                      </div>
                    )}
                  </td>

                  {/* Classification */}
                  <td className="p-3.5 whitespace-nowrap">
                    {renderCategoryBadge(v)}
                  </td>

                  {/* Source */}
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      {renderSourceBadge(v.measurement_source, v.is_sample, v.device_name)}
                      {v.device_name && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {v.device_name}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Notes */}
                  <td className="p-3.5 text-slate-300 max-w-xs truncate text-[11px]">
                    {v.notes || '--'}
                    {v.clinical_notes && (
                      <div className="text-[10px] text-teal-300 font-semibold mt-0.5">
                        MD: {v.clinical_notes}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(v)}
                        title="Edit record"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(v.id)}
                        title="Delete record"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No telemetry records match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filtered.length > pageSize && (
        <div className="p-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} records
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-mono text-slate-300">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
