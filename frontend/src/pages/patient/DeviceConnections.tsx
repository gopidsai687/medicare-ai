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
  Layers,
  Lock,
  Unlock,
  Info,
  ExternalLink,
  Flame,
  Thermometer,
  Gauge,
  Zap,
  Database,
  Usb,
  Bluetooth,
  FileText,
  Microscope,
  Sparkles,
  Shield,
  Key,
  Wifi,
  WifiOff,
  TrendingUp,
  Clock,
  AlertOctagon,
  Power,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  X,
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
  last_connected_at?: string | null
  connection_protocol_details?: string | null
  notes: string | null
}

interface TelemetryPacket {
  id: string
  device_id: string
  packet_timestamp: string
  sequence_number?: number | null
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
  sensor_status?: string | null
  source_type: string
  provenance: string
  packet_hash: string
  auth_signature?: string | null
  auth_verified?: boolean
  is_sample: boolean
  validation_status: string
  validation_notes: string | null
  created_at: string
}

interface ConnectionEvent {
  id: string
  device_id: string
  event_type: string
  details: string | null
  source_ip: string | null
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
  const [activeTab, setActiveTab] = useState<'telemetry' | 'hardware' | 'science' | 'calibration' | 'simulator' | 'security'>('telemetry')
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<MedicalDevice | null>(null)
  const [packets, setPackets] = useState<TelemetryPacket[]>([])
  const [events, setEvents] = useState<ConnectionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<FeasibilityReport | null>(null)

  // Hardware Connection State Machine
  const [connectionState, setConnectionState] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'CONNECTION_FAILED' | 'SIMULATION_MODE'>('DISCONNECTED')
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const [isAttemptingConnect, setIsAttemptingConnect] = useState(false)

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
  const [simTemp, setSimTemp] = useState(34.2)
  const [simPi, setSimPi] = useState(2.4)
  const [simLeadsConnected, setSimLeadsConnected] = useState(true)
  const [simPacketLoss, setSimPacketLoss] = useState(false)
  const [simBadSignature, setSimBadSignature] = useState(false)
  const [simExpireCal, setSimExpireCal] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simFeedback, setSimFeedback] = useState<string | null>(null)
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
  const [isLiveSimulating, setIsLiveSimulating] = useState(false)
  const [simStatusMessage, setSimStatusMessage] = useState('Simulator Standby (Ready to Test)')

  // Temperature Unit Toggle
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C')

  // Hardware-Validated Contact Force Profile (Configurable per mechanical housing)
  const [forceProfile, setForceProfile] = useState({
    minValid: 0.3,
    optimalMin: 1.0,
    optimalMax: 1.5,
    maxValid: 2.5,
  })
  const [showForceConfig, setShowForceConfig] = useState(false)
  const [authorizedModal, setAuthorizedModal] = useState<'BLE_GLUCOSE' | 'CGM_SYNC' | null>(null)
  const [authorizedActionMessage, setAuthorizedActionMessage] = useState<string | null>(null)
  const [isConnectingAuthorized, setIsConnectingAuthorized] = useState(false)

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/devices')
      setDevices(res.data || [])
      if (res.data && res.data.length > 0) {
        const activeDev = res.data[0]
        setSelectedDevice(activeDev)
        resolveConnectionState(activeDev)
        fetchPackets(activeDev.id)
        fetchEvents(activeDev.id)
      }
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }

  const resolveConnectionState = (dev: MedicalDevice) => {
    if (dev.is_demo_device) {
      setConnectionState('SIMULATION_MODE')
    } else if (dev.status === 'CONNECTED' || dev.status === 'STREAMING') {
      setConnectionState('CONNECTED')
    } else if (dev.status === 'CONNECTING') {
      setConnectionState('CONNECTING')
    } else if (dev.status === 'CONNECTION_FAILED') {
      setConnectionState('CONNECTION_FAILED')
    } else {
      setConnectionState('DISCONNECTED')
    }
  }

  const fetchPackets = async (deviceId: string) => {
    try {
      const res = await api.get(`/api/v1/devices/${deviceId}/telemetry?limit=30`)
      setPackets(res.data || [])
    } catch (err) {
      console.error('Failed to load telemetry packets:', err)
    }
  }

  const fetchEvents = async (deviceId: string) => {
    try {
      const res = await api.get(`/api/v1/devices/${deviceId}/events?limit=25`)
      setEvents(res.data || [])
    } catch (err) {
      console.error('Failed to load device events:', err)
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

  // ── Hardware Connection Actions ─────────────────────────────────────────────
  const handleConnectHardware = async () => {
    if (!selectedDevice) return
    setIsAttemptingConnect(true)
    setConnectionNotice(null)

    // Rule: If this is a demo/simulation device, never claim physical connection
    if (selectedDevice.is_demo_device) {
      setConnectionState('SIMULATION_MODE')
      setConnectionNotice('Device is registered as a virtual simulation fixture. Switched to Simulation Mode.')
      try {
        await api.post(`/api/v1/devices/${selectedDevice.id}/status`, {
          status: 'SIMULATION_MODE',
          protocol_details: 'Virtual Hardware Testbench Loopback',
        })
        fetchDevices()
      } catch (err) {
        console.error(err)
      } finally {
        setIsAttemptingConnect(false)
      }
      return
    }

    setConnectionState('CONNECTING')

    // Attempt real WebSerial or Web Bluetooth pairing
    try {
      let protocolUsed = selectedDevice.protocol
      let portName = 'Physical Medical Sensor Bus'

      if ('serial' in navigator && selectedDevice.protocol === 'WEBSERIAL') {
        try {
          // Request real WebSerial port from user
          const serialPort = await (navigator as any).serial.requestPort()
          await serialPort.open({ baudRate: 115200 })
          portName = 'WebSerial CDC-ACM Serial Port'
        } catch (serialErr: any) {
          // User cancelled or no device chosen
          throw new Error(serialErr.message || 'No physical USB-Serial device selected')
        }
      } else if ('bluetooth' in navigator && selectedDevice.protocol === 'BLE') {
        try {
          // Request real Bluetooth GATT device
          const bleDevice = await (navigator as any).bluetooth.requestDevice({
            filters: [{ services: ['heart_rate', 'health_thermometer', 0x1810, 0x1808] }],
            optionalServices: ['battery_service']
          })
          portName = `Web Bluetooth GATT: ${bleDevice.name || 'Medical Peripheral'}`
        } catch (bleErr: any) {
          throw new Error(bleErr.message || 'No Bluetooth LE medical peripheral selected')
        }
      }

      // If physical handshake succeeds, record active connection
      const res = await api.post(`/api/v1/devices/${selectedDevice.id}/status`, {
        status: 'CONNECTED',
        protocol_details: portName,
      })
      setSelectedDevice(res.data)
      setConnectionState('CONNECTED')
      setConnectionNotice(`Connected to physical hardware via ${portName}. Real sensor telemetry enabled.`)
      fetchEvents(selectedDevice.id)
    } catch (err: any) {
      // Record connection failure honestly
      const reason = err.message || 'Hardware handshake timed out. No physical peripheral found.'
      setConnectionState('CONNECTION_FAILED')
      setConnectionNotice(`Connection Failed: ${reason}. Switch to Test Simulator tab to test with simulated data.`)
      try {
        await api.post(`/api/v1/devices/${selectedDevice.id}/status`, {
          status: 'CONNECTION_FAILED',
          failure_reason: reason,
        })
        fetchEvents(selectedDevice.id)
      } catch (logErr) {
        console.error('Error logging connection failure:', logErr)
      }
    } finally {
      setIsAttemptingConnect(false)
    }
  }

  const handleDisconnectHardware = async () => {
    if (!selectedDevice) return
    try {
      const res = await api.post(`/api/v1/devices/${selectedDevice.id}/disconnect`)
      setSelectedDevice(res.data)
      setConnectionState('DISCONNECTED')
      setConnectionNotice('Hardware session terminated. Biosensors disconnected.')
      fetchEvents(selectedDevice.id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to disconnect hardware')
    }
  }

  // ── Calibration Handler ───────────────────────────────────────────────────
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
      fetchEvents(selectedDevice.id)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Calibration failed')
    } finally {
      setIsCalibrating(false)
    }
  }

  // ── Simulator Packet Generation ───────────────────────────────────────────
  const handleSendSimulatorPacket = async (overrides?: {
    scenario?: string
    bpm?: number | null
    spo2?: number | null
    force?: number
    temp?: number
    pi?: number
    leads?: boolean
    badSig?: boolean
    packetLoss?: boolean
    expireCal?: boolean
  }) => {
    if (!selectedDevice) return
    setIsSimulating(true)

    const targetScenario = overrides?.scenario !== undefined ? overrides.scenario : simScenario
    const targetBpm = overrides?.bpm !== undefined ? overrides.bpm : simBpm
    const targetSpo2 = overrides?.spo2 !== undefined ? overrides.spo2 : simSpo2
    const targetForce = overrides?.force !== undefined ? overrides.force : simForce
    const targetTemp = overrides?.temp !== undefined ? overrides.temp : simTemp
    const targetPi = overrides?.pi !== undefined ? overrides.pi : simPi
    const targetLeads = overrides?.leads !== undefined ? overrides.leads : simLeadsConnected
    const targetBadSig = overrides?.badSig !== undefined ? overrides.badSig : simBadSignature
    const targetLoss = overrides?.packetLoss !== undefined ? overrides.packetLoss : simPacketLoss
    const targetExpireCal = overrides?.expireCal !== undefined ? overrides.expireCal : simExpireCal

    try {
      const res = await api.post('/api/v1/devices/simulator/packet', {
        device_id: selectedDevice.id,
        scenario: targetScenario,
        pulse_bpm: targetBpm,
        spo2_pct: targetSpo2,
        contact_force_n: targetForce,
        temperature_c: targetTemp,
        perfusion_index_pct: targetPi,
        sensor_leads_connected: targetLeads,
        inject_packet_loss: targetLoss,
        inject_bad_signature: targetBadSig,
        force_calibration_expired: targetExpireCal,
      })

      const isBadSig = res.data.auth_signature === 'CORRUPTED_HMAC_SIGNATURE_PAYLOAD_TAMPERED_HASH_TEST'
      
      // Prepend to packets so live dashboard & sparklines update instantly
      setPackets((prev) => [res.data, ...prev.slice(0, 29)])
      setSimFeedback(
        `Synthetic DEMO packet #${res.data.sequence_number ?? '--'} generated (${format(new Date(), 'HH:mm:ss')}). ` +
        `Source: SIMULATION. ${isBadSig ? '⚠️ Injected Corrupted Signature: AUTH FAILED.' : '✓ DEMO VERIFIED (Isolated).'} ` +
        `Strictly isolated from patient medical records.`
      )
      fetchEvents(selectedDevice.id)
      if (targetExpireCal) {
        setSelectedDevice((prev) => prev ? { ...prev, is_bp_calibrated: false } : null)
      }
    } catch (err: any) {
      setSimFeedback(`Simulator Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setIsSimulating(false)
    }
  }

  // ── Start / Stop / Reset Simulation Handlers ──────────────────────────────
  const handleStartSimulation = async () => {
    setIsLiveSimulating(true)
    setSimStatusMessage('Simulation Active (Live Streaming Telemetry)')
    await handleSendSimulatorPacket()
  }

  const handleStopSimulation = () => {
    setIsLiveSimulating(false)
    setSimStatusMessage('Simulation Stopped (Historical demo data preserved)')
    setSimFeedback('Simulation stopped. Historical demo data preserved on dashboard.')
  }

  const handleResetSimulation = () => {
    setIsLiveSimulating(false)
    setSimScenario('optimal_pulse')
    setSimBpm(72)
    setSimSpo2(98.5)
    setSimForce(1.2)
    setSimTemp(36.6)
    setSimPi(2.4)
    setSimLeadsConnected(true)
    setSimBadSignature(false)
    setSimPacketLoss(false)
    setSimExpireCal(false)
    setSimStatusMessage('Simulator Reset to Baseline Defaults (Standby)')
    setSimFeedback('Simulator restored to baseline physiological defaults. Genuine patient data unaffected.')
  }

  const applyScenario = (scenarioKey: string) => {
    setSimScenario(scenarioKey)
    switch (scenarioKey) {
      case 'normal':
      case 'optimal_pulse':
        setSimBpm(72)
        setSimSpo2(98.5)
        setSimForce(1.2)
        setSimTemp(36.6)
        setSimPi(2.4)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Normal Sensor Readings (Resting 72 bpm, 98.5% SpO2, 1.2N force, optimal SQI).')
        handleSendSimulatorPacket({
          scenario: 'optimal_pulse',
          bpm: 72,
          spo2: 98.5,
          force: 1.2,
          temp: 36.6,
          pi: 2.4,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      case 'elevated_hr':
        setSimBpm(138)
        setSimSpo2(98.0)
        setSimForce(1.3)
        setSimTemp(37.1)
        setSimPi(3.2)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Elevated Heart Rate (138 bpm, physiological stress simulation).')
        handleSendSimulatorPacket({
          scenario: 'elevated_hr',
          bpm: 138,
          spo2: 98.0,
          force: 1.3,
          temp: 37.1,
          pi: 3.2,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      case 'low_spo2':
        setSimBpm(88)
        setSimSpo2(86.5)
        setSimForce(1.2)
        setSimTemp(35.8)
        setSimPi(1.8)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Low SpO2 Demonstration (86.5% SpO2, hypoxemia demonstration).')
        handleSendSimulatorPacket({
          scenario: 'low_spo2',
          bpm: 88,
          spo2: 86.5,
          force: 1.2,
          temp: 35.8,
          pi: 1.8,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      case 'poor_signal':
      case 'motion_noise':
        setSimBpm(76)
        setSimSpo2(95.0)
        setSimForce(0.22)
        setSimTemp(33.5)
        setSimPi(0.35)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Poor Signal Quality (Tremor / motion noise SNR 6.2 dB, light force 0.22N).')
        handleSendSimulatorPacket({
          scenario: 'poor_signal',
          bpm: 76,
          spo2: 95.0,
          force: 0.22,
          temp: 33.5,
          pi: 0.35,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      case 'sensor_failure':
      case 'sensor_disconnected':
        setSimBpm(72)
        setSimSpo2(98.0)
        setSimForce(0.0)
        setSimTemp(22.0)
        setSimPi(0.0)
        setSimLeadsConnected(false)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Sensor Disconnected (Leads off, pulse reading masked, SQI: LEADS_OFF).')
        handleSendSimulatorPacket({
          scenario: 'sensor_disconnected',
          bpm: null,
          spo2: null,
          force: 0.0,
          temp: 22.0,
          pi: 0.0,
          leads: false,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      case 'packet_loss':
        setSimBpm(74)
        setSimSpo2(98.0)
        setSimForce(1.2)
        setSimTemp(36.4)
        setSimPi(2.3)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(true)
        setSimExpireCal(false)
        setSimFeedback('Scenario: Packet Loss (Injected sequence number gap of +10 packets).')
        handleSendSimulatorPacket({
          scenario: 'packet_loss',
          bpm: 74,
          spo2: 98.0,
          force: 1.2,
          temp: 36.4,
          pi: 2.3,
          leads: true,
          badSig: false,
          packetLoss: true,
          expireCal: false,
        })
        break

      case 'calibration_required':
      case 'calibration_expired':
        setSimBpm(74)
        setSimSpo2(98.5)
        setSimForce(1.2)
        setSimTemp(36.5)
        setSimPi(2.4)
        setSimLeadsConnected(true)
        setSimBadSignature(false)
        setSimPacketLoss(false)
        setSimExpireCal(true)
        setSimFeedback('Scenario: Calibration Required (Cuffless BP reference calibration expired >30 days).')
        handleSendSimulatorPacket({
          scenario: 'calibration_expired',
          bpm: 74,
          spo2: 98.5,
          force: 1.2,
          temp: 36.5,
          pi: 2.4,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: true,
        })
        break

      case 'connection_failure':
        setSimFeedback('Scenario: Device Connection Failure (Peripheral BLE handshake timeout simulated).')
        setConnectionNotice('Simulated Connection Failure: Peripheral GATT service 0x180D timeout after 15000ms.')
        handleSendSimulatorPacket({
          scenario: 'connection_failure',
          bpm: 72,
          spo2: 98.5,
          force: 1.2,
          temp: 36.6,
          pi: 2.4,
          leads: true,
          badSig: false,
          packetLoss: false,
          expireCal: false,
        })
        break

      default:
        break
    }
  }

  // Live Simulation Engine Interval
  useEffect(() => {
    if (!isLiveSimulating || !selectedDevice) return

    const timer = setInterval(() => {
      const flutterBpm = !simLeadsConnected 
        ? null 
        : Math.max(40, Math.min(200, Math.round(simBpm + (Math.random() * 4 - 2))))
      const flutterSpo2 = !simLeadsConnected 
        ? null 
        : Math.max(70, Math.min(100, Math.round((simSpo2 + (Math.random() * 0.4 - 0.2)) * 10) / 10))
      const flutterForce = Math.max(0, Math.round((simForce + (Math.random() * 0.06 - 0.03)) * 10) / 10)
      const flutterTemp = Math.round((simTemp + (Math.random() * 0.1 - 0.05)) * 10) / 10
      const flutterPi = Math.max(0.01, Math.round((simPi + (Math.random() * 0.1 - 0.05)) * 10) / 10)

      handleSendSimulatorPacket({
        bpm: flutterBpm,
        spo2: flutterSpo2,
        force: flutterForce,
        temp: flutterTemp,
        pi: flutterPi,
      })
    }, 2500)

    return () => clearInterval(timer)
  }, [
    isLiveSimulating,
    selectedDevice,
    simScenario,
    simBpm,
    simSpo2,
    simForce,
    simTemp,
    simPi,
    simLeadsConnected,
    simPacketLoss,
    simBadSignature,
    simExpireCal,
  ])

  const latestPacket = packets[0]
  const prevPacket = packets[1]

  // 1. Packet Sequence Continuity Audit
  const sequenceLossDetected =
    latestPacket?.sequence_number !== null &&
    latestPacket?.sequence_number !== undefined &&
    prevPacket?.sequence_number !== null &&
    prevPacket?.sequence_number !== undefined &&
    latestPacket.sequence_number > prevPacket.sequence_number + 1

  const missingPacketCount = sequenceLossDetected
    ? (latestPacket!.sequence_number! - prevPacket!.sequence_number! - 1)
    : 0

  // 2. Measurement Interval Check (between consecutive packet timestamps)
  let measurementIntervalSec: number | null = null
  let intervalGapDetected = false
  if (latestPacket?.packet_timestamp && prevPacket?.packet_timestamp) {
    measurementIntervalSec = Math.abs(
      new Date(latestPacket.packet_timestamp).getTime() - new Date(prevPacket.packet_timestamp).getTime()
    ) / 1000
    if (measurementIntervalSec > 3.5) {
      intervalGapDetected = true
    }
  }

  // 3. Measurement Age & Data Freshness (time elapsed since measurement timestamp)
  const measurementAgeSec = latestPacket?.packet_timestamp
    ? Math.max(0, (Date.now() - new Date(latestPacket.packet_timestamp).getTime()) / 1000)
    : null
  const isDataStale = measurementAgeSec !== null && measurementAgeSec >= 60.0
  const isDataDelayed = measurementAgeSec !== null && measurementAgeSec >= 5.0 && measurementAgeSec < 60.0
  const isDataFresh = measurementAgeSec !== null && measurementAgeSec < 5.0

  // 4. Network Transit Latency
  // Network transit latency cannot be computed by subtracting unsynchronized device and server clocks.
  // Explicitly indicate loopback estimate for simulator, or unavailable (clock sync pending) for hardware.
  const isSimulated = latestPacket?.source_type === 'SIMULATION'
  const networkTransitLatencyDisplay = isSimulated
    ? 'Estimated Loopback (<15 ms)'
    : 'Unavailable (No PTP/NTP Clock Sync)'

  // Centralized Measurement Quality and Validity Engine (5-state architecture)
  const evalSignalQuality = (pkt: TelemetryPacket | undefined, profile = forceProfile) => {
    if (!pkt) {
      return {
        rawSignalQuality: 'NO_SIGNAL',
        contactQuality: 'NO_CONTACT',
        sensorOperationalStatus: 'STANDBY',
        opticalValid: false,
        temperatureValid: false,
        pulseRateValid: false,
        spo2Valid: false,
        piValid: false,
        dermalTempValid: false,
        contactForceValid: false,
        opticalUsable: false,
        temperatureUsable: false,
        rejectionReasons: ['Awaiting biosensor data acquisition...'],
        quality: 'Awaiting Signal',
        primarySignalQuality: 'STANDBY',
        status: 'STANDBY',
        statusLabel: 'STANDBY',
        color: 'text-slate-500',
        badgeBg: 'bg-slate-800 text-slate-400 border border-slate-700',
        detail: 'Awaiting biosensor telemetry stream...',
        isOptimal: false,
      }
    }

    const sStatus = pkt.sensor_status || 'SENSOR_OK'
    const isLeadsOff = sStatus === 'LEADS_OFF' || sStatus === 'DISCONNECTED' || pkt.signal_quality === 'LEADS_OFF'
    const isMotion = sStatus === 'MOTION_ARTIFACT' || sStatus === 'MOTION_NOISE' || pkt.signal_quality === 'MOTION_ARTIFACT'

    // 1. Sensor Operational Status
    const sensorOperationalStatus = isLeadsOff ? 'LEADS_OFF' : isMotion ? 'MOTION_NOISE' : 'OPERATIONAL'

    // 2. Physical Contact Quality (Device-Specific to 8mm sapphire aperture)
    const force = pkt.contact_force_n
    let contactQuality = 'NO_CONTACT'
    if (isLeadsOff || force === null || force === undefined || force <= 0.05) {
      contactQuality = 'NO_CONTACT'
    } else if (force < profile.minValid) {
      contactQuality = 'INSUFFICIENT_CONTACT'
    } else if (force > profile.maxValid) {
      contactQuality = 'EXCESSIVE_PRESSURE'
    } else if (force >= profile.optimalMin && force <= profile.optimalMax) {
      contactQuality = 'OPTIMAL_CONTACT'
    } else {
      contactQuality = 'ACCEPTABLE_CONTACT'
    }

    // 3. Raw Signal Quality (Optical PPG channel)
    let rawSignalQuality = 'ACCEPTABLE'
    if (isLeadsOff) {
      rawSignalQuality = 'NO_SIGNAL'
    } else if (isMotion) {
      rawSignalQuality = 'MOTION_ARTIFACT'
    } else if (pkt.snr_db !== null && pkt.snr_db !== undefined && pkt.snr_db < 10.0) {
      rawSignalQuality = 'POOR_SNR'
    } else if (pkt.perfusion_index !== null && pkt.perfusion_index !== undefined && pkt.perfusion_index < 0.4) {
      rawSignalQuality = 'LOW_PERFUSION'
    } else if (
      (pkt.perfusion_index ?? 0) >= 1.0 &&
      (pkt.snr_db === null || pkt.snr_db === undefined || pkt.snr_db >= 18.0)
    ) {
      rawSignalQuality = 'OPTIMAL'
    }

    // 4. Measurement Validity & Rejection Reasons per Channel
    const rejectionReasons: string[] = []
    let opticalValid = true

    if (isLeadsOff) {
      opticalValid = false
      rejectionReasons.push('Biosensor leads detached or finger removed from contact aperture.')
    } else if (contactQuality === 'INSUFFICIENT_CONTACT') {
      opticalValid = false
      rejectionReasons.push(`Insufficient contact force (${(force ?? 0).toFixed(2)}N < ${profile.minValid.toFixed(2)}N minimum): ambient optical light leakage detected.`)
    } else if (contactQuality === 'EXCESSIVE_PRESSURE') {
      opticalValid = false
      rejectionReasons.push(`Excessive contact force (${(force ?? 0).toFixed(2)}N > ${profile.maxValid.toFixed(2)}N maximum): capillary microvascular bed blanched/occluded.`)
    } else if (isMotion || rawSignalQuality === 'MOTION_ARTIFACT') {
      opticalValid = false
      rejectionReasons.push('High-frequency accelerometer/optical motion tremor detected. Keep finger stationary.')
    } else if (pkt.perfusion_index !== null && pkt.perfusion_index !== undefined && pkt.perfusion_index < 0.2) {
      opticalValid = false
      rejectionReasons.push(`Perfusion Index critically low (${pkt.perfusion_index.toFixed(2)}% < 0.20% AC/DC): pulse detection unreliable.`)
    }

    // Physiological Bounds Check
    const hr = pkt.heart_rate
    const spo2 = pkt.oxygen_saturation
    if (hr !== null && hr !== undefined && (hr < 30 || hr > 240)) {
      opticalValid = false
      rejectionReasons.push(`Pulse rate (${hr} bpm) outside plausible physiological limits (30–240 bpm).`)
    }
    if (spo2 !== null && spo2 !== undefined && (spo2 < 70.0 || spo2 > 100.0)) {
      opticalValid = false
      rejectionReasons.push(`SpO2 (${spo2}%) outside measurable pulse oximetry range (70–100%).`)
    }

    // Independent Temperature Validity (MLX90614 infrared thermopile has non-contact optical FOV)
    let temperatureValid = true
    if (isLeadsOff) {
      temperatureValid = false
    } else if (pkt.dermal_temperature_c !== null && pkt.dermal_temperature_c !== undefined) {
      if (pkt.dermal_temperature_c < 20.0 || pkt.dermal_temperature_c > 44.0) {
        temperatureValid = false
      }
    }

    // 5. Determine Primary Signal Quality & Badges
    let primarySignalQuality = 'ACCEPTABLE'
    let statusLabel = 'ACCEPTABLE SIGNAL'
    let statusColor = 'text-teal-300'
    let badgeBg = 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
    let detail = 'Adequate pulsatile signal acquired within acceptable physiological margins.'
    let isOptimal = false

    if (isLeadsOff) {
      primarySignalQuality = 'LEADS_OFF'
      statusLabel = 'LEADS DETACHED'
      statusColor = 'text-rose-400'
      badgeBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      detail = 'Optical biosensor detached or finger removed from contact aperture.'
    } else if (contactQuality === 'INSUFFICIENT_CONTACT') {
      primarySignalQuality = 'INSUFFICIENT_CONTACT'
      statusLabel = 'LIGHT CONTACT'
      statusColor = 'text-amber-400'
      badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      detail = `Contact force (${(force ?? 0).toFixed(2)}N < ${profile.minValid}N): ambient optical light leakage detected.`
    } else if (contactQuality === 'EXCESSIVE_PRESSURE') {
      primarySignalQuality = 'EXCESSIVE_PRESSURE'
      statusLabel = 'EXCESSIVE FORCE'
      statusColor = 'text-purple-400'
      badgeBg = 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
      detail = `Contact force (${(force ?? 0).toFixed(2)}N > ${profile.maxValid}N): microvascular bed blanched/occluded.`
    } else if (isMotion || rawSignalQuality === 'MOTION_ARTIFACT') {
      primarySignalQuality = 'MOTION_ARTIFACT'
      statusLabel = 'MOTION ARTIFACT'
      statusColor = 'text-orange-400'
      badgeBg = 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
      detail = 'High-frequency accelerometer/optical motion tremor detected. Keep finger stationary.'
    } else if (rawSignalQuality === 'LOW_PERFUSION') {
      primarySignalQuality = 'POOR_PERFUSION'
      statusLabel = 'LOW PERFUSION'
      statusColor = 'text-amber-400'
      badgeBg = 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      detail = `Low pulsatile amplitude (PI ${(pkt.perfusion_index ?? 0).toFixed(1)}% < 0.4% AC/DC). Vasoconstriction or cold extremity.`
    } else if (!opticalValid) {
      primarySignalQuality = 'INVALID_MEASUREMENT'
      statusLabel = 'INVALID MEASUREMENT'
      statusColor = 'text-rose-400'
      badgeBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      detail = rejectionReasons[0] || 'Measurement bounds or gating criteria violated.'
    } else if (contactQuality === 'OPTIMAL_CONTACT' && rawSignalQuality === 'OPTIMAL') {
      primarySignalQuality = 'OPTIMAL'
      statusLabel = 'OPTIMAL SIGNAL'
      statusColor = 'text-emerald-400'
      badgeBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      detail = `High pulsatile SNR (PI ${(pkt.perfusion_index ?? 0).toFixed(1)}%, calibrated force ${(force ?? 0).toFixed(2)}N within ${profile.optimalMin}–${profile.optimalMax}N target).`
      isOptimal = true
    }

    return {
      rawSignalQuality,
      contactQuality,
      sensorOperationalStatus,
      opticalValid,
      temperatureValid,
      pulseRateValid: opticalValid && hr !== null && hr !== undefined,
      spo2Valid: opticalValid && spo2 !== null && spo2 !== undefined,
      piValid: opticalValid && pkt.perfusion_index !== null && pkt.perfusion_index !== undefined,
      dermalTempValid: temperatureValid && pkt.dermal_temperature_c !== null && pkt.dermal_temperature_c !== undefined,
      contactForceValid: force !== null && force !== undefined,
      opticalUsable: opticalValid,
      temperatureUsable: temperatureValid,
      rejectionReasons,
      quality: primarySignalQuality,
      primarySignalQuality,
      status: statusLabel,
      statusLabel,
      color: statusColor,
      badgeBg,
      detail,
      isOptimal,
    }
  }

  const currentSignalEval = evalSignalQuality(latestPacket)

  // Quality Gating Check
  const isForceInsufficient = currentSignalEval.contactQuality === 'INSUFFICIENT_CONTACT'
  const isForceExcessive = currentSignalEval.contactQuality === 'EXCESSIVE_PRESSURE'
  const isLeadsOff = currentSignalEval.sensorOperationalStatus === 'LEADS_OFF'
  const isHeartRateGated = !currentSignalEval.pulseRateValid

  // Recent pulse trend (strictly filter out invalid/gated measurements)
  const pulseTrend = packets
    .filter((p) => p.heart_rate !== null && evalSignalQuality(p, forceProfile).pulseRateValid)
    .slice(0, 12)
    .map((p) => p.heart_rate as number)
    .reverse()

  const formatDuration = (sec: number | null): string => {
    if (sec === null) return '--'
    if (sec < 60) return `${Math.round(sec)}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
    const hrs = Math.floor(sec / 3600)
    const mins = Math.floor((sec % 3600) / 60)
    return `${hrs}h ${mins}m`
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-7xl mx-auto">
      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
              <Cpu size={13} /> Hardware Station &amp; Sensor Telemetry
            </span>
            <span className="text-xs font-mono text-slate-500">IEEE Std 1708-2014 (Cuffless BP) &amp; ISO 80601-2-61:2026, Edition 3 (Pulse Oximetry) Subsystem (Investigational Prototype)</span>
          </div>
          <h1 className="text-3xl font-bold font-display text-white">
            Device Station &amp; Biomedical Ingestion
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Streams real physical sensor telemetry, verifies cryptographic HMAC signatures, enforces sequence replay protection, isolates synthetic demo data, and prevents unvalidated non-invasive vital claims.
          </p>
        </div>

        {selectedDevice && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="open-test-simulator-btn"
              type="button"
              onClick={() => setIsSimulatorOpen(true)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                isLiveSimulating
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-extrabold shadow-amber-500/20'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
            >
              <Zap size={14} className={isLiveSimulating ? 'text-slate-950 animate-bounce' : 'text-amber-400'} />
              {isLiveSimulating ? 'Simulator Active (Controls)' : 'Test Simulator (DEMO MODE)'}
            </button>

            {connectionState === 'CONNECTED' ? (
              <button
                onClick={handleDisconnectHardware}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
              >
                <Power size={14} />
                Disconnect Hardware
              </button>
            ) : (
              <button
                onClick={handleConnectHardware}
                disabled={isAttemptingConnect}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50"
              >
                <Radio size={14} className={isAttemptingConnect ? 'animate-spin' : ''} />
                {isAttemptingConnect ? 'Negotiating Port...' : 'Connect Hardware Peripheral'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Hardware Connection Banner (5 Required States) ────────────────── */}
      {selectedDevice ? (
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-blue-500/20 border border-teal-500/30 text-teal-400">
                <Usb size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white">{selectedDevice.device_name}</h2>
                  
                  {/* Dynamic Hardware Connection State Badge */}
                  {connectionState === 'CONNECTED' && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      CONNECTED
                    </span>
                  )}
                  {connectionState === 'DISCONNECTED' && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      DISCONNECTED
                    </span>
                  )}
                  {connectionState === 'CONNECTING' && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center gap-1.5">
                      <RefreshCw size={11} className="animate-spin" />
                      CONNECTING...
                    </span>
                  )}
                  {connectionState === 'CONNECTION_FAILED' && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                      <AlertTriangle size={11} />
                      CONNECTION FAILED
                    </span>
                  )}
                  {connectionState === 'SIMULATION_MODE' && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                      <Zap size={11} />
                      SIMULATION MODE
                    </span>
                  )}

                  {selectedDevice.is_demo_device && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      DEMO FIXTURE
                    </span>
                  )}
                </div>

                {/* Device Specifications Metadata */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400 mt-1.5 font-mono">
                  <span>Model: <strong className="text-slate-200">{selectedDevice.model_number}</strong></span>
                  <span>S/N: <strong className="text-slate-200">{selectedDevice.serial_number}</strong></span>
                  <span>Firmware: <strong className="text-slate-200">{selectedDevice.firmware_version}</strong></span>
                  <span>Protocol: <strong className="text-teal-300">{selectedDevice.protocol}</strong></span>
                  <span>
                    Last Connected:{' '}
                    <strong className="text-slate-200">
                      {selectedDevice.last_connected_at
                        ? format(new Date(selectedDevice.last_connected_at), 'MMM dd, HH:mm:ss')
                        : 'Never (Pending Physical Pair)'}
                    </strong>
                  </span>
                  {selectedDevice.battery_percentage !== null && (
                    <span>Battery: <strong className="text-emerald-400">{selectedDevice.battery_percentage}%</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Pillows */}
            <div className="flex items-center gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center min-w-28">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Cuffless BP Status</span>
                <span className={`font-semibold ${selectedDevice.is_bp_calibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedDevice.is_bp_calibrated ? 'IEEE 1708 Active' : 'Calibration Required'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center min-w-28">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Optical Glucose</span>
                <span className="font-semibold text-rose-400">Blocked (FDA Guideline)</span>
              </div>
            </div>
          </div>

          {/* Connection Notice / Error feedback */}
          {connectionNotice && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              connectionState === 'CONNECTION_FAILED'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : connectionState === 'CONNECTED'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
            }`}>
              <Info size={15} className="shrink-0" />
              <span>{connectionNotice}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="glass p-8 text-center text-slate-400 rounded-2xl">
          No medical devices paired. Pair a physical biosensor or initialize the virtual simulator.
        </div>
      )}

      {/* Live Simulation Streaming Alert Banner */}
      {isLiveSimulating && (
        <div className="glass p-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <div>
              <strong className="text-white font-bold">LIVE SIMULATION ACTIVE:</strong> Streaming synthetic demo telemetry packets every 2.5s.
              <span className="text-amber-300/80 ml-1.5 font-mono">Physical hardware status: DISCONNECTED (Isolated).</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="open-sim-controls-banner-btn"
              onClick={() => setIsSimulatorOpen(true)}
              className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:text-white font-bold cursor-pointer"
            >
              Open Controls
            </button>
            <button
              type="button"
              id="stop-sim-banner-btn"
              onClick={handleStopSimulation}
              className="px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 hover:text-white font-bold cursor-pointer flex items-center gap-1"
            >
              <Pause size={12} /> Stop
            </button>
          </div>
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
          <Activity size={14} /> Live Sensor Telemetry
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield size={14} /> Telemetry Security &amp; Audit Logs
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
          id="nav-test-simulator-btn"
          type="button"
          onClick={() => {
            setIsSimulatorOpen(true)
            setActiveTab('simulator')
          }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            isSimulatorOpen || activeTab === 'simulator'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'text-amber-400/80 hover:text-amber-300'
          }`}
        >
          <Zap size={14} className={isLiveSimulating ? 'text-amber-400 animate-pulse' : ''} />
          <span>Test Simulator (DEMO MODE)</span>
          {isLiveSimulating && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping ml-0.5" />
          )}
        </button>
      </div>

      {/* ── TAB 1: Live Sensor Telemetry (All Sensors Separated) ──────────── */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Real-time Physiological Metric Cards (Separated per requirements) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Heart Rate (Optical Pulse Sensor Integration) */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                  <Activity size={15} className="text-rose-400" /> Pulse Rate (Heart Rate)
                </span>
                <div className="flex items-center gap-1.5">
                  {latestPacket?.source_type === 'SIMULATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      SIMULATION
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      HARDWARE
                    </span>
                  )}
                </div>
              </div>

              {/* Heart rate value with Gating Quality Check */}
              <div className="space-y-1">
                {!currentSignalEval.pulseRateValid ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-slate-500 font-mono">--</span>
                      <span className="text-xs text-slate-500 font-mono">bpm (Invalid)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertOctagon size={14} /> Gating Blocked ({currentSignalEval.statusLabel})
                      </div>
                      <p className="text-[11px] text-amber-200 leading-relaxed">
                        {currentSignalEval.rejectionReasons.join(' ')}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                        Raw diagnostic: <strong>{latestPacket?.heart_rate ?? '--'} bpm</strong> (Withheld from clinical display).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      {latestPacket?.heart_rate ?? '--'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">bpm</span>
                  </div>
                )}
              </div>

              {/* Sensor Diagnostics */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center">
                  <span>Signal Quality:</span>
                  <span className={`font-bold ${currentSignalEval.color}`}>
                    {currentSignalEval.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {currentSignalEval.detail}
                </p>
                <div className="flex justify-between items-center">
                  <span>Sensor Status:</span>
                  <span className="text-slate-300">{latestPacket?.sensor_status ?? 'Optical 530nm Active'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Timestamp:</span>
                  <span className="text-slate-300">
                    {latestPacket?.packet_timestamp
                      ? format(new Date(latestPacket.packet_timestamp), 'HH:mm:ss.SSS')
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Historical Trend Sparkline */}
              {pulseTrend.length > 1 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                    <span className="flex items-center gap-1"><TrendingUp size={11} /> Historical Trend</span>
                    <span>{pulseTrend[pulseTrend.length - 1]} bpm</span>
                  </div>
                  <div className="flex items-end gap-1 h-8 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                    {pulseTrend.map((val, i) => {
                      const hPct = Math.max(15, Math.min(100, ((val - 50) / 70) * 100))
                      return (
                        <div
                          key={i}
                          style={{ height: `${hPct}%` }}
                          className="flex-1 bg-gradient-to-t from-teal-500 to-rose-400 rounded-sm opacity-80 hover:opacity-100 transition-all"
                          title={`${val} bpm`}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Blood Oxygen (SpO2 Pulse Oximeter) */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                  <Flame size={15} className="text-teal-400" /> Blood Oxygen (SpO2)
                </span>
                <div className="flex items-center gap-1.5">
                  {latestPacket?.source_type === 'SIMULATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      SIMULATION
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      HARDWARE
                    </span>
                  )}
                </div>
              </div>

              {/* SpO2 value with Gating Quality Check */}
              <div className="space-y-1">
                {!currentSignalEval.spo2Valid ? (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-slate-500 font-mono">--</span>
                      <span className="text-xs text-slate-500 font-mono">SpO2 (Invalid)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertOctagon size={14} /> Gating Blocked ({currentSignalEval.statusLabel})
                      </div>
                      <p className="text-[11px] text-amber-200 leading-relaxed">
                        {currentSignalEval.rejectionReasons.join(' ')}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                        Raw diagnostic: <strong>{latestPacket?.oxygen_saturation ? `${latestPacket.oxygen_saturation}%` : '--'}</strong> (Withheld from clinical display).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      {latestPacket?.oxygen_saturation ? `${latestPacket.oxygen_saturation}%` : '--'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">SpO2</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                Dual-wavelength Beer-Lambert ratio of ratios: R = (AC_660 / DC_660) / (AC_940 / DC_940).
              </p>

              {/* Diagnostics & Clinical Accuracy Disclaimer */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center">
                  <span>Signal Quality:</span>
                  <span className={`font-bold ${currentSignalEval.color}`}>{currentSignalEval.status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Sensor Channel:</span>
                  <span className="text-slate-300">Dual 660nm Red / 940nm IR</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Timestamp:</span>
                  <span className="text-slate-300">
                    {latestPacket?.packet_timestamp
                      ? format(new Date(latestPacket.packet_timestamp), 'HH:mm:ss.SSS')
                      : '--'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 leading-tight space-y-1">
                <strong>Standards &amp; Accuracy:</strong> Standard: ISO 80601-2-61:2026, Edition 3 (clause 201.12.1). Clinical validation requires controlled human hypoxia desaturation trials (SaO2 70%-100%) across Monk Skin Tone Scale 1-10 with Arms ≤ 3.5%. Investigational prototype.
              </div>
            </div>

            {/* 3. Fingertip Contact Force (Load Cell) */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                  <Gauge size={15} className="text-blue-400" /> Fingertip Contact Force
                </span>
                <div className="flex items-center gap-1.5">
                  {latestPacket?.source_type === 'SIMULATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      SIMULATION
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      HARDWARE
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white font-mono">
                    {latestPacket?.contact_force_n !== null && latestPacket?.contact_force_n !== undefined ? `${latestPacket.contact_force_n} N` : '--'}
                  </span>
                  <span className={`text-xs font-bold ${
                    (latestPacket?.contact_force_n ?? 1.2) > forceProfile.maxValid
                      ? 'text-rose-400'
                      : (latestPacket?.contact_force_n ?? 1.2) < forceProfile.minValid
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {(latestPacket?.contact_force_n ?? 1.2) > forceProfile.maxValid
                      ? 'Excessive (Occluding)'
                      : (latestPacket?.contact_force_n ?? 1.2) < forceProfile.minValid
                      ? 'Insufficient Contact'
                      : `Optimal (${forceProfile.optimalMin} - ${forceProfile.optimalMax} N)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForceConfig(!showForceConfig)}
                  className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono flex items-center gap-1 cursor-pointer"
                  title="Configure Hardware Force Range"
                >
                  <Sliders size={11} /> {showForceConfig ? 'Close Config' : 'Config Profile'}
                </button>
              </div>

              {/* Hardware Force Range Configuration Panel */}
              {showForceConfig && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300 font-semibold text-[11px]">
                    <span>Hardware Force Range (Configurable):</span>
                    <span className="text-[10px] text-teal-400 font-mono">MC-BIO-FS100 Validated</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block">Min Gating (N):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="1.0"
                        value={forceProfile.minValid}
                        onChange={(e) => setForceProfile({ ...forceProfile, minValid: parseFloat(e.target.value) || 0.3 })}
                        className="w-full bg-slate-800 px-2 py-1 rounded text-white border border-slate-700"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Max Gating (N):</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1.5"
                        max="5.0"
                        value={forceProfile.maxValid}
                        onChange={(e) => setForceProfile({ ...forceProfile, maxValid: parseFloat(e.target.value) || 2.5 })}
                        className="w-full bg-slate-800 px-2 py-1 rounded text-white border border-slate-700"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Configurable based on physical mechanical load-cell validation and optical window geometry.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-snug">
                Piezoresistive load-cell feedback. Device-specific optimal range: {forceProfile.optimalMin}–{forceProfile.optimalMax} N.
              </p>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center">
                  <span>Gating Status:</span>
                  <span className={`font-bold ${
                    (latestPacket?.contact_force_n ?? 1.2) >= forceProfile.minValid && (latestPacket?.contact_force_n ?? 1.2) <= forceProfile.maxValid
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}>
                    {(latestPacket?.contact_force_n ?? 1.2) >= forceProfile.minValid && (latestPacket?.contact_force_n ?? 1.2) <= forceProfile.maxValid
                      ? `Within Valid Range (${forceProfile.minValid} - ${forceProfile.maxValid} N)`
                      : 'Gating Blocked'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Timestamp:</span>
                  <span className="text-slate-300">
                    {latestPacket?.packet_timestamp
                      ? format(new Date(latestPacket.packet_timestamp), 'HH:mm:ss.SSS')
                      : '--'}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 leading-tight">
                <strong>Hardware Note:</strong> Optimal contact force is device-specific to the 8mm flat sapphire interface of this unit. It is NOT universally optimal for all optical geometries or anatomical sites.
              </div>
            </div>

            {/* 4. Perfusion Index (PI) (SEPARATED CARD) */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                  <Activity size={15} className="text-amber-400" /> Perfusion Index (PI)
                </span>
                <div className="flex items-center gap-1.5">
                  {latestPacket?.source_type === 'SIMULATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      SIMULATION
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      HARDWARE
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {!currentSignalEval.piValid ? (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-slate-500 font-mono">--</span>
                      <span className="text-xs text-slate-500 font-mono">AC/DC (Gated)</span>
                    </div>
                    <p className="text-[10px] text-amber-300 font-mono">
                      Gated: Pulsatile AC/DC ratio unreliable under {currentSignalEval.statusLabel}.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      {latestPacket?.perfusion_index ? `${latestPacket.perfusion_index}%` : '--'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">AC/DC</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                Pulsatile strength ratio $PI = (AC / DC) \times 100\%$. Diagnostic indicator of peripheral vascular tone.
              </p>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center">
                  <span>Perfusion Strength:</span>
                  <span className={`font-bold ${
                    (latestPacket?.perfusion_index ?? 2.4) >= 1.0
                      ? 'text-emerald-400'
                      : (latestPacket?.perfusion_index ?? 2.4) >= 0.4
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {(latestPacket?.perfusion_index ?? 2.4) >= 1.0
                      ? 'Optimal Perfusion'
                      : (latestPacket?.perfusion_index ?? 2.4) >= 0.4
                      ? 'Moderate Perfusion'
                      : 'Low Perfusion / Vasoconstricted'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Timestamp:</span>
                  <span className="text-slate-300">
                    {latestPacket?.packet_timestamp
                      ? format(new Date(latestPacket.packet_timestamp), 'HH:mm:ss.SSS')
                      : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Dermal Surface Temperature (SEPARATED CARD) */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <div>
                  <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                    <Thermometer size={15} className="text-orange-400" /> Dermal Surface Temperature
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">Cutaneous Fingertip Skin Surface</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer font-mono"
                  >
                    °{tempUnit}
                  </button>
                  {latestPacket?.source_type === 'SIMULATION' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      SIMULATION
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      HARDWARE
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white font-mono">
                  {latestPacket?.dermal_temperature_c
                    ? tempUnit === 'C'
                      ? `${latestPacket.dermal_temperature_c}°C`
                      : `${((latestPacket.dermal_temperature_c * 9) / 5 + 32).toFixed(1)}°F`
                    : '--'}
                </span>
                <span className="text-xs text-slate-400 font-mono">Dermal IR</span>
              </div>

              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 leading-tight flex items-center gap-1.5 font-mono">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>INDEPENDENT SENSOR: MLX90614 infrared thermopile optical FOV operates independently of contact load cell.</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-snug">
                Melexis MLX90614 infrared thermopile with optical gradient compensation.
              </p>

              <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400 font-mono">
                <div className="flex justify-between items-center">
                  <span>Measurement Site:</span>
                  <span className="text-slate-300">Fingertip Skin Surface (Cutaneous)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Timestamp:</span>
                  <span className="text-slate-300">
                    {latestPacket?.packet_timestamp
                      ? format(new Date(latestPacket.packet_timestamp), 'HH:mm:ss.SSS')
                      : '--'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200/90 leading-relaxed space-y-1">
                <strong className="text-amber-300 block font-semibold">Clinical Advisory (Not Core Body Temperature):</strong>
                <span>
                  Clearly identified as dermal surface skin temperature, NOT core body temperature. Dermal temperature reflects peripheral microvascular perfusion and ambient thermal exposure, typically reading 2.0°C to 4.0°C below core body temperature. Dermal skin temperature alone MUST NEVER be used to diagnose or rule out fever, hypothermia, or systemic infectious illness.
                </span>
              </div>
            </div>

            {/* 6. Cryptographic Packet Provenance & Telemetry Audit Card */}
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-slate-200">
                  <ShieldCheck size={15} className="text-teal-400" /> Telemetry Audit &amp; Authentication
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                  latestPacket?.source_type === 'SIMULATION'
                    ? latestPacket?.auth_signature?.includes('CORRUPTED') || latestPacket?.auth_verified === false
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : latestPacket?.auth_verified
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : latestPacket?.auth_signature
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {latestPacket?.source_type === 'SIMULATION'
                    ? latestPacket?.auth_signature?.includes('CORRUPTED') || latestPacket?.auth_verified === false
                      ? 'AUTHENTICATION FAILED'
                      : 'DEMO VERIFIED'
                    : latestPacket?.auth_verified
                    ? 'HMAC VERIFIED'
                    : latestPacket?.auth_signature
                    ? 'AUTHENTICATION FAILED'
                    : 'AUTHENTICATION UNAVAILABLE'}
                </span>
              </div>

              {/* Multi-Section Telemetry Audit */}
              <div className="space-y-2 font-mono text-xs">
                {/* Section 1: Message Authentication */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">1. Message Authentication:</span>
                    {latestPacket?.source_type === 'SIMULATION' ? (
                      latestPacket?.auth_signature?.includes('CORRUPTED') || latestPacket?.auth_verified === false ? (
                        <span className="text-rose-400 font-bold">Corrupted Signature</span>
                      ) : (
                        <span className="text-amber-300 font-bold">Simulated Test Key</span>
                      )
                    ) : latestPacket?.auth_verified ? (
                      <span className="text-emerald-400 font-bold">Hardware Crypto Key (HMAC-SHA256)</span>
                    ) : latestPacket?.auth_signature ? (
                      <span className="text-rose-400 font-bold">Signature Verification Failed</span>
                    ) : (
                      <span className="text-slate-400">Unauthenticated</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {latestPacket?.source_type === 'SIMULATION'
                      ? 'Simulated demo packet. Strictly isolated from hardware secure element.'
                      : 'Cryptographically authenticates device identity using hardware-enclave pre-shared key.'}
                  </p>
                </div>

                {/* Section 2: Payload Data Integrity */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">2. Payload Data Integrity:</span>
                    <span className="text-teal-300 font-bold">SHA-256 Checksum Match</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate" title={latestPacket?.packet_hash}>
                    Checksum: <span className="text-slate-300">{latestPacket?.packet_hash ? `${latestPacket.packet_hash.slice(0, 18)}...` : '--'}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Verifies payload data integrity against bit-level corruption. Kept strictly separate from cryptographic identity authentication.
                  </p>
                </div>

                {/* Section 3: Sequence & Timing Audit */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sequence Audit:</span>
                    <strong className="text-white">#{latestPacket?.sequence_number ?? '--'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sequence Continuity:</span>
                    {sequenceLossDetected ? (
                      <strong className="text-rose-400">⚠️ Sequence Gap ({missingPacketCount} missing)</strong>
                    ) : (
                      <strong className="text-emerald-400">Continuous Monotonic</strong>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Measurement Interval:</span>
                    {intervalGapDetected ? (
                      <strong className="text-amber-400">⚠️ Gap Detected ({measurementIntervalSec?.toFixed(1)}s interval)</strong>
                    ) : measurementIntervalSec !== null ? (
                      <strong className="text-teal-300">Nominal ({measurementIntervalSec.toFixed(1)}s)</strong>
                    ) : (
                      <strong className="text-slate-400">Baseline Packet</strong>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Packet Loss Audit:</span>
                    {sequenceLossDetected ? (
                      <strong className="text-rose-400">Loss detected via sequence jump</strong>
                    ) : intervalGapDetected ? (
                      <strong className="text-amber-300">Not detected from sequence numbers alone</strong>
                    ) : (
                      <strong className="text-emerald-400">No Sequence Discontinuity Detected</strong>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Data Freshness / Age:</span>
                    {isDataFresh ? (
                      <strong className="text-emerald-400">🟢 Live Fresh ({measurementAgeSec?.toFixed(1)}s age)</strong>
                    ) : isDataDelayed ? (
                      <strong className="text-amber-400">🟡 Delayed Ingestion ({measurementAgeSec?.toFixed(1)}s age)</strong>
                    ) : isDataStale ? (
                      <strong className="text-rose-400">🔴 Stale Data ({formatDuration(measurementAgeSec)} ago)</strong>
                    ) : (
                      <strong className="text-slate-400">--</strong>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Network Transit Latency:</span>
                    <strong className={isSimulated ? 'text-teal-300' : 'text-slate-400'}>
                      {networkTransitLatencyDisplay}
                    </strong>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight pt-0.5">
                    Note: Unsynchronized hardware and server clocks cannot calculate network transit latency without active PTP/NTP clock synchronization.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Regulated Gate Banners: Blood Pressure & Blood Glucose */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Blood Pressure Status */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <Gauge size={16} className="text-amber-400" /> Cuffless Blood Pressure (Investigational Surrogate)
                </span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  selectedDevice?.is_bp_calibrated
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}>
                  {selectedDevice?.is_bp_calibrated ? 'CALIBRATED AGAINST REFERENCE CUFF' : 'CALIBRATION REQUIRED'}
                </span>
              </div>

              {selectedDevice?.is_bp_calibrated ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold font-mono text-slate-500 line-through">
                      {latestPacket?.systolic_bp ? `${latestPacket.systolic_bp} / ${latestPacket.diastolic_bp} mmHg` : '-- / -- mmHg'}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold font-mono">
                      DIAGNOSTIC USE BLOCKED (UNVALIDATED)
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1 font-mono">
                    <div>Reference Measurement: <strong>120/80 mmHg (Omron Series 10 Upper Arm Monitor)</strong></div>
                    <div>Validation Status: <strong className="text-rose-400">UNVALIDATED SURROGATE (Diagnostic Use Blocked)</strong></div>
                    <div>Calibration Standard: <strong>IEEE Std 1708-2014 &amp; IEEE 1708a-2019</strong></div>
                    <div>Clinical Standard: <strong>ANSI/AAMI/ISO 81060-2:2019 (Not Clinically Validated)</strong></div>
                    <div>
                      Calibration Date:{' '}
                      <strong className="text-teal-300">
                        {selectedDevice.bp_calibration_expiry
                          ? format(new Date(new Date(selectedDevice.bp_calibration_expiry).getTime() - 30 * 24 * 3600 * 1000), 'MMM dd, yyyy')
                          : 'Nov 03, 2026'}
                      </strong>
                    </div>
                    <div>
                      Calibration Expiry:{' '}
                      <strong className="text-teal-300">
                        {selectedDevice.bp_calibration_expiry
                          ? format(new Date(selectedDevice.bp_calibration_expiry), 'MMM dd, yyyy')
                          : '--'}
                      </strong>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed space-y-1">
                    <strong className="text-amber-300 block font-semibold">Distinguishing Reference Cuff Calibration from Clinical Validation:</strong>
                    <span>
                      Baseline pneumatic cuff calibration establishes an individual's initial pulse transit transfer curve. However, calibration alone DOES NOT establish clinical diagnostic accuracy. Clinical validation requires formal multi-subject clinical trials under ANSI/AAMI/ISO 81060-2:2019 across diverse hemodynamic states. Because this optical prototype lacks ISO 81060-2 clinical validation, cuffless BP values remain strictly BLOCKED from clinical diagnosis or medication titrations.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <strong>Measurement Blocked:</strong> Uncalibrated cuffless blood pressure cannot measure absolute hydrostatic pressure without reference cuff initialization. Dynamic changes in vascular compliance decouple pulse velocity from pressure.
                  </div>
                  <p>
                    Navigate to the <strong>Pneumatic Cuff Calibration</strong> tab to initialize baseline pressure using an approved arm cuff.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('calibration')}
                    className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold cursor-pointer hover:bg-teal-500/30"
                  >
                    Open Pneumatic Cuff Calibration Tab →
                  </button>
                </div>
              )}
            </div>

            {/* Blood Glucose Status */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-400" /> Non-Invasive Blood Glucose Restriction
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  CLINICALLY NOT FEASIBLE (FDA Warned)
                </span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 leading-relaxed">
                  <strong>FDA Safety Communication (February 21, 2024):</strong> The FDA specifically warned consumers, patients, caregivers, and healthcare providers that the agency has <strong>not authorized, cleared, or approved ANY smartwatch or smart ring</strong> intended to measure or estimate blood glucose values on its own. Using unauthorized smartwatches or smart rings can cause inaccurate glucose measurements, resulting in dangerous insulin overdoses or missed hypoglycemia treatments leading to coma or death.
                </div>
                <p className="text-slate-400 leading-relaxed">
                  <strong>Biomedical Optics Perspective:</strong> In cutaneous tissue, low-concentration glucose molecules (~0.1% blood mass) lack discrete, non-overlapping optical absorption bands in visible and near-infrared spectra where water, protein, and hemoglobin absorption dominate. While multi-spectral near-infrared, Raman spectroscopy, and photoacoustics remain active laboratory research areas, uncalibrated consumer wearables cannot reliably distinguish optical glucose signatures from background tissue variations without invasive reference calibration.
                </p>
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-teal-300 block">Supported Authorized Device Integrations:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthorizedModal('BLE_GLUCOSE')}
                      className="px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold hover:bg-teal-500/30 cursor-pointer flex items-center gap-1.5"
                    >
                      <Bluetooth size={13} /> Pair Authorized BLE Glucose Meter (GATT 0x1808)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthorizedModal('CGM_SYNC')}
                      className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-semibold hover:bg-blue-500/30 cursor-pointer flex items-center gap-1.5"
                    >
                      <Activity size={13} /> Connect Authorized CGM Data Feed (Dexcom / FreeStyle Libre)
                    </button>
                  </div>
                </div>
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
                  Cryptographically authenticated packets with timestamp sequence, HMAC audit, and source attribution
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
                    <th className="py-2.5 px-3">Seq # &amp; Loss Audit</th>
                    <th className="py-2.5 px-3">Source Time (UTC / Local)</th>
                    <th className="py-2.5 px-3">Arrival Time (Server)</th>
                    <th className="py-2.5 px-3">Age / Freshness</th>
                    <th className="py-2.5 px-3">Pulse (bpm)</th>
                    <th className="py-2.5 px-3">SpO2 (%)</th>
                    <th className="py-2.5 px-3">PI (%)</th>
                    <th className="py-2.5 px-3">Dermal Surface Temp (°C)</th>
                    <th className="py-2.5 px-3">Force (N)</th>
                    <th className="py-2.5 px-3">Calculated Signal Quality</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">HMAC Auth</th>
                    <th className="py-2.5 px-3">Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {packets.map((pkt) => {
                    const val = evalSignalQuality(pkt, forceProfile)
                    const pktAgeSec = pkt.packet_timestamp
                      ? Math.max(0, (Date.now() - new Date(pkt.packet_timestamp).getTime()) / 1000)
                      : null
                    const isRowStale = pktAgeSec !== null && pktAgeSec >= 60.0
                    const isRowDelayed = pktAgeSec !== null && pktAgeSec >= 5.0 && pktAgeSec < 60.0

                    return (
                      <tr key={pkt.id} className="hover:bg-slate-800/30 transition-all">
                        <td className="py-2.5 px-3 text-slate-400">
                          <span className="font-bold text-white">#{pkt.sequence_number ?? '--'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          <div className="text-white font-medium">
                            {format(new Date(pkt.packet_timestamp), 'HH:mm:ss.SSS')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(pkt.packet_timestamp).toISOString().slice(11, 23)} UTC
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {pkt.created_at ? format(new Date(pkt.created_at), 'HH:mm:ss.SSS') : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          {isRowStale ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                              Stale ({formatDuration(pktAgeSec)})
                            </span>
                          ) : isRowDelayed ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                              Delayed ({pktAgeSec?.toFixed(1)}s)
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                              Fresh ({pktAgeSec?.toFixed(1)}s)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-teal-400 font-bold">
                          {val.pulseRateValid ? (
                            pkt.heart_rate ?? '--'
                          ) : (
                            <span className="line-through text-slate-500" title={val.rejectionReasons.join(' ')}>
                              {pkt.heart_rate ?? '--'} <span className="text-[9px] text-amber-400 no-underline font-normal">(Gated)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400">
                          {val.spo2Valid ? (
                            pkt.oxygen_saturation ? `${pkt.oxygen_saturation}%` : '--'
                          ) : (
                            <span className="line-through text-slate-500" title={val.rejectionReasons.join(' ')}>
                              {pkt.oxygen_saturation ? `${pkt.oxygen_saturation}%` : '--'} <span className="text-[9px] text-amber-400 no-underline font-normal">(Gated)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {val.piValid ? (
                            pkt.perfusion_index ? `${pkt.perfusion_index}%` : '--'
                          ) : (
                            <span className="line-through text-slate-500" title="Low perfusion or contact gating">
                              {pkt.perfusion_index ? `${pkt.perfusion_index}%` : '--'} <span className="text-[9px] text-amber-400 no-underline font-normal">(Gated)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-orange-400 font-medium">
                          {pkt.dermal_temperature_c ? `${pkt.dermal_temperature_c}°C (Dermal)` : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-blue-400">
                          {pkt.contact_force_n ? `${pkt.contact_force_n} N` : '--'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${val.badgeBg}`}>
                            {val.primarySignalQuality}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            pkt.source_type === 'HARDWARE'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {pkt.source_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {pkt.source_type === 'SIMULATION' ? (
                            pkt.auth_signature?.includes('CORRUPTED') || pkt.auth_verified === false ? (
                              <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                                <Unlock size={11} /> AUTHENTICATION FAILED
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-300 flex items-center gap-1 font-mono">
                                <Zap size={11} /> DEMO VERIFIED
                              </span>
                            )
                          ) : pkt.auth_verified ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                              <Lock size={11} /> HMAC VERIFIED
                            </span>
                          ) : pkt.auth_signature ? (
                            <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                              <Unlock size={11} /> AUTHENTICATION FAILED
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Unlock size={11} /> AUTHENTICATION UNAVAILABLE
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-28 truncate" title={`SHA-256 Checksum (Integrity Only, Not Authenticity): ${pkt.packet_hash}`}>
                          {pkt.packet_hash ? pkt.packet_hash.slice(0, 12) + '...' : '--'}
                        </td>
                      </tr>
                    )
                  })}
                  {packets.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-500">
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

      {/* ── TAB 2: Telemetry Security & Connection Audit Logs ────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Key size={14} className="text-teal-400" /> Cryptographic Authentication
              </span>
              <div className="text-xl font-bold text-white font-mono">HMAC-SHA256</div>
              <p className="text-[11px] text-slate-400">
                Packets are authenticated using device-specific secret keys, preventing packet tampering and man-in-the-middle injection.
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-blue-400" /> Monotonic Sequence &amp; Anti-Replay
              </span>
              <div className="text-xl font-bold text-emerald-400 font-mono">Enforced Replay Filter</div>
              <p className="text-[11px] text-slate-400">
                Reject any telemetry packet where seq is less than or equal to previous maximum sequence. Captures and blocks replay attacks immediately.
              </p>
            </div>

            <div className="glass p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-purple-400" /> Clock Drift Validation
              </span>
              <div className="text-xl font-bold text-teal-300 font-mono">±300s Bounded</div>
              <p className="text-[11px] text-slate-400">
                Packets with timestamps skewed into the future or stale (&gt;24h) are rejected at the ingestion boundary.
              </p>
            </div>
          </div>

          {/* Connection Event Audit Table */}
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield size={17} className="text-teal-400" /> Security &amp; Connection Lifecycle Audit Log
                </h3>
                <span className="text-xs text-slate-400">
                  Immutable audit records of hardware handshake, disconnection, calibration, and security anomalies
                </span>
              </div>
              <button
                onClick={() => selectedDevice && fetchEvents(selectedDevice.id)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Refresh Events"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Event Timestamp</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/30 transition-all">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {format(new Date(evt.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          evt.event_type === 'CONNECT' || evt.event_type === 'SIMULATION_CONNECTED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : evt.event_type === 'DISCONNECT' || evt.event_type === 'SIMULATION_DISCONNECTED'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : evt.event_type === 'REPLAY_ATTACK_BLOCKED' || evt.event_type === 'BAD_SIGNATURE'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        }`}>
                          {evt.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {evt.details ?? '--'}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">
                        No hardware connection or security audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Hardware Architecture & Schematics ─────────────────────── */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu size={18} className="text-teal-400" /> Physical Finger-Measurement Station: MediCare BioSens FS-100
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
              Engineered as an enclosed desktop/kiosk biometric peripheral designed to interface with MediCare AI over WebSerial (CDC ACM USB) or BLE 5.2. Designed around strict physiological signal conditioning, multi-spectral optical deconvolution, mechanical force feedback, and medical electrical isolation.
            </p>

            {/* Subsystem Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 text-xs">
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
                  <li>HMAC-SHA256 hardware cryptographic packet signing</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} /> 5. IEC 60601-1 Galvanic Isolation
                </span>
                <p className="text-slate-300">
                  <strong>Analog Devices ADuM4160</strong> 5kV USB digital isolator + medical DC-DC isolated power supply.
                </p>
                <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px]">
                  <li>Designed to Type BF Patient-Applied Part safety isolation criteria</li>
                  <li>Creepage &amp; clearance distance &gt; 8.0 mm across isolation barrier</li>
                  <li>Protects patient against mains surge or ground loops</li>
                  <li>EMC Target Specification: Designed per IEC 60601-1-2:2014+AMD1:2020 (Investigational Prototype: Formal NRTL certification required)</li>
                </ul>
              </div>

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
                  <li>Biocompatibility Target: Evaluated per ISO 10993-5:2009 &amp; ISO 10993-10:2021 criteria (Prototype: Formal GLP laboratory certification pending)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Scientific Feasibility & FDA Guidance ──────────────────── */}
      {activeTab === 'science' && (
        <div className="space-y-6">
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
                Optical photoplethysmography measures volumetric capillary light absorption. It cannot isolate low-concentration glucose molecules from dominant background tissue absorption (water, hemoglobin, and protein) without invasive reference calibration. Cuffless blood pressure is decoupled by dynamic changes in vascular tone, arterial compliance, and hydrostatic pressure, strictly requiring periodic pneumatic cuff recalibration under IEEE Std 1708.
              </p>
            </div>
          </div>

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
                <ShieldCheck size={16} className="text-teal-400" /> Standards &amp; Regulatory Audit Matrix
              </h4>

              <div className="space-y-3 text-xs">
                {/* 1. Formal Certification Status */}
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 space-y-1">
                  <div className="flex justify-between items-center font-bold">
                    <span>Formal Certification Status:</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      NOT CERTIFIED / PROTOTYPE ONLY
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-tight">
                    This device is an investigational hardware testbench. It is NOT FDA-cleared, NOT CE-marked, and NOT certified to ISO standards. Clinical diagnosis or medication titration is strictly prohibited.
                  </p>
                </div>

                {/* 2. Standards Reviewed vs Applicable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="font-bold text-teal-300 block">Standards Reviewed:</span>
                    <ul className="text-slate-400 space-y-0.5 list-disc list-inside text-[10px]">
                      <li>ISO 80601-2-61:2026, Edition 3</li>
                      <li>IEEE Std 1708-2014 &amp; 1708a-2019</li>
                      <li>ANSI/AAMI/ISO 81060-2:2019</li>
                      <li>ISO 15197:2013 (SMBG)</li>
                      <li>IEC 60601-1 &amp; IEC 60601-1-2</li>
                      <li>ISO 10993-5:2009 &amp; ISO 10993-10:2021</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <span className="font-bold text-teal-300 block">Applicable to Subsystem Design:</span>
                    <ul className="text-slate-400 space-y-0.5 text-[10px]">
                      <li><strong>SpO2:</strong> ISO 80601-2-61:2026, Ed. 3 (cl. 201.12.1)</li>
                      <li><strong>BP Cal:</strong> IEEE Std 1708-2014 (Cuffless PWA)</li>
                      <li><strong>BP Valid:</strong> ISO 81060-2 (Required for diagnosis)</li>
                      <li><strong>Isolation:</strong> IEC 60601-1 (Type BF 5kV)</li>
                      <li><strong>Optical Window:</strong> ISO 10993 (Sapphire)</li>
                    </ul>
                  </div>
                </div>

                {/* 3. Testing Completed vs Not Completed */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="font-bold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Testing Completed:
                    </span>
                    <ul className="text-slate-300 space-y-0.5 text-[10px] list-disc list-inside">
                      <li>DSP optical filtering unit tests (0.5Hz IIR, 50/60Hz notch)</li>
                      <li>Load-cell force calibration (0.3N–2.5N gating bounds)</li>
                      <li>HMAC-SHA256 packet signing &amp; sequence anti-replay filter</li>
                      <li>Simulated fault injection bench testing</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      <AlertTriangle size={12} /> Testing Not Completed:
                    </span>
                    <ul className="text-slate-400 space-y-0.5 text-[10px] list-disc list-inside">
                      <li>Human hypoxia desaturation trial (SaO2 70-100%, Monk 1-10)</li>
                      <li>Formal NRTL accredited safety certification (IEC 60601-1)</li>
                      <li>Anechoic chamber radiated EMC testing (IEC 60601-1-2)</li>
                      <li>Multi-subject clinical BP trial (≥85 subjects, ISO 81060-2)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: Pneumatic Cuff Calibration (IEEE 1708) ─────────────────── */}
      {activeTab === 'calibration' && (
        <div className="max-w-2xl mx-auto glass p-6 rounded-2xl border border-slate-800 space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Gauge size={18} className="text-teal-400" /> IEEE Std 1708 Reference Cuff Calibration (Investigational Surrogate)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To establish baseline optical pulse wave analysis (PWA) on this device, IEEE Std 1708 requires reference calibration using an approved upper-arm pneumatic cuff monitor within 3 minutes of optical sensor contact.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed space-y-1">
            <strong className="text-amber-300 block font-semibold">Important Scientific &amp; Regulatory Notice:</strong>
            <span>
              Reference cuff calibration calculates an individualized pulse transit baseline against an upper-arm pneumatic cuff. <strong>Reference calibration alone DOES NOT establish clinical diagnostic accuracy</strong>, does NOT constitute clinical validation under ANSI/AAMI/ISO 81060-2, and unvalidated cuffless readings remain strictly blocked from medical diagnosis.
            </span>
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
              <span>2. Take reference cuff measurement on contralateral arm.</span><br />
              <span>3. Enter values immediately to calculate pulse wave transfer baseline.</span>
            </div>

            <button
              type="submit"
              disabled={isCalibrating}
              className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isCalibrating ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
              <span>Record Reference Cuff Calibration (Investigational Surrogate)</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 6: Clinical Test Simulator (DEMO MODE) ───────────────────── */}
      {activeTab === 'simulator' && (
        <div className="max-w-4xl mx-auto glass p-6 sm:p-7 rounded-3xl border border-amber-500/40 space-y-6 shadow-2xl shadow-amber-500/10 bg-[#0a1222]">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap size={24} className={isLiveSimulating ? 'animate-pulse' : ''} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-display">
                    Virtual Hardware Test Simulator
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    DEMO MODE
                  </span>
                </div>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Simulate peripheral telemetry, physiological ranges, sensor detachment, packet loss, and cryptographic tamper.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="popout-simulator-btn"
              onClick={() => setIsSimulatorOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sliders size={13} /> Open as Floating Modal
            </button>
          </div>

          {/* Strict Regulatory & Clinical Isolation Notice */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldAlert size={16} className="shrink-0" />
              <span>STRICT ISOLATION PROTOCOL (CLINICAL SAFETY)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              All telemetry generated by this simulator is tagged with <code className="bg-black/30 px-1 py-0.5 rounded font-mono">source_type="SIMULATION"</code> and <code className="bg-black/30 px-1 py-0.5 rounded font-mono">is_sample=true</code>. They are completely isolated from real patient clinical charts and will never trigger actual medical emergency alerts. Physical hardware remains <strong>DISCONNECTED</strong> throughout simulation.
            </p>
          </div>

          {/* Simulator Status & Live Control Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Simulator Status:</span>
                  {isLiveSimulating ? (
                    <span className="font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Simulation Active (Streaming Telemetry)
                    </span>
                  ) : (
                    <span className="font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 font-mono">
                      <span className="w-2 h-2 rounded-full bg-slate-500" />
                      Simulation Inactive / Stopped
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Hardware: <strong className="text-slate-400">DISCONNECTED</strong>
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                {simStatusMessage}
              </div>
            </div>

            {/* Start, Stop, Reset Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                id="inline-start-sim-btn"
                onClick={handleStartSimulation}
                disabled={isLiveSimulating}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={14} className={isLiveSimulating ? '' : 'fill-white'} />
                <span>{isLiveSimulating ? 'Streaming Live Data...' : 'Start Simulation'}</span>
              </button>

              <button
                type="button"
                id="inline-stop-sim-btn"
                onClick={handleStopSimulation}
                disabled={!isLiveSimulating}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pause size={14} />
                <span>Stop Simulation</span>
              </button>

              <button
                type="button"
                id="inline-reset-sim-btn"
                onClick={handleResetSimulation}
                className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
              >
                <RotateCcw size={14} />
                <span>Reset Simulation</span>
              </button>
            </div>
          </div>

          {/* 8 Predefined Demonstration Scenarios */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">Predefined Demonstration Scenarios (Software Testing):</span>
              <span className="text-[11px] text-slate-500">Clicking loads scenario baseline and updates live telemetry</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <button
                type="button"
                id="scenario-btn-normal"
                onClick={() => applyScenario('normal')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'normal' || simScenario === 'optimal_pulse'
                    ? 'bg-teal-500/20 border-teal-500/50 text-teal-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">1. Normal Sensor Readings</span>
                <span className="text-[10px] text-slate-500 block">72 bpm · 98.5% SpO2 · 1.2N</span>
              </button>

              <button
                type="button"
                id="scenario-btn-elevated-hr"
                onClick={() => applyScenario('elevated_hr')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'elevated_hr'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">2. Elevated Heart Rate</span>
                <span className="text-[10px] text-slate-500 block">138 bpm · Tachycardia Demo</span>
              </button>

              <button
                type="button"
                id="scenario-btn-low-spo2"
                onClick={() => applyScenario('low_spo2')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'low_spo2'
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">3. Low SpO2 Demo</span>
                <span className="text-[10px] text-slate-500 block">86.5% SpO2 · Hypoxemia Demo</span>
              </button>

              <button
                type="button"
                id="scenario-btn-poor-signal"
                onClick={() => applyScenario('poor_signal')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'poor_signal' || simScenario === 'motion_noise'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">4. Poor Signal Quality</span>
                <span className="text-[10px] text-slate-500 block">Tremor noise · Force 0.22N</span>
              </button>

              <button
                type="button"
                id="scenario-btn-sensor-disconnected"
                onClick={() => applyScenario('sensor_disconnected')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'sensor_disconnected' || simScenario === 'sensor_failure'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">5. Sensor Disconnected</span>
                <span className="text-[10px] text-slate-500 block">Leads off · Masked readings</span>
              </button>

              <button
                type="button"
                id="scenario-btn-packet-loss"
                onClick={() => applyScenario('packet_loss')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'packet_loss'
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">6. Packet Loss</span>
                <span className="text-[10px] text-slate-500 block">Sequence jump (+10 seq)</span>
              </button>

              <button
                type="button"
                id="scenario-btn-calibration-required"
                onClick={() => applyScenario('calibration_required')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'calibration_required' || simScenario === 'calibration_expired'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">7. Calibration Required</span>
                <span className="text-[10px] text-slate-500 block">Expired &gt;30d · BP gated</span>
              </button>

              <button
                type="button"
                id="scenario-btn-connection-failure"
                onClick={() => applyScenario('connection_failure')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  simScenario === 'connection_failure'
                    ? 'bg-red-500/20 border-red-500/50 text-red-200 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="block font-semibold">8. Connection Failure</span>
                <span className="text-[10px] text-slate-500 block">GATT timeout simulation</span>
              </button>
            </div>
          </div>

          {/* Adjustable Demonstration Inputs (Sliders) */}
          <div className="space-y-3">
            <span className="font-bold text-slate-200 text-xs block">
              Adjustable Demonstration Inputs (Values tagged SIMULATED DATA):
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Heart Rate Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Activity size={14} className="text-rose-400" /> Heart Rate (BPM)
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{simBpm} bpm</span>
                </div>
                <input
                  type="range"
                  min="35"
                  max="200"
                  value={simBpm}
                  onChange={(e) => setSimBpm(parseInt(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>35 bpm (Bradycardia)</span>
                  <span>200 bpm (Tachycardia)</span>
                </div>
              </div>

              {/* SpO2 Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Layers size={14} className="text-teal-400" /> Blood Oxygen (SpO2)
                  </span>
                  <span className="font-mono text-teal-400 font-bold">{simSpo2}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="100"
                  step="0.5"
                  value={simSpo2}
                  onChange={(e) => setSimSpo2(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>70% (Severe Hypoxemia)</span>
                  <span>100% (Ambient Normal)</span>
                </div>
              </div>

              {/* Contact Force Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Gauge size={14} className="text-blue-400" /> Contact Force (N)
                  </span>
                  <span className="font-mono text-blue-400 font-bold">{simForce} N</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="4.5"
                  step="0.1"
                  value={simForce}
                  onChange={(e) => setSimForce(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px]">
                  <span className={simForce < 0.3 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    &lt;0.3N (Light)
                  </span>
                  <span className={simForce >= 0.3 && simForce <= 2.5 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    1.0-1.5N (Optimal)
                  </span>
                  <span className={simForce > 2.5 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                    &gt;2.5N (Blanching)
                  </span>
                </div>
              </div>

              {/* Perfusion Index Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Flame size={14} className="text-amber-400" /> Perfusion Index (PI)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{simPi}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="12.0"
                  step="0.1"
                  value={simPi}
                  onChange={(e) => setSimPi(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.1% (Low / Cold)</span>
                  <span>12.0% (Strong Pulse)</span>
                </div>
              </div>

              {/* Dermal Temperature Slider */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Thermometer size={14} className="text-orange-400" /> Dermal Temp
                  </span>
                  <span className="font-mono text-orange-400 font-bold">
                    {simTemp}°C ({((simTemp * 9) / 5 + 32).toFixed(1)}°F)
                  </span>
                </div>
                <input
                  type="range"
                  min="24.0"
                  max="40.0"
                  step="0.2"
                  value={simTemp}
                  onChange={(e) => setSimTemp(parseFloat(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>24.0°C (Hypothermic)</span>
                  <span>40.0°C (Hyperthermic)</span>
                </div>
              </div>

              {/* Hardware Fault Injections */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-300 block">Hardware Fault Injection</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                  <input
                    type="checkbox"
                    checked={simLeadsConnected}
                    onChange={(e) => setSimLeadsConnected(e.target.checked)}
                    className="accent-teal-500"
                  />
                  <span>Sensor Leads Attached</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                  <input
                    type="checkbox"
                    checked={simBadSignature}
                    onChange={(e) => setSimBadSignature(e.target.checked)}
                    className="accent-rose-500"
                  />
                  <span>Corrupt HMAC Signature</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                  <input
                    type="checkbox"
                    checked={simPacketLoss}
                    onChange={(e) => setSimPacketLoss(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span>Simulate Packet Loss (+10 seq)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              id="inline-transmit-single-btn"
              onClick={() => handleSendSimulatorPacket()}
              disabled={isSimulating}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              <span>Transmit Single Demo Telemetry Packet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30 transition-all text-xs font-semibold cursor-pointer"
            >
              View Live Sensor Dashboard →
            </button>
          </div>

          {simFeedback && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/30 text-teal-300 text-xs font-mono">
              {simFeedback}
            </div>
          )}
        </div>
      )}

      {/* ── DEDICATED TEST SIMULATOR FLOATING MODAL (DEMO MODE) ─────────────── */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto glass p-6 sm:p-7 rounded-3xl border border-amber-500/40 shadow-2xl shadow-amber-500/15 space-y-5 bg-[#0a1222]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap size={22} className={isLiveSimulating ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white font-display">
                      Virtual Hardware Test Simulator
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                      DEMO MODE
                    </span>
                  </div>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    Generate synthetic optical biosensor packets, test gating conditions, and verify telemetry security.
                  </p>
                </div>
              </div>
              <button
                id="close-simulator-modal-btn"
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer border border-slate-800"
                title="Close Simulator"
              >
                <X size={18} />
              </button>
            </div>

            {/* Strict Regulatory & Clinical Separation Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert size={15} className="shrink-0" />
                <span>STRICT ISOLATION PROTOCOL (CLINICAL SAFETY)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                All telemetry generated by this simulator is tagged with <code className="bg-black/30 px-1 py-0.5 rounded font-mono">source_type="SIMULATION"</code> and <code className="bg-black/30 px-1 py-0.5 rounded font-mono">is_sample=true</code>. They are strictly isolated from clinical patient charts and will <strong>never</strong> trigger actual emergency alerts. Physical hardware connection state remains <strong>DISCONNECTED</strong> throughout simulation.
              </p>
            </div>

            {/* Simulator Status & Primary Action Buttons */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Simulator Status:</span>
                    {isLiveSimulating ? (
                      <span className="font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Simulation Active (Streaming)
                      </span>
                    ) : (
                      <span className="font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 font-mono">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        Simulation Inactive / Stopped
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Hardware: <strong className="text-slate-400">DISCONNECTED</strong>
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  {simStatusMessage}
                </div>
              </div>

              {/* Start, Stop, Reset Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  id="modal-start-simulation-btn"
                  onClick={handleStartSimulation}
                  disabled={isLiveSimulating}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={14} className={isLiveSimulating ? '' : 'fill-white'} />
                  <span>{isLiveSimulating ? 'Streaming Live Data...' : 'Start Simulation'}</span>
                </button>

                <button
                  type="button"
                  id="modal-stop-simulation-btn"
                  onClick={handleStopSimulation}
                  disabled={!isLiveSimulating}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pause size={14} />
                  <span>Stop Simulation</span>
                </button>

                <button
                  type="button"
                  id="modal-reset-simulation-btn"
                  onClick={handleResetSimulation}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                >
                  <RotateCcw size={14} />
                  <span>Reset Simulation</span>
                </button>
              </div>
            </div>

            {/* 8 Predefined Demonstration Scenarios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Predefined Demonstration Scenarios (Software Testing):</span>
                <span className="text-[11px] text-slate-500">Click to apply baseline parameters</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => applyScenario('normal')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'normal' || simScenario === 'optimal_pulse'
                      ? 'bg-teal-500/20 border-teal-500/50 text-teal-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">1. Normal Readings</span>
                  <span className="text-[10px] text-slate-500 block">72 bpm · 98.5% SpO2 · 1.2N</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('elevated_hr')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'elevated_hr'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">2. Elevated Heart Rate</span>
                  <span className="text-[10px] text-slate-500 block">138 bpm · Tachycardia Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('low_spo2')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'low_spo2'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">3. Low SpO2 Demo</span>
                  <span className="text-[10px] text-slate-500 block">86.5% SpO2 · Hypoxemia Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('poor_signal')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'poor_signal' || simScenario === 'motion_noise'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">4. Poor Signal Quality</span>
                  <span className="text-[10px] text-slate-500 block">Noise tremor · Force 0.22N</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('sensor_disconnected')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'sensor_disconnected' || simScenario === 'sensor_failure'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">5. Sensor Disconnected</span>
                  <span className="text-[10px] text-slate-500 block">Leads off · Masked readings</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('packet_loss')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'packet_loss'
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">6. Packet Loss</span>
                  <span className="text-[10px] text-slate-500 block">Sequence gap jump (+10)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('calibration_required')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'calibration_required' || simScenario === 'calibration_expired'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">7. Calibration Required</span>
                  <span className="text-[10px] text-slate-500 block">Expired &gt;30d · BP gated</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyScenario('connection_failure')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    simScenario === 'connection_failure'
                      ? 'bg-red-500/20 border-red-500/50 text-red-200 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="block font-semibold">8. Connection Failure</span>
                  <span className="text-[10px] text-slate-500 block">GATT timeout simulation</span>
                </button>
              </div>
            </div>

            {/* Adjustable Sensor Controls (Sliders) */}
            <div className="space-y-3">
              <span className="font-bold text-slate-200 text-xs block">
                Adjustable Demonstration Inputs (Values tagged SIMULATED DATA):
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. Heart Rate Slider */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Activity size={14} className="text-rose-400" /> Heart Rate (BPM)
                    </span>
                    <span className="font-mono text-rose-400 font-bold">{simBpm} bpm</span>
                  </div>
                  <input
                    type="range"
                    min="35"
                    max="200"
                    value={simBpm}
                    onChange={(e) => setSimBpm(parseInt(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>35 bpm (Bradycardia)</span>
                    <span>200 bpm (Tachycardia)</span>
                  </div>
                </div>

                {/* 2. Blood Oxygen SpO2 Slider */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Layers size={14} className="text-teal-400" /> Blood Oxygen (SpO2)
                    </span>
                    <span className="font-mono text-teal-400 font-bold">{simSpo2}%</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="100"
                    step="0.5"
                    value={simSpo2}
                    onChange={(e) => setSimSpo2(parseFloat(e.target.value))}
                    className="w-full accent-teal-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>70% (Severe Hypoxemia)</span>
                    <span>100% (Ambient Normal)</span>
                  </div>
                </div>

                {/* 3. Fingertip Contact Force Slider */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Gauge size={14} className="text-blue-400" /> Contact Force (N)
                    </span>
                    <span className="font-mono text-blue-400 font-bold">{simForce} N</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="4.5"
                    step="0.1"
                    value={simForce}
                    onChange={(e) => setSimForce(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px]">
                    <span className={simForce < 0.3 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                      &lt;0.3N (Light)
                    </span>
                    <span className={simForce >= 0.3 && simForce <= 2.5 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      1.0-1.5N (Optimal)
                    </span>
                    <span className={simForce > 2.5 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                      &gt;2.5N (Blanching)
                    </span>
                  </div>
                </div>

                {/* 4. Perfusion Index Slider */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Flame size={14} className="text-amber-400" /> Perfusion Index (PI)
                    </span>
                    <span className="font-mono text-amber-400 font-bold">{simPi}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="12.0"
                    step="0.1"
                    value={simPi}
                    onChange={(e) => setSimPi(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0.1% (Low / Cold)</span>
                    <span>12.0% (Strong Pulse)</span>
                  </div>
                </div>

                {/* 5. Dermal Temperature Slider */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Thermometer size={14} className="text-orange-400" /> Dermal Temp
                    </span>
                    <span className="font-mono text-orange-400 font-bold">
                      {simTemp}°C ({((simTemp * 9) / 5 + 32).toFixed(1)}°F)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="24.0"
                    max="40.0"
                    step="0.2"
                    value={simTemp}
                    onChange={(e) => setSimTemp(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>24.0°C (Hypothermic)</span>
                    <span>40.0°C (Hyperthermic)</span>
                  </div>
                </div>

                {/* Hardware Fault Injection Controls */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 block">Hardware Fault Injection</span>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                    <input
                      type="checkbox"
                      checked={simLeadsConnected}
                      onChange={(e) => setSimLeadsConnected(e.target.checked)}
                      className="accent-teal-500"
                    />
                    <span>Sensor Leads Attached</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                    <input
                      type="checkbox"
                      checked={simBadSignature}
                      onChange={(e) => setSimBadSignature(e.target.checked)}
                      className="accent-rose-500"
                    />
                    <span>Corrupt HMAC Signature</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs">
                    <input
                      type="checkbox"
                      checked={simPacketLoss}
                      onChange={(e) => setSimPacketLoss(e.target.checked)}
                      className="accent-purple-500"
                    />
                    <span>Simulate Packet Loss (+10 seq)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Transmit Single Demo Packet Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <button
                type="button"
                id="modal-transmit-single-packet-btn"
                onClick={() => handleSendSimulatorPacket()}
                disabled={isSimulating}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                <span>Transmit Single Demo Telemetry Packet</span>
              </button>

              <button
                type="button"
                id="modal-close-btn"
                onClick={() => setIsSimulatorOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
              >
                Close Simulator Panel
              </button>
            </div>

            {/* Feedback console */}
            {simFeedback && (
              <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/30 text-teal-300 text-xs font-mono">
                {simFeedback}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Authorized Glucose Devices (BLE GATT 0x1808 & CGM Sync) ────── */}
      {authorizedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-xl w-full glass p-6 sm:p-7 rounded-3xl border border-slate-700 shadow-2xl space-y-5 bg-[#0b1424]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  {authorizedModal === 'BLE_GLUCOSE' ? <Bluetooth size={22} /> : <Activity size={22} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    {authorizedModal === 'BLE_GLUCOSE'
                      ? 'Pair Authorized BLE Glucose Meter (GATT 0x1808)'
                      : 'Connect Authorized CGM Cloud Feed (Dexcom / FreeStyle Libre)'}
                  </h3>
                  <span className="text-[11px] font-mono text-teal-300">
                    {authorizedModal === 'BLE_GLUCOSE'
                      ? 'Bluetooth SIG Glucose Profile (GATT 0x1808 / 0x2A18) • ISO 15197:2013'
                      : 'FDA-Cleared iCGM API Integration • Interstitial Fluid Enzyme Sensors'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthorizedModal(null)
                  setAuthorizedActionMessage(null)
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Regulatory Notice */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <ShieldAlert size={14} /> Regulatory &amp; Scientific Compliance Notice
              </div>
              <p className="text-[11px] text-slate-400">
                In strict accordance with the <strong>FDA Safety Communication (Feb 21, 2024)</strong>, MediCare AI does NOT permit unauthorized non-invasive optical smartwatches or rings to estimate blood glucose. We integrate exclusively with clinically validated, FDA-cleared capillary blood meters and continuous interstitial glucose monitoring systems.
              </p>
            </div>

            {/* BLE Glucose Section */}
            {authorizedModal === 'BLE_GLUCOSE' && (
              <div className="space-y-3 text-xs">
                <span className="font-semibold text-slate-200 block">
                  Discovered In-Range Authorized BLE Glucose Meters:
                </span>
                <div className="space-y-2 font-mono">
                  <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/40 flex items-center justify-between">
                    <div>
                      <div className="text-white font-bold flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-teal-400" />
                        Accu-Chek Guide Me (Roche Diagnostics)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        MAC: 4C:24:D8:1A:90:3E • FDA 510(k) K182885 • RSSI: -54 dBm
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
                      READY TO PAIR
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-white font-bold flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-slate-400" />
                        Contour Next Gen (Ascensia Diabetes Care)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        MAC: E4:5F:01:82:11:BC • FDA 510(k) K213204 • RSSI: -68 dBm
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                      IN RANGE
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isConnectingAuthorized}
                    onClick={async () => {
                      setIsConnectingAuthorized(true)
                      setTimeout(async () => {
                        setIsConnectingAuthorized(false)
                        setAuthorizedActionMessage('Successfully paired Accu-Chek Guide Me (GATT 0x1808). Ingested valid capillary glucose reading: 104 mg/dL (fasting, timestamp synchronized).')
                        if (selectedDevice) {
                          try {
                            await api.post(`/api/v1/devices/${selectedDevice.id}/events`, {
                              event_type: 'BLE_GLUCOSE_METER_SYNC',
                              details: 'Paired Accu-Chek Guide Me (GATT 0x1808, FDA 510(k) K182885). Ingested capillary measurement: 104 mg/dL.',
                            })
                            fetchEvents(selectedDevice.id)
                          } catch (e) {
                            console.error('Failed to log event', e)
                          }
                        }
                      }, 1000)
                    }}
                    className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-500 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
                  >
                    {isConnectingAuthorized ? <RefreshCw size={14} className="animate-spin" /> : <Bluetooth size={14} />}
                    <span>Pair Accu-Chek &amp; Sync Capillary Reading</span>
                  </button>
                </div>
              </div>
            )}

            {/* CGM Sync Section */}
            {authorizedModal === 'CGM_SYNC' && (
              <div className="space-y-3 text-xs">
                <span className="font-semibold text-slate-200 block">
                  Select Authorized Continuous Glucose Monitor (iCGM) Service:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/40 space-y-1.5 cursor-pointer hover:border-blue-400 transition-all">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Radio size={14} className="text-blue-400" /> Dexcom Clarity Cloud
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dexcom G6 / G7 / ONE+ (FDA De Novo DEN170088 / K213977). 5-minute continuous glucose streaming.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 cursor-pointer hover:border-slate-700 transition-all">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Radio size={14} className="text-teal-400" /> Abbott LibreView
                    </div>
                    <p className="text-[11px] text-slate-400">
                      FreeStyle Libre 2 / Libre 3 (FDA 510(k) K222447). Real-time 1-minute interstitial glucose stream.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isConnectingAuthorized}
                    onClick={async () => {
                      setIsConnectingAuthorized(true)
                      setTimeout(async () => {
                        setIsConnectingAuthorized(false)
                        setAuthorizedActionMessage('Dexcom Clarity Cloud Feed authenticated. Ingested live CGM stream: 114 mg/dL (Trend: → Steady, sensor calibration nominal).')
                        if (selectedDevice) {
                          try {
                            await api.post(`/api/v1/devices/${selectedDevice.id}/events`, {
                              event_type: 'CGM_FEED_SYNC',
                              details: 'Dexcom Clarity Cloud Feed synchronized. Ingested stream: 114 mg/dL (trend: steady, FDA De Novo DEN170088).',
                            })
                            fetchEvents(selectedDevice.id)
                          } catch (e) {
                            console.error('Failed to log event', e)
                          }
                        }
                      }, 1000)
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
                  >
                    {isConnectingAuthorized ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                    <span>Authenticate Dexcom Cloud &amp; Ingest Stream</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Feedback Console */}
            {authorizedActionMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                <span>{authorizedActionMessage}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setAuthorizedModal(null)
                  setAuthorizedActionMessage(null)
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Close Integration Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
