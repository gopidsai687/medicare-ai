import { useState } from 'react'
import {
  Settings,
  Shield,
  Key,
  Bot,
  Database,
  Lock,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Zap,
  Sliders,
} from 'lucide-react'

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'security' | 'hipaa' | 'ai' | 'infra'>('security')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Security Form State
  const [jwtExpiry, setJwtExpiry] = useState('60')
  const [refreshExpiry, setRefreshExpiry] = useState('7')
  const [mfaEnforce, setMfaEnforce] = useState(true)
  const [idleTimeout, setIdleTimeout] = useState('15')
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5')

  // HIPAA Form State
  const [auditRetention, setAuditRetention] = useState('7')
  const [mpiThreshold, setMpiThreshold] = useState('0.75')
  const [deidentifyExport, setDeidentifyExport] = useState(true)
  const [autoVectorSync, setAutoVectorSync] = useState(true)

  // AI Parameters State
  const [aiModel, setAiModel] = useState('gemini-2.5-pro')
  const [aiTemperature, setAiTemperature] = useState('0.2')
  const [aiMaxTokens, setAiMaxTokens] = useState('2048')
  const [emergencyDetection, setEmergencyDetection] = useState(true)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setSaveSuccess('System security policies and AI clinical engine configuration saved successfully.')
      setTimeout(() => setSaveSuccess(''), 6000)
    }, 600)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
              <Settings size={22} />
            </span>
            System Configuration & Compliance Governance
          </h1>
          <p className="page-subtitle">
            Enterprise authentication policies, HIPAA data retention, Gemini AI parameters, and telemetry
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          <span>{isSaving ? 'Applying Policies...' : 'Save Configuration'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Key size={14} /> Security & Auth
        </button>
        <button
          onClick={() => setActiveTab('hipaa')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'hipaa'
              ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield size={14} /> HIPAA & Governance
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'ai'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bot size={14} /> Gemini AI Parameters
        </button>
        <button
          onClick={() => setActiveTab('infra')}
          className={`px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'infra'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Server size={14} /> Infrastructure Telemetry
        </button>
      </div>

      {/* Tab 1: Security & Auth */}
      {activeTab === 'security' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key size={18} className="text-blue-400" /> Authentication & Session Lifespan Policies
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure OAuth2 JWT token validity, idle workstation lockouts, and multi-factor authentication mandates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Access Token Expiration (Minutes):</label>
              <input
                type="number"
                value={jwtExpiry}
                onChange={(e) => setJwtExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500">Default: 60 minutes. Shorter duration enhances clinical workstation safety.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Refresh Token Expiration (Days):</label>
              <input
                type="number"
                value={refreshExpiry}
                onChange={(e) => setRefreshExpiry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500">Requires re-authentication after duration expires.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Idle Session Auto-Lock Timeout (Minutes):</label>
              <input
                type="number"
                value={idleTimeout}
                onChange={(e) => setIdleTimeout(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500">HIPAA standard: 15 minutes of inactivity before screen lock.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Max Failed Login Attempts Before Lockout:</label>
              <input
                type="number"
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-[10px] text-slate-500">Triggers temporary 30-minute security lock upon reaching limit.</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mfaEnforce}
                onChange={(e) => setMfaEnforce(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 bg-white/5 border-white/10"
              />
              <div>
                <span className="font-semibold text-white text-xs block">Enforce Multi-Factor Authentication (MFA)</span>
                <span className="text-[11px] text-slate-400">Mandate TOTP authenticator app verification for all Doctor and Admin users.</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Tab 2: HIPAA & Governance */}
      {activeTab === 'hipaa' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield size={18} className="text-teal-400" /> HIPAA Compliance & Data Governance Controls
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Audit log persistence durations, MPI probabilistic linkage thresholds, and PHI export safeguards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Audit Log Retention Period (Years):</label>
              <input
                type="number"
                value={auditRetention}
                onChange={(e) => setAuditRetention(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
              />
              <span className="text-[10px] text-slate-500">HIPAA Security Rule requires minimum 6 years of audit log preservation.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">MPI Duplicate Linkage Detection Threshold (0.50 - 1.00):</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="1.0"
                value={mpiThreshold}
                onChange={(e) => setMpiThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-500/50"
              />
              <span className="text-[10px] text-slate-500">Weighted Jaro-Winkler + DOB + Phone probabilistic match floor.</span>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={deidentifyExport}
                onChange={(e) => setDeidentifyExport(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 bg-white/5 border-white/10"
              />
              <div>
                <span className="font-semibold text-white block">Automated PHI De-identification on Analytics Exports</span>
                <span className="text-slate-400 text-[11px]">Strip Direct Identifiers (SSN, Full Name, Exact Address) from data science exports.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoVectorSync}
                onChange={(e) => setAutoVectorSync(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 bg-white/5 border-white/10"
              />
              <div>
                <span className="font-semibold text-white block">Auto-Sync pgvector Clinical Embeddings</span>
                <span className="text-slate-400 text-[11px]">Generate 768-dim vector embeddings immediately when new SOAP encounters are signed.</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Tab 3: Gemini AI Parameters */}
      {activeTab === 'ai' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bot size={18} className="text-indigo-400" /> Gemini Generative AI & Clinical Engine Parameters
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fine-tune generative model behavior, token generation caps, and medical emergency detector sensitivity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Active Foundation Model:</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              >
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Clinical Decision Support)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (High Throughput)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Sampling Temperature ({aiTemperature}):</label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={aiTemperature}
                onChange={(e) => setAiTemperature(e.target.value)}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.0 (Deterministic)</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Max Output Tokens:</label>
              <input
                type="number"
                value={aiMaxTokens}
                onChange={(e) => setAiMaxTokens(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyDetection}
                onChange={(e) => setEmergencyDetection(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-white/5 border-white/10"
              />
              <div>
                <span className="font-semibold text-white block">High-Priority Red-Flag Emergency Keyword Screening</span>
                <span className="text-slate-400 text-[11px]">Automatically intercept chest pain, stroke, or respiratory distress queries with immediate 911 directives.</span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Tab 4: Infrastructure Telemetry */}
      {activeTab === 'infra' && (
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server size={18} className="text-purple-400" /> Infrastructure Telemetry & Services Health
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Live connection status and resource utilization for core architectural components.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* PostgreSQL */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Database size={16} className="text-blue-400" /> PostgreSQL 16 (Source of Truth)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  HEALTHY
                </span>
              </div>
              <div className="text-slate-400 space-y-1 text-[11px]">
                <p>Connection Pool: <strong className="text-white">12 / 50 Active</strong></p>
                <p>Average Query Latency: <strong className="text-white">2.4 ms</strong></p>
                <p>Database Engine: <strong className="text-white">PostgreSQL with ACID Guarantees</strong></p>
              </div>
            </div>

            {/* pgvector */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Zap size={16} className="text-teal-400" /> pgvector Extension (RAG Index)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  INDEXED
                </span>
              </div>
              <div className="text-slate-400 space-y-1 text-[11px]">
                <p>Embedding Dimension: <strong className="text-white">768-dim (text-embedding-004)</strong></p>
                <p>Index Type: <strong className="text-white">HNSW Cosine Distance</strong></p>
                <p>Clinical Chunks Stored: <strong className="text-white">4,820 Vectors</strong></p>
              </div>
            </div>

            {/* Redis */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Sliders size={16} className="text-amber-400" /> Redis Cache & Session Store
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  CONNECTED
                </span>
              </div>
              <div className="text-slate-400 space-y-1 text-[11px]">
                <p>Memory Utilization: <strong className="text-white">42 MB / 512 MB</strong></p>
                <p>Key Hit Ratio: <strong className="text-white">96.8%</strong></p>
                <p>Uptime: <strong className="text-white">14 Days, 6 Hours</strong></p>
              </div>
            </div>

            {/* Gemini API */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <Bot size={16} className="text-indigo-400" /> Google Gemini API Cluster
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  ONLINE
                </span>
              </div>
              <div className="text-slate-400 space-y-1 text-[11px]">
                <p>Active Model: <strong className="text-white">Gemini 2.5 Pro (Generative AI)</strong></p>
                <p>Safety Filters: <strong className="text-white">BLOCK_NONE (Clinical Grounding Active)</strong></p>
                <p>Fallback Engine: <strong className="text-white">Autonomous Rule-Based Standby</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
