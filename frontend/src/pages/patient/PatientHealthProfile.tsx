import React, { useState, useEffect } from 'react'
import {
  User,
  Shield,
  Activity,
  Heart,
  Droplet,
  FileText,
  Pill,
  Calendar,
  AlertCircle,
  FileCheck,
  Download,
  Share2,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

export default function PatientHealthProfile() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary' | 'meds' | 'records'>('timeline')

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/health-profile')
      setData(res.data)
    } catch (err) {
      console.error('Failed to load health profile:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin mx-auto mb-3" color="#38bdf8" />
          <div>Assembling consolidated patient health timeline...</div>
        </div>
      </div>
    )
  }

  const patient = data?.patient || {}
  const allergies = data?.allergies || []
  const medications = data?.active_medications || []
  const prescriptions = data?.prescriptions || []
  const reports = data?.medical_reports || []
  const vitals = data?.recent_vitals || []
  const appointments = data?.appointments || []
  const alerts = data?.recent_alerts || []
  const timeline = data?.timeline || []

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'vital_reading':
        return <Activity size={15} color="#38bdf8" />
      case 'prescription':
        return <Pill size={15} color="#2dd4bf" />
      case 'medical_report':
        return <FileText size={15} color="#a78bfa" />
      case 'appointment':
        return <Calendar size={15} color="#f59e0b" />
      case 'clinical_alert':
        return <AlertCircle size={15} color="#ef4444" />
      default:
        return <Clock size={15} color="#94a3b8" />
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div
        className="glass"
        style={{
          padding: '28px',
          background: 'linear-gradient(135deg, rgba(15,32,64,0.7) 0%, rgba(10,22,40,0.9) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'white',
              boxShadow: '0 8px 24px rgba(14,165,233,0.3)',
            }}
          >
            {patient.full_name ? patient.full_name.charAt(0) : 'P'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {patient.full_name || 'Patient Profile'}
              </h1>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#2dd4bf',
                  background: 'rgba(45,212,191,0.1)',
                  border: '1px solid rgba(45,212,191,0.25)',
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                Verified Record
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>MPI ID: <strong style={{ color: '#cbd5e1' }}>{patient.id ? patient.id.slice(0, 8) : 'N/A'}</strong></span>
              <span>DOB: <strong style={{ color: '#cbd5e1' }}>{patient.date_of_birth || 'Not Recorded'}</strong></span>
              <span>Gender: <strong style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{patient.gender || 'Not Specified'}</strong></span>
              <span>Blood Group: <strong style={{ color: '#cbd5e1' }}>{patient.blood_type || 'Unknown'}</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => window.print()}
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <Download size={14} />
            <span>Print Clinical Record</span>
          </button>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
        {[
          { key: 'timeline', label: 'Longitudinal Timeline' },
          { key: 'summary', label: 'Clinical Summary & Allergies' },
          { key: 'meds', label: `Medications & Rx (${medications.length + prescriptions.length})` },
          { key: 'records', label: `Lab & Reports (${reports.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab.key ? 'rgba(56,189,248,0.15)' : 'transparent',
              color: activeTab === tab.key ? '#38bdf8' : '#94a3b8',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Longitudinal Timeline */}
      {activeTab === 'timeline' && (
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Chronological Health Timeline
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
                Unified stream of vital measurements, clinical alerts, prescription reviews, and diagnostic reports.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid rgba(56,189,248,0.2)' }}>
            {timeline.map((event: any, idx: number) => (
              <div key={event.id || idx} style={{ position: 'relative', marginBottom: 24 }}>
                {/* Node marker */}
                <div
                  style={{
                    position: 'absolute',
                    left: -33,
                    top: 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#0a1628',
                    border: '2px solid #38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />

                <div
                  style={{
                    background: 'rgba(10,22,40,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {getTimelineIcon(event.type)}
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                        {event.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {event.date ? format(new Date(event.date), 'MMM dd, yyyy h:mm a') : 'Recent'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.825rem', color: '#cbd5e1', margin: '0 0 8px', lineHeight: 1.45 }}>
                    {event.summary}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: '#94a3b8' }}>
                    {event.source && (
                      <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4 }}>
                        Source: {event.source}
                      </span>
                    )}
                    {event.is_sample && (
                      <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4 }}>
                        Sample Data
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {timeline.length === 0 && (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                No events recorded yet in the health timeline.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Clinical Summary & Allergies */}
      {activeTab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Allergies Card */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>
              Documented Allergies
            </h3>
            {allergies.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allergies.map((allergy: any) => (
                  <div
                    key={allergy.id}
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 10,
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#fca5a5', fontSize: '0.85rem' }}>
                        {allergy.allergen}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#f87171', textTransform: 'capitalize', fontWeight: 600 }}>
                        {allergy.severity || 'Moderate'}
                      </span>
                    </div>
                    {allergy.reaction && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                        Reaction: {allergy.reaction}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '0.825rem' }}>
                No active allergies documented by clinician or patient.
              </div>
            )}
          </div>

          {/* Emergency Contacts & Insurance */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>
              Emergency Contacts & Coverage
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.825rem', color: '#cbd5e1' }}>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>Emergency Contact Name</span>
                <strong>{patient.emergency_contact_name || 'Not Provided'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>Emergency Contact Phone</span>
                <strong>{patient.emergency_contact_phone || 'Not Provided'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>Insurance Provider</span>
                <strong>{patient.insurance_provider || 'Self-Pay / Not Recorded'}</strong>
              </div>
              <div>
                <span style={{ color: '#94a3b8', display: 'block' }}>Policy / Member ID</span>
                <strong>{patient.insurance_policy_number || 'N/A'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Medications */}
      {activeTab === 'meds' && (
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
            Current Medications & Prescriptions
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {medications.map((med: any) => (
              <div
                key={med.id}
                style={{
                  background: 'rgba(10,22,40,0.6)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Pill size={16} color="#2dd4bf" />
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                    {med.name}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: 4 }}>
                  Dosage: <strong>{med.dosage || 'Standard'}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Frequency: {med.frequency || 'As directed'}
                </div>
              </div>
            ))}

            {medications.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                No active medications currently recorded.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Records & Labs */}
      {activeTab === 'records' && (
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
            Diagnostic Medical Reports
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((rep: any) => (
              <div
                key={rep.id}
                style={{
                  background: 'rgba(10,22,40,0.6)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="#a78bfa" />
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.875rem' }}>
                      {rep.title || 'Laboratory Report'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Uploaded: {rep.created_at ? format(new Date(rep.created_at), 'MMM dd, yyyy') : 'Recent'}
                    </div>
                  </div>
                </div>

                <Link
                  to="/patient/reports"
                  className="btn-secondary"
                  style={{ fontSize: '0.78rem', textDecoration: 'none', padding: '6px 12px' }}
                >
                  View Analysis
                </Link>
              </div>
            ))}

            {reports.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                No diagnostic laboratory reports uploaded yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
