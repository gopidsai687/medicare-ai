import React, { useState, useEffect } from 'react'
import {
  Cpu,
  Radio,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Play,
  Pause,
  Layers,
  Lock,
  Unlock,
  Info,
  ExternalLink,
  Flame,
  Thermometer,
  Gauge,
  Zap,
  ArrowRight,
  Database,
  Usb,
  Bluetooth,
  FileText,
  Microscope,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

interface MedicalDevice {
  id: string
  device_name: string
  device_type: string
  manufacturer: string
  model_number: string
  serial_number: string
  hardware_revision: string
  firmware_version: string
  protocol: string
  status: string
  battery_percentage: number | null
  is_demo_device: boolean
  supports_heart_rate: boolean
  supports_spo2: boolean
  supports_perfusion_index: boolean
  supports_dermal_temperature: boolean
  supports_contact_force: boolean
  supports_blood_pressure: boolean
  is_bp_calibrated: boolean
  bp_calibration_expiry: string | null
  supports_blood_glucose: boolean
  last_heartbeat_at: string | null
  last_reading_at: string | null
  notes: string | null
}

interface TelemetryPacket {
  id: string
  device_id: string
  packet_timestamp: string
  heart_rate: number | null
  oxygen_saturation: number | null
  perfusion_index: number | null
  dermal_temperature_c: number | null
  contact_force_n: number | null
  systolic_bp: number | null
  diastolic_bp: number | null
  blood_glucose: number | null
  signal_quality: string
  snr_db: number | null
  provenance: string
  packet_hash: string
  is_sample: boolean
  validation_status: string
  validation_notes: string | null
  created_at: string
}

interface FeasibilityReport {
  title: string
  executive_summary: string
  can_measure_both_at_fingertip_without_cuff_or_blood: boolean
  sensors: Array<{
    vital_name: string
    physical_parameter_measured: string
    primary_sensor_technology: string
    direct_clinical_validity: boolean
    status: string
    required_breakthrough: string | null
    governing_standards: string[]
    fda_regulatory_status: string
    clinical_limitations: string
  }>
  fda_safety_communications: Array<{
    date: string
    title: string
    summary: string
    url: string
  }>
  regulatory_pathway: Record<string, string>
  clinical_validation_protocol: Record<string, string>
}

export default function DeviceConnections() {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'hardware' | 'science' | 'calibration' | 'simulator'>('telemetry')
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null)
  const [packets, setPackets] = useState<TelemetryPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<FeasibilityReport | null>(null)

  // Calibration Form
  const [calSys, setCalSys] = useState('120')
  const [calDia, setCalDia] = useState('80')
  const [calCuff, setCalCuff] = useState('Omron Series 10 Upper Arm Monitor')
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calSuccess, setCalSuccess] = useState<string | null>(null)

  // Simulator State
  const [simScenario, setSimScenario] = useState('optimal_pulse')
  const [simBpm, setSimBpm] = useState(74)
  const [simSpo2, setSimSpo2] = useState(98.5)
  const [simForce, setSimForce] = useState(1.2)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simFeedback, setSimFeedback] = useState<string | null>(null)

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/devices')
      setDevices(res.data || [])
      if (res.data && res.data.length > 0) {
        setSelectedDevice(res.data[0])
        fetchPackets(res.data[0].id)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPackets = async (deviceId: string) => {
    try {
      const res = await api.get(`/api/v1/devices/${deviceId}/telemetry?limit=25`)
      setPackets(res.data || [])
    } catch (err) {
      console.error('Failed to load telemetry packets:', err)
    }
  }

  const fetchReport = async () => {
    try {
      const res = await api.get('/api/v1/devices/feasibility-report')
      setReport(res.data)
    } catch (err) {
      console.error('Failed to load feasibility report:', err)
    }
  }

  useEffect(() => {
    fetchDevices()
    fetchReport()
  }, [])

  const handleConnectToggle = async () => {
    if (!selectedDevice) return
    try {
      const endpoint = selectedDevice.status === 'CONNECTED' ? 'disconnect' : 'connect'
      const res = await api.post(`/api/v1/devices/${selectedDevice.id}/${endpoint}`)
      setSelectedDevice(res.data)
      setDevices((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to toggle device connection')
    }
  }

  const handleCalibrate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDevice) return
    setIsCalibrating(true)
    setCalSuccess(null)
    try {
      const res = await api.post(`/api/v1/devices/${selectedDevice.id}/calibrate`, {
        reference_systolic: parseInt(calSys),
        reference_diastolic: parseInt(calDia),
        cuff_device_name: calCuff,
      })
      setSelectedDevice(res.data)
      setDevices((prev) => prev.map((d) => (d.id === res.data.id ? res.data : d)))
      setCalSuccess(`Device successfully calibrated under IEEE Std 1708. Calibration valid until ${format(new Date(res.data.bp_calibration_expiry), 'MMM dd, yyyy')}.`)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Calibration failed')
    } finally {
      setIsCalibrating(false)
    }
  }

  const handleSendSimulatorPacket = async () => {
    if (!selectedDevice) return
    setIsSimulating(true)
    setSimFeedback(null)
    try {
      const res = await api.post('/api/v1/devices/simulator/packet', {
        device_id: selectedDevice.id,
        scenario: simScenario,
        pulse_bpm: simBpm,
        spo2_pct: simSpo2,
        contact_force_n: simForce,
      })
      setSimFeedback(`Synthetic DEMO packet generated (Hash: ${res.data.packet_hash.slice(0, 12)}...). Flagged with is_sample=true and isolated from clinical diagnostic records.`)
      fetchPackets(selectedDevice.id)
    } catch (err: any) {
      setSimFeedback(`Simulator Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsSimulating(false)
    }
  }

  const latestPacket = packets[0]

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-7xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
              <Cpu size={13} /> Hardware Integration &amp; Peripheral Bus
            </span>
            <span className="text-xs font-mono text-slate-500">IEEE 1708 / ISO 80601-2-61 Subsystem</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-white">
            Medical Device Connections &amp; Sensor Telemetry
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Authenticates physical biosensors, streams raw optical telemetry, validates measurement provenance, and enforces strict clinical safety boundaries against unverified non-invasive vital claims.
          </p>
        </div>

        {selectedDevice && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleConnectToggle}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                selectedDevice.status === 'CONNECTED' || selectedDevice.status === 'STREAMING'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-teal-600 text-white hover:bg-teal-500'
              }`}
            >
              <Radio size={14} className={selectedDevice.status === 'STREAMING' ? 'animate-pulse' : ''} />
              {selectedDevice.status === 'CONNECTED' || selectedDevice.status === 'STREAMING' ? 'Disconnect Hardware' : 'Connect Peripheral'}
            </button>
          </div>
        )}
      </div>

      {/* ── Device Identity Banner ────────────────────────────────────────── */}
      {selectedDevice ? (
        <div className="glass p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-teal-500/30 text-teal-400">
              <Usb size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white">{selectedDevice.device_name}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  selectedDevice.status === 'CONNECTED' || selectedDevice.status === 'STREAMING'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {selectedDevice.status}
                </span>
                {selectedDevice.is_demo_device && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    DEMO FIXTURE
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
                <span>Model: <strong className="text-slate-200">{selectedDevice.model_number}</strong></span>
                <span>S/N: <strong className="text-slate-200">{selectedDevice.serial_number}</strong></span>
                <span>Protocol: <strong className="text-teal-300">{selectedDevice.protocol}</strong></span>
                <span>Firmware: <strong className="text-slate-200">{selectedDevice.firmware_version}</strong></span>
                {selectedDevice.battery_percentage !== null && (
                  <span>Battery: <strong className="text-emerald-400">{selectedDevice.battery_percentage}%</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Status indicators */}
          <div className="flex items-center gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center min-w-28">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Cuffless BP</span>
              <span className={`font-semibold ${selectedDevice.is_bp_calibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                {selectedDevice.is_bp_calibrated ? 'IEEE 1708 Calibrated' : 'Calibration Required'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center min-w-28">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Optical Glucose</span>
              <span className="font-semibold text-rose-400">Not Feasible (Blocked)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass p-8 text-center text-slate-400 rounded-2xl">
          No medical devices paired. Click below to scan for USB-Serial or Bluetooth Low Energy devices.
        </div>
      )}

      {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'telemetry'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity size={14} /> Live Sensor Telemetry &amp; Ingestion
        </button>
        <button
          onClick={() => setActiveTab('hardware')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'hardware'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={14} /> Hardware Architecture &amp; Schematics
        </button>
        <button
          onClick={() => setActiveTab('science')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'science'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Microscope size={14} /> Scientific Feasibility &amp; FDA Guidance
        </button>
        <button
          onClick={() => setActiveTab('calibration')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'calibration'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gauge size={14} /> Pneumatic Cuff Calibration (IEEE 1708)
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <Zap size={14} /> Test Simulator (DEMO MODE)
        </button>
      </div>

      {/* ── TAB 1: Live Telemetry & Ingestion ─────────────────────────────── */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Real-time Physiological Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Heart Rate */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                  <Activity size={14} className="text-rose-400" /> Pulse Rate (Heart Rate)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  DIRECT OPTICAL
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white font-mono">
                  {latestPacket?.heart_rate ?? '--'}
                </span>
                <span className="text-xs text-slate-400">bpm</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Peak-to-peak interval detected via 530nm green optical pulsatile peak.
              </p>
            </div>

            {/* SpO2 */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                  <Flame size={14} className="text-teal-400" /> Blood Oxygen (SpO2)
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                  BEER-LAMBERT
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white font-mono">
                  {latestPacket?.oxygen_saturation ? `${latestPacket.oxygen_saturation}%` : '--'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Calibrated R-ratio from 660nm Red and 940nm Near-Infrared absorption.
              </p>
            </div>

            {/* Contact Force */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                  <Gauge size={14} className="text-blue-400" /> Fingertip Contact Force
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">
                  LOAD CELL
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-white font-mono">
                  {latestPacket?.contact_force_n ? `${latestPacket.contact_force_n} N` : '--'}
                </span>
                <span className={`text-xs font-bold ${
                  (latestPacket?.contact_force_n || 0) > 2.5
                    ? 'text-rose-400'
                    : (latestPacket?.contact_force_n || 0) < 0.3
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {(latestPacket?.contact_force_n || 0) > 2.5
                    ? 'Excessive (Occluding)'
                    : (latestPacket?.contact_force_n || 0) < 0.3
                    ? 'Insufficient Contact'
                    : 'Optimal (1.0-1.5N)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Applied pressure measured by strain gauge to prevent microvascular blanching.
              </p>
            </div>

            {/* Perfusion Index */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                  <Thermometer size={14} className="text-amber-400" /> Perfusion Index &amp; Temp
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">
                  AC/DC + IR
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-white font-mono">
                  {latestPacket?.perfusion_index ? `${latestPacket.perfusion_index}%` : '--'}
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-2xl font-extrabold text-white font-mono">
                  {latestPacket?.dermal_temperature_c ? `${latestPacket.dermal_temperature_c}°C` : '--'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pulsatile strength ratio and dermal surface radiation (MLX90614).
              </p>
            </div>
          </div>

          {/* Regulated Gate Banners: Blood Pressure & Blood Glucose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Blood Pressure Status */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge size={16} className="text-amber-400" /> Cuffless Blood Pressure
                </span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  selectedDevice?.is_bp_calibrated
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                }`}>
                  {selectedDevice?.is_bp_calibrated ? 'CALIBRATED SURROGATE' : 'CALIBRATION REQUIRED'}
                </span>
              </div>

              {selectedDevice?.is_bp_calibrated ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {latestPacket?.systolic_bp ? `${latestPacket.systolic_bp} / ${latestPacket.diastolic_bp} mmHg` : 'Awaiting pulse wave capture...'}
                  </div>
                  <p className="text-xs text-slate-400">
                    Calibrated under IEEE Std 1708 against pneumatic reference cuff. Calibration valid until {selectedDevice.bp_calibration_expiry ? format(new Date(selectedDevice.bp_calibration_expiry), 'MMM dd, yyyy') : '--'}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <strong>Measurement Blocked:</strong> Cuffless optical pulse wave analysis cannot measure absolute hydrostatic pressure without calibration. Changes in vascular tone, arterial stiffness, and autonomic arousal decouple pulse transit time from blood pressure.
                  </div>
                  <p>
                    Navigate to the <strong>Pneumatic Cuff Calibration</strong> tab to initialize baseline pressure using an approved arm cuff.
                  </p>
                </div>
              )}
            </div>

            {/* Blood Glucose Status */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-rose-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-400" /> Non-Invasive Blood Glucose
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  CLINICALLY NOT FEASIBLE
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                  <strong>Strict Clinical Safety Protocol:</strong> Zero optical fingertip sensors have been cleared or authorized by the FDA to measure blood glucose without skin puncture. In vivo optical absorption of glucose (0.1% w/v) is drowned out by water and hemoglobin (SNR &lt; 0.1%).
                </div>
                <p className="text-slate-400">
                  MediCare AI <strong>never substitutes simulated or AI-estimated glucose values</strong> for real measurements. For diabetes management, use an FDA-cleared fingerstick meter or continuous glucose monitor (CGM).
                </p>
              </div>
            </div>
          </div>

          {/* Telemetry Stream Ingestion Table */}
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database size={17} className="text-teal-400" /> Ingested Telemetry Stream &amp; Provenance Audit
                </h3>
                <span className="text-xs text-slate-400">
                  Cryptographically authenticated packets with timestamp sequence and source attribution
                </span>
              </div>
              <button
                onClick={() => selectedDevice && fetchPackets(selectedDevice.id)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Refresh Packets"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Pulse (bpm)</th>
                    <th className="py-2.5 px-3">SpO2 (%)</th>
                    <th className="py-2.5 px-3">PI (%)</th>
                    <th className="py-2.5 px-3">Force (N)</th>
                    <th className="py-2.5 px-3">Quality</th>
                    <th className="py-2.5 px-3">Provenance</th>
                    <th className="py-2.5 px-3">Packet Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {packets.map((pkt) => (
                    <tr key={pkt.id} className="hover:bg-slate-800/30 transition-all">
                      <td className="py-2.5 px-3 text-slate-300">
                        {format(new Date(pkt.packet_timestamp), 'HH:mm:ss.SSS')}
                      </td>
                      <td className="py-2.5 px-3 text-teal-400 font-bold">
                        {pkt.heart_rate ?? '--'}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {pkt.oxygen_saturation ? `${pkt.oxygen_saturation}%` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {pkt.perfusion_index ? `${pkt.perfusion_index}%` : '--'}
                      </td>
                      <td className="py-2.5 px-3 text-blue-400">
                        {pkt.contact_force_n ? `${pkt.contact_force_n} N` : '--'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          pkt.signal_quality === 'OPTIMAL'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}>
                          {pkt.signal_quality}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          pkt.provenance === 'MEASURED_DEVICE'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {pkt.provenance}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-36 truncate" title={pkt.packet_hash}>
                        {pkt.packet_hash.slice(0, 16)}...
                      </td>
                    </tr>
                  ))}
                  {packets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No telemetry packets received yet. Ensure peripheral is connected and streaming.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Hardware Architecture & Schematics ─────────────────────── */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu size={18} className="text-teal-400" /> Proposed Physical Finger-Measurement Station: MediCare BioSens FS-100
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
              Engineered as an enclosed desktop/kiosk biometric peripheral designed to interface with MediCare AI over WebSerial (CDC ACM USB) or BLE 5.2. Designed around strict physiological signal conditioning, multi-spectral optical deconvolution, mechanical force feedback, and medical electrical isolation.
            </p>

            {/* Subsystem Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 text-xs">
              {/* Optical Subsystem */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} /> 1. Multi-Spectral Optical Array
                </span>
                <p className="text-slate-300">
                  <strong>Analog Devices MAX86176 / Texas Instruments AFE4404</strong> with dual high-sensitivity PIN photodiodes.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>530 nm (Green): Capillary pulse interval (HR / HRV)</li>
                  <li>660 nm (Red) &amp; 940 nm (NIR): Oxygen saturation (SpO2)</li>
                  <li>880 nm (Isosbestic): Hemoglobin normalization reference</li>
                  <li>11-channel visible-to-NIR spectrometer (ams AS7341)</li>
                </ul>
              </div>

              {/* Force & Mechanical */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge size={14} /> 2. Biomechanical Load Cell
                </span>
                <p className="text-slate-300">
                  <strong>Piezoresistive Strain-Gauge Load Cell</strong> mounted directly beneath the optical sapphire plate.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>Dynamic range: 0.05 N to 10.0 N (0.01 N resolution)</li>
                  <li>Gating window: Accepts readings only at 1.0 N – 1.5 N</li>
                  <li>Eliminates capillary collapse from heavy fingertip pressure</li>
                  <li>Rejects motion noise from light contact (&lt;0.3 N)</li>
                </ul>
              </div>

              {/* Thermal & Environmental */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Thermometer size={14} /> 3. Infrared Thermopile
                </span>
                <p className="text-slate-300">
                  <strong>Melexis MLX90614ESF-DCI</strong> non-contact IR thermal sensor with integrated optical gradient compensation.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>Field of view: 35° focused directly on the finger pad</li>
                  <li>Accuracy: ±0.2°C across medical range (32°C to 38°C)</li>
                  <li>Compensates for temperature-dependent vascular elasticity</li>
                  <li>Flags vasoconstriction when finger skin temp &lt;30°C</li>
                </ul>
              </div>

              {/* Processing Unit */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={14} /> 4. Microcontroller &amp; Signal DSP
                </span>
                <p className="text-slate-300">
                  <strong>Espressif ESP32-S3</strong> (Dual-core Xtensa 32-bit LX7 @ 240MHz) with 24-bit external ADC (ADS1292).
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>500 Hz continuous optical &amp; load-cell sampling</li>
                  <li>0.5 Hz high-pass IIR filter (baseline wander removal)</li>
                  <li>50/60 Hz notch filter (mains optical flicker rejection)</li>
                  <li>SHA-256 hardware cryptographic packet signing</li>
                </ul>
              </div>

              {/* Electrical Safety */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} /> 5. IEC 60601-1 Galvanic Isolation
                </span>
                <p className="text-slate-300">
                  <strong>Analog Devices ADuM4160</strong> 5kV USB digital isolator + medical DC-DC isolated power supply.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>Classified as Type BF Patient-Applied Part</li>
                  <li>Creepage &amp; clearance distance &gt; 8.0 mm</li>
                  <li>Protects patient against mains surge or ground loops</li>
                  <li>EMC compliant per IEC 60601-1-2 4th edition</li>
                </ul>
              </div>

              {/* Hygienic Surface */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> 6. Biocompatible Contact Surface
                </span>
                <p className="text-slate-300">
                  <strong>Single-Crystal Synthetic Sapphire Window</strong> (Mohs Hardness 9) hermetically sealed with medical O-ring.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>IP67 fluid ingress protection</li>
                  <li>Immune to scratching from fingernails or jewelry</li>
                  <li>Resistant to 70% Isopropanol and CaviWipes bleach</li>
                  <li>Biocompatibility compliant with ISO 10993-5 / ISO 10993-10</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Scientific Feasibility & FDA Guidance ──────────────────── */}
      {activeTab === 'science' && (
        <div className="space-y-6">
          {/* Executive Feasibility Verdict */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
            <ShieldAlert size={24} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs text-amber-200">
              <h4 className="text-sm font-bold text-amber-300">
                Can ANY validated technology measure BOTH blood glucose and blood pressure through a fingertip sensor without a blood sample or cuff?
              </h4>
              <p className="leading-relaxed text-amber-100 font-semibold text-sm">
                NO. Absolutely not. There is no scientifically validated or FDA-authorized technology that can accurately measure both blood glucose and blood pressure from a single fingertip sensor without skin puncture or cuff calibration.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Optical photoplethysmography measures volumetric capillary light absorption. It cannot isolate glucose molecules (which comprise only 0.1% of blood mass) from the overwhelming optical absorption of water, protein, and hemoglobin. Cuffless blood pressure is decoupled by dynamic changes in vascular tone, arterial compliance, and hydrostatic pressure, strictly requiring periodic pneumatic cuff recalibration under IEEE Std 1708.
              </p>
            </div>
          </div>

          {/* Sensor Feasibility Matrix */}
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Microscope size={18} className="text-teal-400" /> Sensor-by-Sensor Feasibility &amp; Regulatory Matrix
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2.5 px-3">Vital Parameter</th>
                    <th className="py-2.5 px-3">Physical Measurement</th>
                    <th className="py-2.5 px-3">Clinical Validity</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Governing Standards</th>
                    <th className="py-2.5 px-3">Clinical Limitations / Required Breakthrough</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report?.sensors.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/20 transition-all">
                      <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                        {s.vital_name}
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        {s.physical_parameter_measured}
                      </td>
                      <td className="py-3 px-3">
                        {s.direct_clinical_validity ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> Direct
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> Indirect / Surrogate
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap ${
                          s.status === 'VALIDATED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : s.status === 'EXPERIMENTAL_REQUIRES_CALIBRATION'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {s.governing_standards.join(', ')}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs">
                        {s.required_breakthrough ? (
                          <span className="text-rose-300 font-semibold">Breakthrough Required: {s.required_breakthrough}</span>
                        ) : (
                          s.clinical_limitations
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FDA Safety Communications & Regulatory Framework */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-rose-400" /> FDA Safety Communication (February 21, 2024)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                "The FDA warned consumers, patients, caregivers, and healthcare providers that the agency has <strong>not cleared or approved any smartwatch or smart ring</strong> intended to measure or estimate blood glucose values on its own. Using unauthorized devices can cause inaccurate glucose measurements, resulting in dangerous insulin overdoses or missed hypoglycemia treatments leading to coma or death."
              </p>
              <a
                href="https://www.fda.gov/medical-devices/safety-communications/do-not-use-smartwatches-or-smart-rings-measure-blood-glucose-levels-fda-safety-communication"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:underline"
              >
                Read Official FDA Communication <ExternalLink size={12} />
              </a>
            </div>

            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck size={16} className="text-teal-400" /> FDA Pre-Market Regulatory Pathway
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li><strong>FDA Classification:</strong> Class II (Special Controls) via 510(k) or De Novo</li>
                <li><strong>Cuffless BP Standards:</strong> IEEE Std 1708-2014/2025 &amp; ISO 81060-2</li>
                <li><strong>Skin Diversity:</strong> Monk Skin Tone Scale (1-10) representative clinical cohort</li>
                <li><strong>Electrical Safety:</strong> IEC 60601-1 (Type BF Applied Part) &amp; IEC 60601-1-2 (EMC)</li>
                <li><strong>Biocompatibility:</strong> ISO 10993-5 (Cytotoxicity) &amp; ISO 10993-10 (Sensitization)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Pneumatic Cuff Calibration (IEEE 1708) ─────────────────── */}
      {activeTab === 'calibration' && (
        <div className="max-w-2xl mx-auto glass p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge size={18} className="text-teal-400" /> IEEE Std 1708 Reference Cuff Calibration
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To enable optical pulse wave analysis (PWA) on this device, IEEE Std 1708 requires baseline calibration using an approved upper-arm pneumatic cuff monitor within 3 minutes of optical sensor contact.
            </p>
          </div>

          {calSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{calSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCalibrate} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Reference Systolic (mmHg):</label>
                <input
                  type="number"
                  value={calSys}
                  onChange={(e) => setCalSys(e.target.value)}
                  min="70"
                  max="220"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Reference Diastolic (mmHg):</label>
                <input
                  type="number"
                  value={calDia}
                  onChange={(e) => setCalDia(e.target.value)}
                  min="40"
                  max="130"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Reference Cuff Device Name / Model:</label>
              <input
                type="text"
                value={calCuff}
                onChange={(e) => setCalCuff(e.target.value)}
                placeholder="e.g. Omron Series 10 / Welch Allyn ProBP"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-bold text-slate-300 block">Calibration Integrity Protocol:</span>
              <span>1. Sit relaxed for 5 minutes with arm supported at heart level.</span><br />
              <span>2. Take cuff measurement on contralateral arm.</span><br />
              <span>3. Enter values immediately to calculate pulse wave transfer function.</span>
            </div>

            <button
              type="submit"
              disabled={isCalibrating}
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isCalibrating ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
              <span>Authorize Calibration &amp; Unlock Cuffless BP</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 5: Clinical Test Simulator (DEMO MODE) ───────────────────── */}
      {activeTab === 'simulator' && (
        <div className="max-w-3xl mx-auto glass p-6 rounded-2xl border border-amber-500/30 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-400" /> Virtual Hardware Test Simulator (DEMO MODE)
              </h3>
              <span className="text-xs text-amber-300/80">
                Generate synthetic optical packets to test UI reactivity, motion noise, and contact force thresholds.
              </span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              DEMO SIMULATION
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
            <strong>Safety Notice:</strong> All packets generated here are tagged with <code className="bg-black/30 px-1 py-0.5 rounded font-mono">provenance="SIMULATED_DEMO"</code> and <code className="bg-black/30 px-1 py-0.5 rounded font-mono">is_sample=true</code>. They are strictly isolated and never mixed with real medical records or doctor charts.
          </div>

          {simFeedback && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/30 text-teal-300 text-xs font-mono">
              {simFeedback}
            </div>
          )}

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Test Scenario:</label>
              <select
                value={simScenario}
                onChange={(e) => setSimScenario(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="optimal_pulse">Optimal Resting Pulse (Optimal Force 1.2N, Clean PPG)</option>
                <option value="high_pressure">Excessive Contact Force (&gt;2.5N, Blanching Capillaries)</option>
                <option value="motion_noise">Motion Artifact (Finger Tremor / High-Frequency Noise)</option>
                <option value="low_perfusion">Poor Perfusion / Cold Extremities (Low AC Amplitude)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                <label className="font-semibold text-slate-300 block mb-1">Pulse Rate (bpm)</label>
                <input
                  type="range"
                  min="45"
                  max="160"
                  value={simBpm}
                  onChange={(e) => setSimBpm(parseInt(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <span className="font-mono text-teal-400 font-bold mt-1 block">{simBpm} bpm</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                <label className="font-semibold text-slate-300 block mb-1">SpO2 (%)</label>
                <input
                  type="range"
                  min="85"
                  max="100"
                  step="0.5"
                  value={simSpo2}
                  onChange={(e) => setSimSpo2(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <span className="font-mono text-emerald-400 font-bold mt-1 block">{simSpo2}%</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                <label className="font-semibold text-slate-300 block mb-1">Contact Force (N)</label>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.1"
                  value={simForce}
                  onChange={(e) => setSimForce(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="font-mono text-blue-400 font-bold mt-1 block">{simForce} N</span>
              </div>
            </div>

            <button
              onClick={handleSendSimulatorPacket}
              disabled={isSimulating}
              className="w-full py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              <span>Transmit Synthetic Telemetry Packet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
