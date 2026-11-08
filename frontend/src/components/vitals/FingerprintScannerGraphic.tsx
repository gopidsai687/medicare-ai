import React, { useState } from 'react'
import { Sparkles, Shield, Info } from 'lucide-react'

interface FingerprintScannerGraphicProps {
  isScanning?: boolean
  onScanClick?: () => void
  className?: string
}

export function FingerprintScannerGraphic({
  isScanning = true,
  onScanClick,
  className = '',
}: FingerprintScannerGraphicProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 rounded-3xl bg-[#060c18] border-2 border-[#00ff88]/50 shadow-[0_0_35px_rgba(0,255,136,0.18)] transition-all duration-500 overflow-hidden ${
        hovered ? 'border-[#00ff88] shadow-[0_0_50px_rgba(0,255,136,0.3)]' : ''
      } ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onScanClick}
    >
      {/* Ambient Radial Backlight Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(0,255,136,0.14) 0%, rgba(6,12,24,0) 70%)',
        }}
      />

      {/* Decorative Outer Scanning Circular Rings */}
      <div className="absolute w-72 h-72 rounded-full border border-dashed border-[#00ff88]/20 animate-spin-slow pointer-events-none" />
      <div className="absolute w-84 h-84 rounded-full border border-[#00ff88]/10 animate-pulse pointer-events-none" />

      {/* Corner Bracket Accents */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[#00ff88]/80 rounded-tl-sm pointer-events-none" />
      <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[#00ff88]/80 rounded-tr-sm pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[#00ff88]/80 rounded-bl-sm pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[#00ff88]/80 rounded-br-sm pointer-events-none" />

      {/* Main High-Fidelity Neon Green Fingerprint SVG */}
      <div className="relative w-52 h-64 flex items-center justify-center">
        <svg
          viewBox="0 0 240 320"
          className="w-full h-full drop-shadow-[0_0_16px_rgba(0,255,136,0.7)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="laser-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0" />
              <stop offset="25%" stopColor="#00ff88" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="75%" stopColor="#00ff88" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Central Core Loops */}
          <path
            d="M 120 180 L 120 135 A 15 15 0 0 1 135 150 L 135 175"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 105 185 L 105 140 A 25 25 0 0 1 150 140 L 150 185"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />

          {/* Inner Stadium Loops */}
          <path
            d="M 90 200 L 90 130 A 40 40 0 0 1 165 130 L 165 200"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 75 210 L 75 120 A 55 55 0 0 1 180 120 L 180 210"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />

          {/* Mid Ridge Stadium Loops with realistic anatomical arch gaps */}
          <path
            d="M 60 220 L 60 110 A 70 70 0 0 1 195 110 L 195 220"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 46 230 L 46 100 A 85 85 0 0 1 210 100 L 210 230"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />

          {/* Outer Stadium Contours */}
          <path
            d="M 32 238 L 32 90 A 98 98 0 0 1 224 90 L 224 238"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 20 245 L 20 82 A 110 110 0 0 1 236 82 L 236 245"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />

          {/* Bottom U-Loops and Arch Extensions */}
          <path
            d="M 120 180 A 15 15 0 0 0 135 195 L 135 220"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 105 185 A 30 30 0 0 0 150 200 L 150 235"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 90 200 A 45 45 0 0 0 165 215 L 165 250"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 75 210 A 60 60 0 0 0 180 230 L 180 262"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />
          <path
            d="M 60 220 A 75 75 0 0 0 195 240 L 195 272"
            stroke="#00ff88"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#neon-glow)"
          />

          {/* Sweeping Laser Beam Animation */}
          {isScanning && (
            <g className="animate-laser-scan">
              <line
                x1="10"
                y1="0"
                x2="230"
                y2="0"
                stroke="url(#laser-grad)"
                strokeWidth="3"
                filter="url(#neon-glow)"
              />
              <rect
                x="20"
                y="-18"
                width="200"
                height="18"
                fill="url(#laser-grad)"
                opacity="0.18"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Visual Identity Label */}
      <div className="mt-4 text-center z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-[11px] font-bold font-mono tracking-wider uppercase">
          <Sparkles size={12} />
          VitalSense™ Visual Identity
        </div>
        <p className="text-[11px] text-slate-400 mt-2 max-w-[260px] leading-relaxed">
          Biometric theme and portal navigation hub.
        </p>
      </div>

      <style>{`
        @keyframes laserScan {
          0% {
            transform: translateY(30px);
            opacity: 0.2;
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(280px);
            opacity: 0.2;
          }
        }
        .animate-laser-scan {
          animation: laserScan 2.8s ease-in-out infinite alternate;
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spinSlow 20s linear infinite;
        }
      `}</style>
    </div>
  )
}

