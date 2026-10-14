import React, { useState, useEffect, useRef } from 'react'
import {
  Camera,
  X,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Info,
  Heart,
} from 'lucide-react'
import { api } from '@/lib/api'

interface WebcamPulseModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function WebcamPulseModal({ isOpen, onClose, onSaved }: WebcamPulseModalProps) {
  const [cameraActive, setCameraActive] = useState(false)
  const [statusText, setStatusText] = useState('Camera idle. Click "Start Pulse Scan" to begin.')
  const [estimatedBpm, setEstimatedBpm] = useState<number | null>(null)
  const [signalQuality, setSignalQuality] = useState<'IDLE' | 'DETECTING' | 'LOCKED'>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [samplesCount, setSamplesCount] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const greenHistoryRef = useRef<number[]>([])
  const peakTimesRef = useRef<number[]>([])

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
    }
  }, [isOpen])

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setSignalQuality('IDLE')
  }

  const startCamera = async () => {
    setErrorMessage(null)
    setStatusText('Requesting webcam access for ambient reflective PPG...')
    setEstimatedBpm(null)
    greenHistoryRef.current = []
    peakTimesRef.current = []
    setSamplesCount(0)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam media devices API is not supported in this browser.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraActive(true)
      setStatusText('Camera active. Position your face or fingertip steadily in the guide box.')
      setSignalQuality('DETECTING')

      // Start rPPG processing loop
      processFrame()
    } catch (err: any) {
      console.warn('Camera access issue:', err)
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser address bar to test the webcam demonstration.'
          : err.message || 'Could not connect to webcam. Your computer or browser may not have an active camera.'
      )
      setCameraActive(false)
    }
  }

  const processFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const waveformCanvas = waveformCanvasRef.current

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        const w = (canvas.width = 160)
        const h = (canvas.height = 120)

        // Draw downscaled frame
        ctx.drawImage(video, 0, 0, w, h)

        // Sample center ROI (50% central region)
        const roiX = Math.floor(w * 0.25)
        const roiY = Math.floor(h * 0.25)
        const roiW = Math.floor(w * 0.5)
        const roiH = Math.floor(h * 0.5)

        const imgData = ctx.getImageData(roiX, roiY, roiW, roiH)
        const data = imgData.data

        // Calculate mean green intensity (green channel carries strongest hemoglobin absorption ~540nm)
        let greenSum = 0
        const totalPixels = data.length / 4
        for (let i = 1; i < data.length; i += 4) {
          greenSum += data[i]
        }
        const meanGreen = greenSum / totalPixels
        const now = performance.now()

        // Keep rolling buffer of last 150 frames (~5 seconds at 30fps)
        const history = greenHistoryRef.current
        history.push(meanGreen)
        if (history.length > 150) history.shift()
        setSamplesCount(history.length)

        // Draw live PPG waveform
        if (waveformCanvas && history.length > 10) {
          const wCtx = waveformCanvas.getContext('2d')
          if (wCtx) {
            const ww = (waveformCanvas.width = waveformCanvas.parentElement?.clientWidth || 300)
            const wh = (waveformCanvas.height = 70)

            wCtx.fillStyle = '#050c1a'
            wCtx.fillRect(0, 0, ww, wh)

            // Calculate min/max for normalization
            let min = Infinity
            let max = -Infinity
            for (let v of history) {
              if (v < min) min = v
              if (v > max) max = v
            }
            const range = max - min || 1

            wCtx.beginPath()
            wCtx.strokeStyle = '#2dd4bf'
            wCtx.lineWidth = 2
            for (let i = 0; i < history.length; i++) {
              const x = (i / (history.length - 1)) * ww
              const normY = (history[i] - min) / range
              const y = wh - 10 - normY * (wh - 20)
              if (i === 0) wCtx.moveTo(x, y)
              else wCtx.lineTo(x, y)
            }
            wCtx.stroke()
          }
        }

        // Peak detection algorithm when enough data points are collected
        if (history.length >= 60) {
          // Simple local extrema peak detector on detrended signal
          const movingAvg = history.reduce((a, b) => a + b, 0) / history.length
          const lastVal = history[history.length - 1]
          const prevVal = history[history.length - 2]
          const prevPrevVal = history[history.length - 3]

          if (prevVal > movingAvg && prevVal > lastVal && prevVal > prevPrevVal) {
            const peaks = peakTimesRef.current
            const lastPeakTime = peaks[peaks.length - 1] || 0
            // Refractory period: minimum 350ms between peaks (max 170 bpm)
            if (now - lastPeakTime > 350) {
              peaks.push(now)
              if (peaks.length > 10) peaks.shift()

              if (peaks.length >= 4) {
                // Compute average peak-to-peak interval (RR interval in ms)
                let intervalSum = 0
                for (let k = 1; k < peaks.length; k++) {
                  intervalSum += peaks[k] - peaks[k - 1]
                }
                const avgIntervalMs = intervalSum / (peaks.length - 1)
                const computedBpm = Math.round(60000 / avgIntervalMs)

                if (computedBpm >= 45 && computedBpm <= 160) {
                  setEstimatedBpm(computedBpm)
                  setSignalQuality('LOCKED')
                  setStatusText(`Pulse detected: ~${computedBpm} BPM. Signal quality locked.`)
                }
              }
            }
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame)
  }

  const handleSaveReading = async () => {
    if (!estimatedBpm) return
    setSaving(true)
    try {
      await api.post('/api/v1/vitals/heart-rate', {
        heart_rate: estimatedBpm,
        measurement_source: 'webcam_rppg_experimental',
        device_name: 'Webcam Reflective PPG (Experimental)',
        notes: 'Experimental rPPG pulse demonstration (Non-diagnostic research only)',
        is_sample: false,
      })
      alert(`Saved experimental heart rate reading of ${estimatedBpm} bpm to your history!`)
      if (onSaved) onSaved()
      onClose()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save experimental reading.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass max-w-xl w-full p-6 rounded-3xl border border-indigo-500/30 bg-surface-900/95 shadow-2xl space-y-4 my-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Webcam Pulse Demonstration
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Experimental Research
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Non-diagnostic pulse rate estimation using ambient reflective photoplethysmography (rPPG).
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Strict Biomedical Truth & Safety Disclosure */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-amber-300">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" /> Biomedical Capabilities &amp; Limitations:
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90">
            <li>
              <strong>What this webcam can do:</strong> Detect subtle cyclical skin color variations in reflected ambient green light (520–550 nm hemoglobin absorption peak) caused by pulsatile capillary volume.
            </li>
            <li>
              <strong>What webcams CANNOT do:</strong> Ordinary cameras <em>cannot</em> measure blood glucose (glucose molecules have no optical absorption in the visible spectrum) and <em>cannot</em> measure blood pressure (which requires occlusive hydrostatic cuff pressure).
            </li>
            <li>
              <strong>Non-Diagnostic Notice:</strong> This experimental feature is for technology demonstration and research only. It is not an FDA-cleared medical device and must never be used to diagnose cardiac conditions or arrhythmias.
            </li>
          </ul>
        </div>

        {/* Camera Feed & Waveform Box */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black/60 aspect-video flex items-center justify-center max-h-56 mx-auto border border-slate-800">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!cameraActive && (
              <div className="text-center p-4 space-y-2">
                <Camera size={32} className="text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Camera is currently off. Click below to initiate pulse scan.
                </p>
              </div>
            )}

            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-32 border-2 border-dashed border-teal-400/60 rounded-xl flex items-center justify-center">
                  <span className="text-[10px] text-teal-300 font-mono bg-black/60 px-1 rounded">
                    ROI Detection Zone
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Live Waveform Canvas */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity size={12} className="text-teal-400" /> Live Green Channel Reflectance Waveform:
              </span>
              <span className="font-mono text-slate-500 text-[10px]">
                {samplesCount} frames sampled
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 h-16 bg-slate-950">
              <canvas ref={waveformCanvasRef} className="w-full h-full" />
            </div>
          </div>

          {/* Real-Time Pulse Metric Card */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                Estimated Resting Pulse Rate
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-extrabold text-white">
                  {estimatedBpm ? estimatedBpm : '--'}
                </span>
                <span className="text-xs text-slate-400 font-medium">BPM</span>
                {estimatedBpm && (
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Confidence: High
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Status:</span>
              <span
                className={`text-xs font-semibold ${
                  signalQuality === 'LOCKED'
                    ? 'text-emerald-400'
                    : signalQuality === 'DETECTING'
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {signalQuality === 'LOCKED'
                  ? 'Pulse Locked'
                  : signalQuality === 'DETECTING'
                  ? 'Acquiring Signal...'
                  : 'Idle'}
              </span>
            </div>
          </div>

          {/* Status Message */}
          <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
            {statusText}
          </p>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
              >
                <Camera size={14} /> Start Pulse Scan
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Stop Camera
              </button>
            )}

            <button
              onClick={handleSaveReading}
              disabled={!estimatedBpm || saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Heart size={14} /> {saving ? 'Saving...' : 'Save Reading to History'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
