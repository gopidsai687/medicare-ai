import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Activity,
  AlertTriangle,
  Lightbulb,
  Microscope,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  ShieldAlert,
  Fingerprint,
} from 'lucide-react'

export default function PPGResearch() {
  // Waveform simulator parameters
  const [pulseBpm, setPulseBpm] = useState<number>(72)
  const [arterialStiffness, setArterialStiffness] = useState<number>(50) // affects dicrotic notch depth
  const [vasoTone, setVasoTone] = useState<number>(50) // affects amplitude
  const [isRunning, setIsRunning] = useState<boolean>(true)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const phaseRef = useRef<number>(0)

  // Real-time canvas rendering of physiological PPG optical waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = canvas.parentElement?.clientWidth || 700)
    let height = (canvas.height = 240)

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth
        height = canvas.height = 240
      }
    }
    window.addEventListener('resize', handleResize)

    const render = () => {
      ctx.fillStyle = '#050c1a'
      ctx.fillRect(0, 0, width, height)

      // Draw subtle medical grid lines
      ctx.strokeStyle = 'rgba(49, 130, 244, 0.08)'
      ctx.lineWidth = 1
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Draw PPG physiological wave
      // Composed of: Primary systolic percussion wave + Dicrotic notch + Diastolic reflection
      ctx.beginPath()
      ctx.strokeStyle = '#2dd4bf'
      ctx.lineWidth = 2.5
      ctx.shadowColor = '#14b8a6'
      ctx.shadowBlur = 8

      const points = 250
      const freq = (pulseBpm / 60) * 0.04
      const amp = 45 * (vasoTone / 50)
      const notchDepth = 0.35 * (1 - arterialStiffness / 120)

      for (let i = 0; i < points; i++) {
        const x = (i / points) * width
        const t = (i * 0.12 - phaseRef.current) * freq

        // Multi-component mathematical approximation of cardiac pulse volume
        const tMod = (t % 1 + 1) % 1 // cycle from 0 to 1
        let yNorm = 0

        if (tMod < 0.25) {
          // Rapid systolic ejection
          yNorm = Math.sin((tMod / 0.25) * (Math.PI / 2))
        } else if (tMod < 0.45) {
          // Early systolic relaxation to dicrotic notch
          const subT = (tMod - 0.25) / 0.2
          yNorm = 1 - subT * (1 - notchDepth)
        } else if (tMod < 0.6) {
          // Dicrotic wave reflection (aortic valve closure)
          const subT = (tMod - 0.45) / 0.15
          yNorm = notchDepth + Math.sin(subT * Math.PI) * 0.25
        } else {
          // Diastolic runoff decay
          const subT = (tMod - 0.6) / 0.4
          yNorm = notchDepth * Math.exp(-subT * 2.5)
        }

        const y = height / 2 + 25 - yNorm * amp
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Advance phase if running
      if (isRunning) {
        phaseRef.current += 0.8
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [pulseBpm, arterialStiffness, vasoTone, isRunning])

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-6xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
            <Microscope size={13} /> Optical Physiology Research Lab
          </span>
          <span className="text-xs font-mono text-slate-500">IEEE / ISO Bio-Optical Standards Review</span>
        </div>
        <h1 className="text-3xl font-bold font-display text-white">
          Fingertip Photoplethysmography (PPG) Science
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          An exploratory scientific investigation into optical blood volume sensing, arterial wave physics, and the critical clinical distinctions between pulse detection, blood pressure estimation, and molecular glucose concentration.
        </p>
      </div>

      {/* ── Strict Scientific & Regulatory Notice ────────────────────────── */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
        <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-amber-300">Mandatory Clinical &amp; Device Research Disclaimer</h4>
          <p className="leading-relaxed text-amber-200/90">
            This module is an interactive academic demonstration and scientific literature review. Smartphone camera sensors or generic fingertip optical scanners <strong>DO NOT</strong> physically or accurately measure blood pressure or blood glucose concentration. Unvalidated surrogate estimates must <strong>NEVER</strong> be utilized for medical diagnosis, hypertension treatment, or insulin dosing.
          </p>
        </div>
      </div>

      {/* ── Interactive Optical Waveform Simulator ────────────────────────── */}
      <div className="glass p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Activity size={17} className="text-teal-400" /> Simulated Optical PPG Hemodynamic Waveform
            </h3>
            <span className="text-xs text-slate-400">
              Visualizing pulsatile capillary light attenuation through human dermal microvasculature
            </span>
          </div>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              isRunning
                ? 'bg-slate-800 text-teal-400 border border-teal-500/40 hover:bg-slate-700'
                : 'bg-teal-600 text-white'
            }`}
          >
            {isRunning ? 'Pause Waveform' : 'Resume Waveform'}
          </button>
        </div>

        {/* Canvas Display */}
        <div className="rounded-xl overflow-hidden border border-slate-800/80 mb-5 relative bg-slate-950">
          <canvas ref={canvasRef} className="w-full block" />
          <div className="absolute top-3 left-4 flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" /> Optical Signal: Active
            </span>
            <span>Wavelength: 530nm (Green) / 940nm (NIR)</span>
            <span>AC/DC Ratio: ~1.2%</span>
          </div>

          <div className="absolute bottom-3 right-4 flex items-center gap-3 text-[10px] text-slate-400 bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-800">
            <span className="text-teal-300 font-semibold">1. Systolic Peak</span> →
            <span className="text-amber-300 font-semibold">2. Dicrotic Notch</span> →
            <span className="text-blue-300 font-semibold">3. Diastolic Runoff</span>
          </div>
        </div>

        {/* Interactive Parameter Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex justify-between mb-1.5">
              <label className="font-semibold text-slate-300">Simulated Heart Rate</label>
              <span className="font-mono text-teal-400 font-bold">{pulseBpm} bpm</span>
            </div>
            <input
              type="range"
              min="45"
              max="160"
              value={pulseBpm}
              onChange={(e) => setPulseBpm(Number(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Adjusts cardiac cycle duration (R-R interval)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex justify-between mb-1.5">
              <label className="font-semibold text-slate-300">Arterial Stiffness Index</label>
              <span className="font-mono text-amber-400 font-bold">{arterialStiffness}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={arterialStiffness}
              onChange={(e) => setArterialStiffness(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Blunts dicrotic notch and speeds reflected wave</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800">
            <div className="flex justify-between mb-1.5">
              <label className="font-semibold text-slate-300">Vascular Tone / Pulse Amplitude</label>
              <span className="font-mono text-blue-400 font-bold">{vasoTone}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={vasoTone}
              onChange={(e) => setVasoTone(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Capillary bed vasodilation vs vasoconstriction</span>
          </div>
        </div>
      </div>

      {/* ── 4 Scientific Pillars ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1 */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <Lightbulb size={18} />
          </div>
          <h3 className="font-bold text-white text-base">1. What PPG Actually Measures</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Photoplethysmography (PPG) is an optical measurement of <strong>volumetric changes</strong> in the microvascular bed of tissue. When light shines into a fingertip, a photodiode measures reflected or transmitted light intensity.
          </p>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div>
              <strong className="text-slate-200">DC Component:</strong> Quasi-static light absorption from skin, bone, muscle, and non-pulsatile venous blood.
            </div>
            <div>
              <strong className="text-slate-200">AC Component:</strong> Rhythmic fluctuation caused by arterial blood pulsation arriving with each ventricular contraction.
            </div>
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Activity size={18} />
          </div>
          <h3 className="font-bold text-white text-base">2. Pulse vs. Blood Pressure: Why They Differ</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Measuring pulse rate with optical sensors is a solved engineering problem: algorithms merely detect the periodic timing between systolic peaks (R-R interval).
          </p>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div>
              <strong className="text-slate-200">Blood Pressure Complexity:</strong> Blood pressure is the lateral hydrostatic force exerted on vessel walls. It depends on stroke volume, systemic vascular resistance, and arterial compliance (Moens-Korteweg equation).
            </div>
            <div>
              <strong className="text-slate-200">Hydrodynamic Drift:</strong> Ambient temperature, finger pressure on the sensor, autonomic nervous state, and cuff calibration cause optical BP estimates to drift significantly without physical reference cuffs.
            </div>
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
            <XCircle size={18} />
          </div>
          <h3 className="font-bold text-white text-base">3. Why Optical Glucose is a Radically Different Challenge</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unlike hemoglobin, which has distinct peak absorption in green and red spectra (responsible for pulse and SpO2), glucose does not possess distinct visible light absorption bands.
          </p>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div>
              <strong className="text-slate-200">Extreme Low Concentration:</strong> Normal blood glucose (100 mg/dL) represents just <strong>0.1%</strong> of total blood volume, compared to 15% hemoglobin and 70% water.
            </div>
            <div>
              <strong className="text-slate-200">Spectral Overlap:</strong> Water, lipids, and albumin create massive near-infrared absorbance bands that dwarf tiny glucose spectral shifts by multiple orders of magnitude.
            </div>
          </div>
        </div>

        {/* Pillar 4 */}
        <div className="glass p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <Layers size={18} />
          </div>
          <h3 className="font-bold text-white text-base">4. Requirements for Future Bio-Optical Clinical Research</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            If non-invasive optical hemodynamics is to achieve medical credibility, researchers must adhere to formal clinical protocols rather than consumer mobile approximations.
          </p>
          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1.5 text-slate-400">
            <div>
              <strong className="text-slate-200">ISO 81060-2 &amp; IEEE 1708:</strong> Non-invasive sphygmomanometer trials requiring simultaneous double-blinded auscultatory comparison across diverse populations.
            </div>
            <div>
              <strong className="text-slate-200">Multi-Spectral Sensing:</strong> Multi-wavelength spectrophotometers (450nm to 1300nm) combined with contact pressure transducers to normalize tissue compression.
            </div>
          </div>
        </div>
      </div>

      {/* ── Clarke Error Grid / Clinical Safety Callout ─────────────────── */}
      <div className="glass p-6 rounded-2xl border border-slate-800 bg-slate-900/40">
        <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
          <ShieldAlert size={18} className="text-rose-400" />
          The Clinical Hazard of Unvalidated Surrogate Estimations
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          In clinical medicine, diagnostic tools are evaluated using Clarke Error Grids and Consensus Error Grids. An inaccurate reading can result in catastrophic clinical outcomes:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
            <h5 className="font-bold mb-1">Zone C, D, &amp; E Errors</h5>
            <p className="text-rose-200/80">
              An optical algorithm falsely estimating 140 mg/dL when true capillary glucose is 45 mg/dL prevents life-saving carbohydrate intake during severe hypoglycemia.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
            <h5 className="font-bold mb-1">Masked Hypertensive Emergencies</h5>
            <p className="text-amber-200/80">
              A drifting camera estimate showing 125/80 mmHg while actual arterial pressure is 195/115 mmHg delays acute medical evaluation for intracranial hemorrhage or aortic dissection.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
            <h5 className="font-bold mb-1">MediCare Architecture Commitment</h5>
            <p className="text-blue-200/80">
              MediCare AI accepts readings exclusively from verified physical cuffs, calibrated meters, or validated BLE integrations. We never fabricate vital signs from fingerprint photos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
