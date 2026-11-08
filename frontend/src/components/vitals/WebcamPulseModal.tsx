import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  Eye,
  UserCheck,
  Timer,
  Zap,
} from 'lucide-react'
import { api } from '@/lib/api'
import {
  BoundingBox,
  FaceValidationResult,
  LightingAssessment,
  RPPGAcquisitionState,
  assessFaceAndLighting,
  extractMeanGreen,
  preprocessRPPGSignal,
  calculateCardiacSNR,
  estimatePulse,
  renderRPPGWaveform,
} from '@/utils/rppgAlgorithm'

// Re-export for any consumers
export type { BoundingBox, RPPGAcquisitionState }
export type AcquisitionState = RPPGAcquisitionState

interface WebcamPulseModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function WebcamPulseModal({ isOpen, onClose, onSaved }: WebcamPulseModalProps) {
  const [acquisitionState, setAcquisitionState] = useState<RPPGAcquisitionState>('IDLE')
  const [cameraActive, setCameraActive] = useState(false)
  const [statusText, setStatusText] = useState('Camera idle. Click "Start Pulse Scan" to begin.')
  const [qualityWarning, setQualityWarning] = useState<string | null>(null)
  const [estimatedBpm, setEstimatedBpm] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [snr, setSnr] = useState<number>(0)
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [samplesCount, setSamplesCount] = useState<number>(0)
  const [acquisitionDuration, setAcquisitionDuration] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [foreheadLocked, setForeheadLocked] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const lastGreenRef = useRef<number | null>(null)
  const motionCounterRef = useRef<number>(0)

  const rawGreenHistoryRef = useRef<number[]>([])
  const filteredHistoryRef = useRef<number[]>([])
  const faceBoxRef = useRef<BoundingBox>({ x: 40, y: 20, width: 80, height: 80 })
  const foreheadRoiRef = useRef<BoundingBox>({ x: 60, y: 30, width: 40, height: 16 })
  const stateRef = useRef<RPPGAcquisitionState>('IDLE')

  // Keep stateRef synced for frame callback
  useEffect(() => {
    stateRef.current = acquisitionState
  }, [acquisitionState])

  // Lifecycle & Camera Cleanup
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          /* ignore */
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    rawGreenHistoryRef.current = []
    filteredHistoryRef.current = []
    lastGreenRef.current = null
    motionCounterRef.current = 0

    setCameraActive(false)
    setAcquisitionState('IDLE')
    setFaceDetected(false)
    setForeheadLocked(false)
    setQualityWarning(null)
    setProgressPercent(0)
    setAcquisitionDuration(0)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, stopCamera])

  // Start Camera Acquisition Pipeline
  const startCamera = async () => {
    stopCamera()
    setEstimatedBpm(null)
    setConfidence(0)
    setSnr(0)
    setQualityWarning(null)
    setProgressPercent(0)
    setSamplesCount(0)
    setAcquisitionDuration(0)
    setAcquisitionState('INITIALIZING_CAMERA')
    setStatusText('Requesting webcam access for ambient reflective PPG...')

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
      setAcquisitionState('DETECTING_FACE')
      setStatusText('Camera active. Center your face within the guide box.')
      startTimeRef.current = performance.now()

      // Set 25-second acquisition timeout guard
      timeoutRef.current = setTimeout(() => {
        if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
          setAcquisitionState('ACQUISITION_TIMEOUT')
          setStatusText(
            'Unable to obtain a reliable pulse estimate. Please reposition and try again.'
          )
          setQualityWarning(
            'Acquisition timeout: stable optical signal could not be locked. Please face a well-lit area, avoid direct sunlight behind you, and remain still.'
          )
        }
      }, 25000)

      lastFrameTimeRef.current = performance.now()
      processFrame(performance.now())
    } catch (err: any) {
      console.warn('Webcam initiation issue:', err)
      setAcquisitionState('CAMERA_UNAVAILABLE')
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser address bar.'
          : err.message || 'Could not connect to webcam. Your computer or browser may not have an active camera.'
      setStatusText(msg)
      setQualityWarning(msg)
      setCameraActive(false)
    }
  }

  // Continuous Frame Processing Loop (~30 fps controlled)
  const processFrame = (timestamp: number) => {
    // If modal closed or camera stopped, terminate loop immediately
    if (!streamRef.current) return

    // Throttle frame processing to ~30 fps (skip frames arriving faster than 28ms)
    const elapsed = timestamp - lastFrameTimeRef.current
    if (elapsed < 28) {
      animFrameRef.current = requestAnimationFrame(processFrame)
      return
    }
    lastFrameTimeRef.current = timestamp

    const video = videoRef.current
    const canvas = canvasRef.current
    const waveformCanvas = waveformCanvasRef.current

    if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA) {
      const w = 160
      const h = 120
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h)

        // 1. Comprehensive Face, Forehead ROI & Ambient Lighting Validation
        const assessment: FaceValidationResult = assessFaceAndLighting(ctx, w, h)
        setFaceDetected(assessment.detected)
        setForeheadLocked(assessment.isForeheadValid)

        if (startTimeRef.current > 0) {
          const currentDur = Math.round((timestamp - startTimeRef.current) / 100) / 10
          setAcquisitionDuration(currentDur)
        }

        // 2. Lighting & Backlighting Quality Gating
        if (assessment.lighting.isBacklit) {
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
            const prompt =
              'Please face a well-lit area, avoid direct sunlight behind you, and remain still during measurement.'
            setQualityWarning(prompt)
            setStatusText(prompt)
          }
        } else if (assessment.lighting.isDim) {
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
            setQualityWarning(
              'Lighting is too dim. Please illuminate your face with a steady frontal light.'
            )
            setStatusText('Lighting is too dim for optical plethysmography.')
          }
        } else if (assessment.lighting.isOverexposed) {
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
            setQualityWarning(
              'Lighting glare or overexposure detected. Please soften or diffuse direct light on your forehead.'
            )
            setStatusText('Overexposure or optical glare detected.')
          }
        } else if (!assessment.isForeheadValid) {
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
            setQualityWarning(
              'Forehead region is obscured or shadowed. Please clear hair or obstructions from your forehead.'
            )
            setStatusText('Forehead capillary bed obscured. Align forehead in detection area.')
          }
        } else if (!assessment.isCentered) {
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('DETECTING_FACE')
            setQualityWarning(
              'Face is off-center. Please position your head directly in the center of the frame.'
            )
            setStatusText('Position your face in the center guide box.')
          }
        } else if (assessment.detected) {
          // Face and forehead verified!
          // Smooth forehead ROI coordinates
          const prevBox = faceBoxRef.current
          faceBoxRef.current = {
            x: Math.round(prevBox.x * 0.75 + assessment.faceBox.x * 0.25),
            y: Math.round(prevBox.y * 0.75 + assessment.faceBox.y * 0.25),
            width: Math.round(prevBox.width * 0.75 + assessment.faceBox.width * 0.25),
            height: Math.round(prevBox.height * 0.75 + assessment.faceBox.height * 0.25),
          }
          foreheadRoiRef.current = assessment.foreheadRoi

          // 3. Optical Green Channel Extraction
          const extraction = extractMeanGreen(ctx, foreheadRoiRef.current)

          if (!extraction.isValid) {
            if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
              setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
              setQualityWarning('Luminance unstable. Maintain steady ambient illumination.')
            }
          } else {
            // Sudden Motion / Artifact Check (Green channel delta)
            const prevGreen = lastGreenRef.current
            lastGreenRef.current = extraction.meanGreen

            let isMotion = false
            if (prevGreen !== null) {
              const diff = Math.abs(extraction.meanGreen - prevGreen)
              // Threshold 2.8 suppresses sudden jumps from head jerks or auto-gain shifts
              if (diff > 2.8) {
                isMotion = true
                motionCounterRef.current++
              } else {
                motionCounterRef.current = Math.max(0, motionCounterRef.current - 1)
              }
            }

            if (isMotion || motionCounterRef.current > 2) {
              if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
                setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
                setQualityWarning(
                  'Motion artifact detected. Please keep head and shoulders completely still.'
                )
              }
            } else {
              // Valid Clean Frame!
              setQualityWarning(null)

              if (
                stateRef.current === 'DETECTING_FACE' ||
                stateRef.current === 'INSUFFICIENT_SIGNAL_QUALITY'
              ) {
                setAcquisitionState('ACQUIRING_SIGNAL')
                setStatusText('Acquiring optical pulse signal... Please remain steady.')
              }

              // Append to signal buffer (maintain rolling 240 samples ~ 8 seconds at 30fps)
              const rawHistory = rawGreenHistoryRef.current
              rawHistory.push(extraction.meanGreen)
              if (rawHistory.length > 240) rawHistory.shift()
              setSamplesCount(rawHistory.length)

              // Preprocess with MAD outlier filtering, zero-mean detrending, and binomial smoothing
              const filtered = preprocessRPPGSignal(rawHistory)
              filteredHistoryRef.current = filtered

              // Signal Quality Acceptable state trigger once sufficient buffer accumulated
              if (rawHistory.length >= 100 && stateRef.current === 'ACQUIRING_SIGNAL') {
                setAcquisitionState('SIGNAL_QUALITY_ACCEPTABLE')
                setStatusText('Signal quality acceptable. Capturing arterial reflectance...')
              }

              // Update progress bar towards required target (240 samples ~ 8.0s)
              const prog = Math.min(100, Math.round((rawHistory.length / 240) * 100))
              setProgressPercent(prog)

              // Render live waveform canvas
              if (waveformCanvas) {
                if (waveformCanvas.width !== (waveformCanvas.parentElement?.clientWidth || 300)) {
                  waveformCanvas.width = waveformCanvas.parentElement?.clientWidth || 300
                  waveformCanvas.height = 70
                }
                renderRPPGWaveform(
                  waveformCanvas,
                  filtered,
                  stateRef.current === 'EXPERIMENTAL_ESTIMATE_AVAILABLE'
                )
              }

              // 4. Physiological Pulse Estimation Check (Requires at least 210 frames ~ 7s)
              if (rawHistory.length >= 210) {
                if (stateRef.current === 'SIGNAL_QUALITY_ACCEPTABLE') {
                  setAcquisitionState('PROCESSING_MEASUREMENT')
                  setStatusText('Processing measurement... Evaluating arterial pulse rhythm.')
                }

                const result = estimatePulse(filtered, 30)
                setConfidence(result.confidence)
                setSnr(result.snr)

                if (result.isLocked && result.bpm) {
                  setEstimatedBpm(result.bpm)
                  setAcquisitionState('EXPERIMENTAL_ESTIMATE_AVAILABLE')
                  setStatusText(
                    `Experimental estimate available: ${result.bpm} BPM (Confidence: ${Math.round(
                      result.confidence * 100
                    )}%, SNR: ${result.snr} dB). Non-diagnostic research tool.`
                  )
                  // Clear timeout guard since measurement completed successfully
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current)
                    timeoutRef.current = null
                  }
                } else if (rawHistory.length >= 240) {
                  // Buffer reached max without a physiologically locked reading: reject measurement cleanly
                  if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
                    setAcquisitionState('INSUFFICIENT_SIGNAL_QUALITY')
                    setStatusText(
                      'Unable to obtain a reliable pulse estimate. Please reposition and try again.'
                    )
                    setQualityWarning(
                      result.reason ||
                        'Unable to obtain a reliable pulse estimate. Please reposition and try again.'
                    )
                  }
                }
              }
            }
          }
        } else {
          // Face lost from detection zone
          if (stateRef.current !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') {
            setAcquisitionState('DETECTING_FACE')
            setQualityWarning('Face not clearly visible. Please align your face inside the guide box.')
            setStatusText('Detecting face... Please align your face inside the oval guide box.')
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame)
  }

  // Save Reading to Health Telemetry
  const handleSaveReading = async () => {
    if (!estimatedBpm || acquisitionState !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE') return
    setSaving(true)
    try {
      await api.post('/api/v1/vitals/heart-rate', {
        heart_rate: estimatedBpm,
        measurement_source: 'webcam_rppg_experimental',
        device_name: 'Webcam Reflective PPG (Experimental)',
        notes: `Experimental rPPG pulse demonstration (Estimate: ${estimatedBpm} BPM, Confidence: ${Math.round(
          confidence * 100
        )}%, SNR: ${snr} dB, Duration: ${acquisitionDuration}s, Non-diagnostic research only)`,
        is_sample: false,
      })
      alert(`Saved experimental heart rate reading of ${estimatedBpm} BPM to your VitalSense history!`)
      if (onSaved) onSaved()
      onClose()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save experimental reading.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  // State Badge Presentation
  const getStateBadge = () => {
    switch (acquisitionState) {
      case 'INITIALIZING_CAMERA':
        return {
          label: 'Initializing camera...',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        }
      case 'DETECTING_FACE':
        return {
          label: 'Detecting face...',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        }
      case 'ACQUIRING_SIGNAL':
        return {
          label: `Acquiring signal (${progressPercent}%)`,
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        }
      case 'SIGNAL_QUALITY_ACCEPTABLE':
        return {
          label: 'Signal quality acceptable',
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        }
      case 'INSUFFICIENT_SIGNAL_QUALITY':
        return {
          label: 'Insufficient signal quality',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        }
      case 'PROCESSING_MEASUREMENT':
        return {
          label: 'Measurement processing...',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        }
      case 'EXPERIMENTAL_ESTIMATE_AVAILABLE':
        return {
          label: 'Experimental estimate available',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        }
      case 'ACQUISITION_TIMEOUT':
        return {
          label: 'Acquisition timeout',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        }
      case 'CAMERA_UNAVAILABLE':
        return {
          label: 'Camera unavailable',
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        }
      default:
        return {
          label: 'Idle',
          color: 'bg-slate-700 text-slate-400 border-slate-600',
        }
    }
  }

  const badge = getStateBadge()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="glass max-w-xl w-full p-6 rounded-3xl border border-indigo-500/30 bg-surface-900/95 shadow-2xl space-y-4 my-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Experimental Camera-Based Pulse Estimation
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  VitalSense™ Experimental
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Non-diagnostic resting pulse rate estimation using ambient reflective photoplethysmography (rPPG).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Biomedical Truth & Safety Disclosure */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-amber-300">
            <ShieldAlert size={14} className="text-amber-400 shrink-0" /> Biomedical Capabilities &amp; Limitations:
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/90">
            <li>
              <strong>What this webcam can do:</strong> Detect subtle cyclical skin reflectance variations in ambient green light (520–550 nm hemoglobin absorption peak) caused by pulsatile capillary volume.
            </li>
            <li>
              <strong>What webcams CANNOT do:</strong> Ordinary cameras <em>cannot</em> measure blood glucose (glucose molecules lack optical absorption in visible wavelengths) and <em>cannot</em> measure blood pressure (which requires occlusive hydrostatic cuff pressure).
            </li>
            <li>
              <strong>Non-Diagnostic Research Notice:</strong> This technology demonstration is experimental and non-diagnostic. It is not an FDA-cleared medical device and must never be used to diagnose cardiac conditions or arrhythmias.
            </li>
          </ul>
        </div>

        {/* Camera Feed & Forehead ROI Box */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center max-h-56 mx-auto border border-slate-800">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!cameraActive && (
              <div className="text-center p-4 space-y-2">
                <Camera size={36} className="text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Camera is currently off. Click below to begin experimental pulse scan.
                </p>
              </div>
            )}

            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Face Guide Oval */}
                <div
                  className={`w-44 h-52 border-2 border-dashed rounded-[45%] flex flex-col items-center justify-between p-3 transition-colors ${
                    faceDetected && foreheadLocked
                      ? 'border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : faceDetected
                      ? 'border-amber-400/70'
                      : 'border-sky-400/50'
                  }`}
                >
                  {/* Dynamic Forehead ROI Box Indicator */}
                  <div
                    className={`px-2.5 py-1 rounded border text-[9px] font-mono tracking-wider transition-all ${
                      foreheadLocked
                        ? 'border-emerald-400 bg-emerald-950/80 text-emerald-300 font-bold'
                        : faceDetected
                        ? 'border-amber-400 bg-amber-950/80 text-amber-300'
                        : 'border-slate-500 bg-black/60 text-slate-400'
                    }`}
                  >
                    {foreheadLocked
                      ? '● FOREHEAD ROI TRACKED'
                      : faceDetected
                      ? 'FOREHEAD OBSCURED'
                      : 'ALIGN FOREHEAD HERE'}
                  </div>

                  <span className="text-[10px] text-slate-300 font-medium bg-black/70 px-2 py-0.5 rounded-full">
                    {faceDetected && foreheadLocked
                      ? 'ROI Locked'
                      : faceDetected
                      ? 'Adjust Head Position'
                      : 'Position Face in Center'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar (during signal acquisition) */}
          {cameraActive && acquisitionState !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE' && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Signal Acquisition Buffer</span>
                <span>
                  {progressPercent}% Complete ({samplesCount}/240 frames · {acquisitionDuration}s)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-400 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Live Waveform Canvas */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <Activity size={13} className="text-teal-400" />
                Live Green-Channel Reflectance Waveform (Detrended &amp; Bandpassed):
              </span>
              <span className="font-mono text-slate-500 text-[10px]">
                {samplesCount} frames · {acquisitionDuration}s
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 h-16 bg-slate-950">
              <canvas ref={waveformCanvasRef} className="w-full h-full" />
            </div>
          </div>

          {/* Real-Time Pulse Metric Card */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                Estimated Resting Pulse Rate
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-extrabold text-white">
                  {acquisitionState === 'EXPERIMENTAL_ESTIMATE_AVAILABLE' && estimatedBpm !== null
                    ? estimatedBpm
                    : '--'}
                </span>
                <span className="text-xs text-slate-400 font-medium">BPM</span>
                {acquisitionState === 'EXPERIMENTAL_ESTIMATE_AVAILABLE' && (
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Confidence: {Math.round(confidence * 100)}% (SNR: {snr} dB)
                  </span>
                )}
                {acquisitionState === 'INSUFFICIENT_SIGNAL_QUALITY' && (
                  <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle size={11} /> Signal Quality Insufficient
                  </span>
                )}
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-400 block font-medium">State:</span>
              <span
                className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.color}`}
              >
                {badge.label}
              </span>
            </div>
          </div>

          {/* Status and Actionable Instructions */}
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-300 leading-relaxed font-mono flex items-center gap-1.5">
              <Info size={12} className="text-indigo-400 shrink-0" />
              {statusText}
            </p>

            {qualityWarning && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2 animate-fade-in">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-snug">{qualityWarning}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer transition-colors"
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
            ) : acquisitionState === 'EXPERIMENTAL_ESTIMATE_AVAILABLE' ||
              acquisitionState === 'ACQUISITION_TIMEOUT' ||
              acquisitionState === 'INSUFFICIENT_SIGNAL_QUALITY' ? (
              <button
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={14} /> Restart Scan
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer transition-colors"
              >
                Stop Camera
              </button>
            )}

            <button
              onClick={handleSaveReading}
              disabled={
                acquisitionState !== 'EXPERIMENTAL_ESTIMATE_AVAILABLE' ||
                !estimatedBpm ||
                saving
              }
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
