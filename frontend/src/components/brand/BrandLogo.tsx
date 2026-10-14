import React from 'react'

interface BrandLogoProps {
  size?: number
  showText?: boolean
  subtitle?: string
  className?: string
}

export function BrandLogo({ size = 36, showText = true, subtitle, className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Heart + ECG Pulse Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform hover:scale-105 duration-200"
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#071120" />
            <stop offset="100%" stopColor="#0c2340" />
          </linearGradient>

          <linearGradient id="logoPulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#0ea5e9" />
            <stop offset="80%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>

          <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Rounded Container */}
        <rect width="512" height="512" rx="112" fill="url(#logoBgGrad)" />
        <rect
          width="504"
          height="504"
          x="4"
          y="4"
          rx="108"
          fill="none"
          stroke="url(#logoPulseGrad)"
          strokeWidth="6"
          strokeOpacity="0.4"
        />

        {/* Heart Silhouette Frame */}
        <path
          d="M256,430 C256,430 80,315 80,195 C80,125 135,78 200,78 C232,78 248,94 256,108 C264,94 280,78 312,78 C377,78 432,125 432,195 C432,315 256,430 256,430 Z"
          fill="#0e2442"
          fillOpacity="0.5"
          stroke="url(#logoPulseGrad)"
          strokeWidth="14"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity="0.8"
        />

        {/* Dynamic ECG Pulse Line */}
        <path
          d="M72,256 L152,256 L174,236 L192,256 L210,290 L248,118 L284,374 L318,242 L342,274 L358,256 L440,256"
          fill="none"
          stroke="url(#logoPulseGrad)"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#logoGlow)"
        />

        {/* Apex Highlight Point */}
        <circle cx="248" cy="118" r="9" fill="#ffffff" filter="url(#logoGlow)" />
      </svg>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold tracking-tight text-white text-lg font-outfit">
              MediCare
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-black tracking-widest uppercase rounded bg-gradient-to-r from-sky-500 to-teal-400 text-slate-950">
              AI
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
