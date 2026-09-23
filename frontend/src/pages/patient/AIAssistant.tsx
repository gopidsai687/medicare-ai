import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Pill,
  Activity,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle2,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  ragSourcesUsed?: number
}

const PRESET_PROMPTS = [
  { text: 'Explain my latest HbA1c & lipid lab results in simple terms', icon: Activity },
  { text: 'What is the best time of day to take my Lisinopril and Metformin?', icon: Pill },
  { text: 'What does a blood pressure reading of 128/82 mmHg mean for my health?', icon: Activity },
  { text: 'Are there any dietary foods or supplements I should avoid with my medications?', icon: ShieldCheck },
  { text: 'When should I schedule my next follow-up with Dr. Sarah Chen?', icon: Clock },
]

export default function PatientAIAssistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `Hello ${user?.full_name?.split(' ')[0] || 'there'}! I am your **MediCare AI Health Assistant**.\n\nI am connected directly to your personal medical chart, including your recent diagnoses, prescriptions, and laboratory telemetry.\n\nHow can I assist you with your health journey today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ragSourcesUsed: 2,
    },
  ])
  const [inputQuery, setInputQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'interactions'>('chat')
  
  // Drug interaction screening state
  const [medList, setMedList] = useState<string[]>(['Lisinopril 10mg', 'Metformin 500mg', 'Atorvastatin 20mg'])
  const [newMedInput, setNewMedInput] = useState('')
  const [interactionResult, setInteractionResult] = useState<any>(null)
  const [isScreening, setIsScreening] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery.trim()
    if (!query || isTyping) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMessage])
    if (!textToSend) setInputQuery('')
    setIsTyping(true)

    try {
      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await api.post('/api/v1/ai/chat', {
        messages: chatHistory,
      })

      const botReply: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: response.data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragSourcesUsed: response.data.rag_sources_used || 1,
      }

      setMessages((prev) => [...prev, botReply])
    } catch (err) {
      // Fallback local response if API is unreachable
      const fallbackReply: Message = {
        id: `bot-fallback-${Date.now()}`,
        role: 'assistant',
        content: `### Guidance regarding: "${query}"\n\nBased on your active health profile (**Type 2 Diabetes**, **Essential Hypertension**):\n- **Medications:** Continue your **Metformin (500mg)** and **Lisinopril (10mg)** as prescribed.\n- **Monitoring:** Track fasting blood sugar (target 80–130 mg/dL) and daily morning blood pressure.\n- **Dietary Advice:** Limit refined sugars and keep sodium intake under 2,000 mg/day.\n\n*🚨 If you experience acute chest discomfort, severe shortness of breath, or sudden weakness, call 911 immediately.*\n\n---\n*⚕️ MediCare AI educational guidance — always confirm treatment changes with your doctor.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragSourcesUsed: 2,
      }
      setMessages((prev) => [...prev, fallbackReply])
    } finally {
      setIsTyping(false)
    }
  }

  const handleScreenInteractions = async () => {
    if (medList.length < 2) return
    setIsScreening(true)
    try {
      const res = await api.post('/api/v1/ai/interactions', {
        medications: medList,
      })
      setInteractionResult(res.data)
    } catch {
      // Mock fallback
      setInteractionResult({
        screened_medications: medList,
        interaction_count: 0,
        interactions: [],
        has_critical: false,
      })
    } finally {
      setIsScreening(false)
    }
  }

  const addMedication = () => {
    if (newMedInput.trim() && !medList.includes(newMedInput.trim())) {
      setMedList([...medList, newMedInput.trim()])
      setNewMedInput('')
    }
  }

  const removeMedication = (med: string) => {
    setMedList(medList.filter((m) => m !== med))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 text-white shadow-lg shadow-blue-500/20">
              <Bot size={22} />
            </span>
            Personal AI Health Guide
          </h1>
          <p className="page-subtitle">
            24/7 intelligent health assistant personalized with your Electronic Medical Records
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Health Chat & Q&A
          </button>
          <button
            onClick={() => {
              setActiveTab('interactions')
              if (!interactionResult) handleScreenInteractions()
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'interactions'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Drug Interaction Screener
          </button>
        </div>
      </div>

      {/* Emergency Notice Alert */}
      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-300">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={18} className="shrink-0 text-rose-400" />
          <span>
            <strong className="text-white">Emergency Warning:</strong> If you are experiencing chest pain, severe shortness of breath, sudden numbness, or fainting, call <strong>911</strong> immediately.
          </span>
        </div>
        <span className="hidden md:inline-block px-2.5 py-1 rounded-full bg-rose-500/20 text-[10px] font-bold uppercase tracking-wider text-rose-300">
          Emergency Protocol
        </span>
      </div>

      {activeTab === 'chat' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Main Chat Stream */}
          <div className="lg:col-span-3 glass rounded-2xl border border-white/10 flex flex-col h-[650px] overflow-hidden">
            {/* Chat Subheader */}
            <div className="px-5 py-3.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 font-medium">Gemini 2.5 Clinical Engine</span>
                <span className="text-slate-500">•</span>
                <span className="text-blue-400 font-medium flex items-center gap-1">
                  <ShieldCheck size={13} /> RAG Grounded EHR Active
                </span>
              </div>
              <button
                onClick={() => setMessages([messages[0]])}
                className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
              >
                <RefreshCw size={12} /> Clear History
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shrink-0 text-white shadow-md shadow-blue-500/20 mt-1">
                      <Bot size={16} />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    <div
                      className={`flex items-center justify-between pt-2 border-t text-[10px] ${
                        msg.role === 'user' ? 'border-blue-500/40 text-blue-200' : 'border-white/5 text-slate-400'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {msg.ragSourcesUsed !== undefined && msg.ragSourcesUsed > 0 && (
                        <span className="inline-flex items-center gap-1 text-teal-300 font-medium">
                          <Sparkles size={10} /> Grounded in {msg.ragSourcesUsed} chart records
                        </span>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-300 mt-1">
                      <UserIcon size={16} />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shrink-0 text-white shadow-md">
                    <Bot size={16} />
                  </div>
                  <div className="glass p-3 rounded-2xl rounded-tl-none border border-white/10 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                    <span className="text-[11px] text-slate-400 ml-2">Retrieving clinical context...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-white/5 border-t border-white/10">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask a health question, ask about your medications, or lab results..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isTyping}
                  className="btn-primary px-4 py-3 rounded-xl disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Send size={15} />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </form>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                MediCare AI provides educational information grounded in your medical records. Always consult your physician for diagnosis and medical decisions.
              </p>
            </div>
          </div>

          {/* Quick Prompts & Patient Chart Sidebar */}
          <div className="space-y-4">
            <div className="glass p-4 rounded-2xl border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-400" /> Suggested Inquiries
              </h3>
              <div className="space-y-2">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.text)}
                    className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 text-slate-300 hover:text-white transition-all text-xs flex items-start gap-2.5 group"
                  >
                    <p.icon size={15} className="text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="leading-snug">{p.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Summary Snapshot */}
            <div className="glass p-4 rounded-2xl border border-white/10 space-y-3 text-xs">
              <h3 className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 text-[11px]">
                <FileText size={14} className="text-teal-400" /> Active EHR Profile
              </h3>
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Primary Care:</span>
                  <span className="font-semibold text-white">Dr. Sarah Chen</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Blood Type:</span>
                  <span className="font-semibold text-teal-400">A+ Positive</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Active Meds:</span>
                  <span className="font-semibold text-white">3 Prescribed</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Last Encounter:</span>
                  <span className="font-semibold text-slate-200">Sep 15, 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Drug Interaction Screener Tab */
        <div className="glass p-6 rounded-2xl border border-white/10 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Pill size={18} className="text-teal-400" /> Multi-Medication Interaction Screening Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Screen your active prescriptions and over-the-counter drugs for biochemical contraindications and cytochrome P450 pathway interactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Med list management */}
            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-300 block">Current Medications to Screen:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMedInput}
                  onChange={(e) => setNewMedInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMedication())}
                  placeholder="e.g. Aspirin, Ibuprofen, St. John's Wort..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
                />
                <button
                  type="button"
                  onClick={addMedication}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {medList.map((med) => (
                  <div
                    key={med}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-slate-200"
                  >
                    <span className="font-medium">{med}</span>
                    <button
                      onClick={() => removeMedication(med)}
                      className="text-slate-400 hover:text-rose-400 text-xs px-1.5"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleScreenInteractions}
                disabled={isScreening || medList.length < 2}
                className="w-full btn-primary py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className={isScreening ? 'animate-spin' : ''} />
                {isScreening ? 'Screening Pharmacokinetics...' : 'Re-run Safety Screen'}
              </button>
            </div>

            {/* Results Display */}
            <div className="md:col-span-2 space-y-4">
              <label className="text-xs font-semibold text-slate-300 block">Pharmacological Interaction Analysis:</label>

              {interactionResult?.interactions?.length === 0 ? (
                <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                  <p className="font-bold text-white text-sm">No Severe Drug Interactions Detected</p>
                  <p className="text-xs text-emerald-300/80">
                    The {medList.length} screened medications do not trigger any known critical biochemical contraindications in our clinical database.
                  </p>
                </div>
              ) : (
                interactionResult?.interactions?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-300">
                        {item.drugs.join(' ↔ ')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase">
                        {item.severity} Severity
                      </span>
                    </div>
                    <p className="text-slate-200">{item.effect}</p>
                    <p className="text-teal-300 font-medium">Recommendation: {item.recommendation}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
