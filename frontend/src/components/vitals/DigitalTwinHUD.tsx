import React, { useState } from 'react'
import {
  Activity,
  Heart,
  Droplets,
  Wind,
  ShieldCheck,
  Cpu,
  Layers,
  Dna,
  Eye,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

interface DigitalTwinHUDProps {
  patientName?: string
  patientId?: string
}

export function DigitalTwinHUD({ patientName = 'Alice Johnson', patientId = '8842-M' }: DigitalTwinHUDProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'anatomy' | 'neurology' | 'genomics' | 'imaging'>('overview')
  const [layers, setLayers] = useState({
    surface: true,
    skeleton: true,
    organs: true,
    landmarks: true,
  })

  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-[#040914] text-cyan-300 p-4 md:p-6 shadow-2xl font-mono space-y-5 overflow-hidden">
      {/* Top Multimodal Platform Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-cyan-400/80 uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected Health // Multimodal Platform
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-wider text-white font-sans flex items-center gap-2.5 mt-0.5">
            <span className="text-cyan-400">+</span> FULL BODY DIAGNOSTICS
          </h2>
          <p className="text-[10px] tracking-widest text-cyan-500/70 uppercase">
            Imaging // Physiology // Genomics // Digital Anatomy
          </p>
        </div>

        {/* Diagnostic Meta telemetry */}
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <span className="text-slate-400 text-[10px] block">SUBJECT / DEMO</span>
            <span className="text-white font-bold">{patientName} ({patientId})</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <span className="text-slate-400 text-[10px] block">SECURE SESSION</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> REAL-TIME 12 SENSORS
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-400/40 text-cyan-300">
            <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin flex items-center justify-center text-[10px] font-bold">
              100
            </div>
            <div>
              <span className="text-white font-bold block text-xs">SYSTEM ONLINE</span>
              <span className="text-[9px] text-cyan-500">BIO-CORE V.94</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {[
          { id: 'overview', label: '01 OVERVIEW' },
          { id: 'anatomy', label: '02 ANATOMY' },
          { id: 'neurology', label: '03 NEUROLOGY' },
          { id: 'genomics', label: '04 GENOMICS' },
          { id: 'imaging', label: '05 IMAGING' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold tracking-wider transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'bg-slate-900/40 text-slate-400 border-cyan-950 hover:border-cyan-800'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto text-[11px] text-cyan-400 hidden sm:flex items-center gap-2 font-mono">
          <span>ACQUISITION:</span>
          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden border border-cyan-500/30">
            <div className="w-full h-full bg-cyan-400" />
          </div>
          <span className="text-emerald-400 font-bold">COMPLETE 12/12</span>
        </div>
      </div>

      {/* 3-Column Cockpit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Live Physiology + Magnetic Resonance + Thoracic Imaging (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-4">
          {/* 01 Live Physiology Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Activity size={14} className="text-cyan-400" />
                01 LIVE PHYSIOLOGY
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ACTIVE
              </span>
            </div>

            {/* Metric grid */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block">HEART RATE</span>
                <span className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-1 font-sans">
                  <Heart size={14} className="text-rose-400 animate-pulse" /> 72
                </span>
                <span className="text-[9px] text-cyan-400">BPM</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block">OXYGENATION</span>
                <span className="text-lg font-bold text-cyan-300 font-sans">98%</span>
                <span className="text-[9px] text-cyan-400">SpO2</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block">RESPIRATION</span>
                <span className="text-lg font-bold text-cyan-300 font-sans">16</span>
                <span className="text-[9px] text-cyan-400">/MIN</span>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <span className="text-[9px] text-slate-400 block">CORE TEMP</span>
                <span className="text-lg font-bold text-cyan-300 font-sans">36.7</span>
                <span className="text-[9px] text-cyan-400">°C</span>
              </div>
            </div>

            {/* Continuous ECG Trace Waveform */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px] text-slate-400">
                <span>ECG / LEAD II</span>
                <span className="text-emerald-400">SIGNAL LOCKED</span>
              </div>
              <div className="w-full h-12 bg-black rounded border border-cyan-500/30 p-1 relative overflow-hidden flex items-center">
                <svg viewBox="0 0 200 40" className="w-full h-full stroke-emerald-400 fill-none" preserveAspectRatio="none">
                  <path
                    d="M 0 20 L 25 20 L 30 18 L 35 20 L 45 20 L 48 24 L 52 3 L 57 36 L 61 17 L 65 20 L 80 20 L 85 15 L 95 20 L 125 20 L 130 18 L 135 20 L 145 20 L 148 24 L 152 3 L 157 36 L 161 17 L 165 20 L 180 20 L 185 15 L 200 20"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* 03 Magnetic Resonance Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-1.5">
              <span className="font-bold text-white">03 MAGNETIC RESONANCE</span>
              <span className="text-[9px] text-cyan-400">MRI / 3-AXIS</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="aspect-square bg-slate-900 rounded border border-cyan-500/30 p-1 flex flex-col items-center justify-center">
                <svg viewBox="0 0 60 60" className="w-12 h-12 stroke-cyan-400 fill-cyan-950/40">
                  <ellipse cx="30" cy="30" rx="22" ry="26" strokeWidth="1" />
                  <path d="M 22 18 C 22 28, 38 28, 38 18 M 20 30 C 25 35, 35 35, 40 30 M 26 42 Q 30 45 34 42" strokeWidth="0.8" fill="none" />
                </svg>
                <span className="text-[8px] text-slate-400 mt-1">AXIAL RECON</span>
              </div>
              <div className="aspect-square bg-slate-900 rounded border border-cyan-500/30 p-1 flex flex-col items-center justify-center">
                <svg viewBox="0 0 60 60" className="w-12 h-12 stroke-cyan-400 fill-cyan-950/40">
                  <path d="M 18 30 C 18 16, 42 16, 42 30 C 42 42, 30 48, 24 40 Z" strokeWidth="1" />
                  <ellipse cx="30" cy="28" rx="8" ry="6" strokeWidth="0.7" fill="none" />
                </svg>
                <span className="text-[8px] text-slate-400 mt-1">SAGITTAL SLICE</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[8px] text-slate-400 pt-1">
              <span>SCAN CODE: T1-WEIGHTED</span>
              <span className="text-emerald-400 font-bold">512 x 512 RECON</span>
            </div>
          </div>

          {/* 04 Thoracic Imaging Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-1.5">
              <span className="font-bold text-white">04 THORACIC IMAGING</span>
              <span className="text-[9px] text-cyan-400">RADIOGRAPHIC</span>
            </div>
            <div className="h-24 bg-slate-900 rounded border border-cyan-500/30 flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-20 h-20 stroke-cyan-400/80 fill-none">
                {/* Rib cage overlay */}
                <line x1="50" y1="10" x2="50" y2="70" strokeWidth="1.5" stroke="#38bdf8" />
                <path d="M 30 20 Q 50 15 70 20 M 24 30 Q 50 25 76 30 M 20 42 Q 50 36 80 42 M 22 54 Q 50 48 78 54 M 28 64 Q 50 58 72 64" strokeWidth="1" />
                {/* Lungs outline */}
                <ellipse cx="34" cy="40" rx="10" ry="16" stroke="rgba(45,212,191,0.5)" strokeWidth="0.8" />
                <ellipse cx="66" cy="40" rx="10" ry="16" stroke="rgba(45,212,191,0.5)" strokeWidth="0.8" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[8px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> RIB CAGE
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> LUNG FIELDS
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> SPINAL AXIS
              </span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Human Digital Twin Wireframe Model (6 cols on lg) */}
        <div className="lg:col-span-6 rounded-xl border border-cyan-500/30 bg-slate-950/90 p-4 relative shadow-2xl flex flex-col items-center justify-between min-h-[580px]">
          {/* Header row */}
          <div className="w-full flex items-center justify-between text-xs pb-2 border-b border-cyan-500/20">
            <div>
              <span className="font-bold text-white block">02 HUMAN DIGITAL TWIN</span>
              <span className="text-[9px] text-cyan-400/80">MULTIPLAYER VOLUME / ANTERIOR PROJECTION</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[10px] tracking-widest font-bold">
              ACTIVE SCAN
            </span>
          </div>

          {/* Central 3D Wireframe Silhouette SVG */}
          <div className="relative w-full max-w-[340px] h-[440px] flex items-center justify-center my-2">
            <svg viewBox="0 0 340 440" className="w-full h-full drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <defs>
                <linearGradient id="hudGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="50%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>

              {/* Holographic Concentric Rings around Head / Torso / Pedestal */}
              <ellipse cx="170" cy="50" rx="55" ry="12" fill="none" stroke="rgba(6,182,212,0.25)" strokeWidth="1" strokeDasharray="3 3" />
              <ellipse cx="170" cy="180" rx="90" ry="20" fill="none" stroke="rgba(6,182,212,0.35)" strokeWidth="1.2" strokeDasharray="4 2" />
              <ellipse cx="170" cy="270" rx="70" ry="16" fill="none" stroke="rgba(6,182,212,0.25)" strokeWidth="1" strokeDasharray="2 3" />

              {/* Pedestal at bottom */}
              <ellipse cx="170" cy="405" rx="100" ry="22" fill="rgba(6,182,212,0.06)" stroke="rgba(6,182,212,0.4)" strokeWidth="1.5" />
              <ellipse cx="170" cy="405" rx="70" ry="14" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1" strokeDasharray="4 4" />
              <ellipse cx="170" cy="405" rx="35" ry="7" fill="none" stroke="rgba(6,182,212,0.5)" strokeWidth="1" />

              {/* Wireframe Body Structure */}
              {/* Head & Cranium */}
              <ellipse cx="170" cy="52" rx="22" ry="28" fill="rgba(15,23,42,0.7)" stroke="#22d3ee" strokeWidth="1.5" />
              <circle cx="170" cy="45" r="4" fill="#06b6d4" />

              {/* Cervical & Spinal Column */}
              <line x1="170" y1="80" x2="170" y2="245" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 2" />

              {/* Rib cage contour */}
              <path
                d="M 130 105 Q 170 100 210 105 L 218 175 Q 170 185 122 175 Z"
                fill="rgba(15,23,42,0.5)"
                stroke="#06b6d4"
                strokeWidth="1.5"
              />

              {/* Pelvis & Hips */}
              <path
                d="M 134 235 L 206 235 L 200 270 L 140 270 Z"
                fill="rgba(15,23,42,0.6)"
                stroke="#06b6d4"
                strokeWidth="1.5"
              />

              {/* Arms */}
              <path
                d="M 126 110 L 96 175 L 82 250"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 214 110 L 244 175 L 258 250"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Legs */}
              <path
                d="M 150 270 L 142 340 L 136 395"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M 190 270 L 198 340 L 204 395"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Nodal Callout Markers & Connectors */}
              {/* Neural Map */}
              <line x1="170" y1="52" x2="250" y2="70" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="170" cy="52" r="3" fill="#22d3ee" />
              <text x="255" y="73" fill="#22d3ee" fontSize="8" fontFamily="monospace">01/NEURAL MAP</text>

              {/* Respiratory */}
              <line x1="145" y1="135" x2="65" y2="150" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="145" cy="135" r="3" fill="#22d3ee" />
              <text x="15" y="153" fill="#22d3ee" fontSize="8" fontFamily="monospace">02/RESPIRATORY</text>

              {/* Cardiac Model */}
              <line x1="180" y1="142" x2="255" y2="155" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="180" cy="142" r="3.5" fill="#f43f5e" />
              <text x="260" y="158" fill="#fda4af" fontSize="8" fontFamily="monospace">03/CARDIAC MODEL</text>

              {/* Spinal Axis */}
              <line x1="170" y1="210" x2="70" y2="230" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="170" cy="210" r="3" fill="#22d3ee" />
              <text x="20" y="233" fill="#22d3ee" fontSize="8" fontFamily="monospace">04/SPINAL AXIS</text>

              {/* Organ Atlas */}
              <line x1="170" y1="250" x2="250" y2="280" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="170" cy="250" r="3" fill="#22d3ee" />
              <text x="255" y="283" fill="#22d3ee" fontSize="8" fontFamily="monospace">05/ORGAN ATLAS</text>

              {/* Joint Tracking */}
              <line x1="198" y1="340" x2="250" y2="345" stroke="#06b6d4" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="198" cy="340" r="3" fill="#22d3ee" />
              <text x="255" y="348" fill="#22d3ee" fontSize="8" fontFamily="monospace">06/JOINT TRACKING</text>
            </svg>
          </div>

          {/* Layer Controls Bar */}
          <div className="w-full pt-3 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 uppercase">Layers:</span>
              {(['surface', 'skeleton', 'organs', 'landmarks'] as const).map((layer) => (
                <label key={layer} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers[layer]}
                    onChange={() => toggleLayer(layer)}
                    className="w-3 h-3 rounded bg-slate-900 border-cyan-500/40 text-cyan-500"
                  />
                  <span className="capitalize text-slate-300">{layer}</span>
                </label>
              ))}
            </div>
            <span className="text-cyan-400 font-bold">VOLUMETRIC RECON // 100%</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Neural Reconstruction + Genomic Sequence + Screening Overview (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-4">
          {/* 05 Neural Reconstruction Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-1.5">
              <span className="font-bold text-white">05 NEURAL RECON</span>
              <span className="text-[9px] text-cyan-400">3D CORTEX</span>
            </div>
            <div className="aspect-[4/3] bg-slate-900 rounded border border-cyan-500/30 p-2 flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 100 80" className="w-24 h-20 stroke-cyan-400 fill-cyan-950/40">
                {/* 3D Brain model outline */}
                <path
                  d="M 25 45 C 20 30, 35 15, 55 18 C 75 15, 88 30, 82 48 C 78 62, 60 68, 50 65 C 38 68, 25 58, 25 45 Z"
                  strokeWidth="1.2"
                />
                {/* Gyri & sulci wrinkles */}
                <path d="M 32 30 Q 45 35 48 24 M 40 42 Q 52 46 62 36 M 52 48 Q 62 55 72 45 M 60 25 Q 70 30 75 40" strokeWidth="0.8" fill="none" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[8px] text-slate-400">
              <span className="text-cyan-300">CORTEX: BILATERAL</span>
              <span className="text-emerald-400">NORMAL SIGNAL</span>
            </div>
          </div>

          {/* 06 Genomic Sequence Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Dna size={14} className="text-cyan-400" /> 06 GENOMIC SEQUENCE
              </span>
              <span className="text-[9px] text-cyan-400">STRAND 02</span>
            </div>

            {/* Nucleotide Frequency Bars */}
            <div className="space-y-1.5 text-[9px]">
              <span className="text-slate-400 block text-[8px]">NUCLEOTIDE BASE ALIGNMENT</span>
              {[
                { base: 'A', pct: 28, color: '#22d3ee' },
                { base: 'T', pct: 28, color: '#14b8a6' },
                { base: 'G', pct: 22, color: '#38bdf8' },
                { base: 'C', pct: 22, color: '#0ea5e9' },
              ].map((n) => (
                <div key={n.base} className="flex items-center gap-2">
                  <span className="w-3 font-bold text-white">{n.base}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${n.pct * 2}%`, background: n.color }} />
                  </div>
                  <span className="text-slate-300">{n.pct}%</span>
                </div>
              ))}
            </div>

            <div className="p-1.5 rounded bg-cyan-950/50 border border-cyan-500/20 text-[8px] tracking-widest text-center text-cyan-300">
              A T G C A T T C C G A T G C
            </div>
          </div>

          {/* 07 Screening Overview Card */}
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-cyan-500/20 pb-1.5">
              <span className="font-bold text-white">07 SCREENING OVERVIEW</span>
              <span className="text-[9px] text-emerald-400">100%</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full border-4 border-cyan-400 border-t-emerald-400 flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-xs font-bold text-white font-sans leading-none">12/12</span>
                <span className="text-[7px] text-slate-400 uppercase">MODULES</span>
              </div>
              <div className="space-y-1 text-[9px] text-slate-300 flex-1">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 size={11} /> IMAGING: MRI / X-RAY
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 size={11} /> PHYSIOLOGY: VITAL SIGNALS
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 size={11} /> ANATOMY: BODY / ORGAN
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[9px]">
              <span className="text-slate-400">STATUS:</span>
              <span className="text-emerald-400 font-bold tracking-wider">SCAN COMPLETE // 100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
