import React from 'react'
import { useRouteError, useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react'

export function RouteErrorBoundary() {
  const error = useRouteError() as any
  const navigate = useNavigate()

  const isModuleError =
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed') ||
    error?.message?.includes('dynamically imported module')

  const handleReload = () => {
    // Clear all retry markers to ensure fresh attempt
    try {
      Object.keys(window.sessionStorage).forEach((key) => {
        if (key.startsWith('medicare_chunk_retry_')) {
          window.sessionStorage.removeItem(key)
        }
      })
    } catch {
      // Ignore storage access errors
    }
    window.location.reload()
  }

  const handleGoHome = () => {
    const role = localStorage.getItem('user_role')?.toLowerCase() || 'patient'
    if (role === 'doctor' || role === 'nurse') {
      navigate('/doctor')
    } else if (role === 'admin') {
      navigate('/admin')
    } else {
      navigate('/patient')
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full glass p-8 rounded-2xl border border-rose-500/20 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertTriangle size={28} />
        </div>

        <div className="space-y-2">
          <h2 className="font-outfit text-xl font-bold text-white">
            {isModuleError ? 'Application Update Detected' : 'Unable to Load Clinical View'}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isModuleError
              ? 'A new version of MediCare AI was recently deployed. Refreshing will load the latest version of this page.'
              : error?.message || 'An unexpected error occurred while loading this clinical view.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={handleReload}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-blue-500/20"
          >
            <RefreshCw size={14} />
            <span>Refresh Application</span>
          </button>

          <button
            onClick={handleGoHome}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/50 cursor-pointer transition-colors"
          >
            <Home size={14} />
            <span>Return to Dashboard</span>
          </button>
        </div>

        <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-800/60">
          MediCare AI Clinical Portal • Verified Session Protection
        </div>
      </div>
    </div>
  )
}
