import React, { useState } from 'react'
import {
  Cpu,
  Bluetooth,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Radio,
  ExternalLink,
  Info,
  RefreshCw,
  Heart,
  Droplets,
  Activity,
} from 'lucide-react'

export interface DeviceConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onDeviceLinked?: (deviceName: string) => void
}

interface MedicalDeviceSpec {
  id: string
  name: string
  category: 'bp' | 'glucose' | 'pulse'
  gattService: string
  description: string
  standard: string
  icon: React.ReactNode
}

const SUPPORTED_DEVICES: MedicalDeviceSpec[] = [
  {
    id: 'omron_evolv',
    name: 'Omron Evolv / Beurer BM Series',
    category: 'bp',
    gattService: '0x1810 (Blood Pressure Service)',
    description: 'ISO 81060-2 clinically validated oscillometric upper-arm inflatable cuff.',
    standard: 'AAMI / ESH / ISO 81060-2',
    icon: <Heart size={16} className="text-teal-400" />,
  },
  {
    id: 'dexcom_cgm',
    name: 'Dexcom G6/G7 & Abbott FreeStyle Libre',
    category: 'glucose',
    gattService: '0x1808 (Glucose GATT Profile)',
    description: 'Enzymatic interstitial fluid continuous glucose sensor or electrochemical meter.',
    standard: 'ISO 15197:2013 / FDA Cleared',
    icon: <Droplets size={16} className="text-cyan-400" />,
  },
  {
    id: 'masimo_spo2',
    name: 'Masimo / Nonin / Wellue Pulse Oximeter',
    category: 'pulse',
    gattService: '0x1822 (Pulse Oximeter Profile)',
    description: 'Dual-wavelength 660/940 nm transmissive photoplethysmography sensor.',
    standard: 'ISO 80601-2-61',
    icon: <Activity size={18} className="text-rose-400" />,
  },
]

export const DeviceConnectModal: React.FC<DeviceConnectModalProps> = ({
  isOpen,
  onClose,
  onDeviceLinked,
}) => {
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const isWebBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  const handlePairDevice = async (device: MedicalDeviceSpec) => {
    setErrorMessage(null)
    setStatusMessage(null)
    setConnectingId(device.id)

    if (!isWebBluetoothSupported) {
      setErrorMessage(
        'Web Bluetooth is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera on Windows, macOS, or Android to pair real hardware.'
      )
      setConnectingId(null)
      return
    }

    try {
      setStatusMessage(`Scanning for ${device.name}... Please accept the browser pairing prompt.`)

      // Attempt genuine Web Bluetooth peripheral request
      // @ts-ignore
      const bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [(device?.gattService || '').split(' ')[0] || 'heart_rate'] }],
        optionalServices: ['battery_service', 'device_information'],
      })

      if (bleDevice) {
        setStatusMessage(`Connecting to ${bleDevice.name || device.name}...`)
        const server = await bleDevice.gatt?.connect()

        if (server) {
          setConnectedDevice(bleDevice.name || device.name)
          setStatusMessage(`Connected successfully to ${bleDevice.name || device.name}!`)
          onDeviceLinked?.(bleDevice.name || device.name)
        }
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setErrorMessage(
          'No compatible Bluetooth peripheral was selected. Make sure your device is powered on, in Bluetooth pairing mode, and within range.'
        )
      } else if (err.name === 'SecurityError') {
        setErrorMessage('Bluetooth access was blocked by browser permissions or policy.')
      } else {
        setErrorMessage(err.message || 'Bluetooth connection could not be established.')
      }
    } finally {
      setConnectingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="rounded-2xl border border-slate-700 bg-slate-900 max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <Cpu size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connect Medical Device</h3>
              <p className="text-[11px] text-slate-400">Mode A — Bluetooth &amp; USB Hardware Ingest</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Browser Capability Banner */}
        {!isWebBluetoothSupported && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <strong>Web Bluetooth Required:</strong> Your current browser does not support Web Bluetooth APIs. Use Google Chrome or Microsoft Edge to stream directly from medical peripherals. Mode B manual entry remains fully available.
            </div>
          </div>
        )}

        {/* Status Messages */}
        {statusMessage && (
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Supported Peripherals List */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Compatible Clinical Peripherals
          </span>

          <div className="space-y-2">
            {SUPPORTED_DEVICES.map((dev) => {
              const isConnecting = connectingId === dev.id
              const isConnected = connectedDevice === dev.name

              return (
                <div
                  key={dev.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isConnected
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                        {dev.icon}
                      </div>
                      <h4 className="text-xs font-bold text-white">{dev.name}</h4>
                      {isConnected && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {dev.description}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                      <span>Standard: {dev.standard}</span>
                      <span>GATT: {dev.gattService}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePairDevice(dev)}
                    disabled={isConnecting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                      isConnected
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md'
                    }`}
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Pairing...</span>
                      </>
                    ) : isConnected ? (
                      <>
                        <CheckCircle2 size={12} />
                        <span>Linked</span>
                      </>
                    ) : (
                      <>
                        <Bluetooth size={12} />
                        <span>Pair Device</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Truthfulness Notice */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Info size={13} className="text-teal-400 shrink-0" />
            <span>Biomedical Truthfulness Requirement:</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            MediCare AI only accepts genuine telemetry streams from physical hardware. If you do not own these devices, use <strong>Mode B (Manual Entry)</strong> to log readings from a standard home cuff or test strips without buying extra equipment.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
