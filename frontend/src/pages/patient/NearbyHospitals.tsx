import React, { useState, useEffect } from 'react'
import {
  MapPin,
  PhoneCall,
  Navigation,
  Search,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ExternalLink,
  Building2,
  CheckCircle2,
  Compass,
  Info,
  RefreshCw,
  Phone,
} from 'lucide-react'
import { api } from '@/lib/api'

interface HospitalFacility {
  id: string
  name: string
  facility_type: string
  trauma_level?: string | null
  has_emergency_department: boolean
  address: string
  city: string
  state: string
  postal_code?: string | null
  phone?: string | null
  distance_miles?: number | null
  distance_km?: number | null
  opening_hours: string
  verified_emergency_center: boolean
  directions_url: string
}

export default function NearbyHospitals() {
  const [facilities, setFacilities] = useState<HospitalFacility[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [filterEROnly, setFilterEROnly] = useState(false)

  // Request HTML5 Geolocation
  const requestLocation = () => {
    setLocationStatus('requesting')
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setLocationError('Geolocation is not supported by your browser. Please search by city or ZIP code below.')
      searchByQuery('Houston, TX')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setCurrentCoords({ lat: latitude, lon: longitude })
        setLocationStatus('granted')
        fetchNearbyByCoords(latitude, longitude)
      },
      (error) => {
        setLocationStatus('denied')
        let msg = 'Location access was declined or timed out. Please enter your city or ZIP code below.'
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can manually enter any city or ZIP code.'
        }
        setLocationError(msg)
        // Fallback default search to show verified trauma centers
        searchByQuery('Chicago, IL')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const fetchNearbyByCoords = async (lat: number, lon: number) => {
    try {
      setLoading(true)
      const res = await api.get('/api/v1/vitals/emergency/hospitals', {
        params: { lat, lon, radius_km: 30 },
      })
      setFacilities(res.data?.facilities || [])
    } catch (err) {
      console.error('Failed to query hospitals by location:', err)
    } finally {
      setLoading(false)
    }
  }

  const searchByQuery = async (queryText: string) => {
    if (!queryText.trim()) return
    try {
      setLoading(true)
      setLocationError(null)
      const res = await api.get('/api/v1/vitals/emergency/hospitals', {
        params: { query: queryText.trim(), radius_km: 30 },
      })
      setFacilities(res.data?.facilities || [])
    } catch (err) {
      console.error('Failed to query hospitals by text search:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial fetch using default search so user isn't stuck with empty screen
    searchByQuery('Chicago, IL')
  }, [])

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchByQuery(searchQuery)
  }

  const filteredFacilities = facilities.filter(
    (f) => !filterEROnly || f.has_emergency_department
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Critical Emergency Banner (Call 911 Instant Action) */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.9), rgba(185,28,28,0.95))',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 12px 40px rgba(220,38,38,0.35)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.25)', padding: '4px 12px', borderRadius: 20, marginBottom: 10 }}>
              <ShieldAlert size={14} color="#fca5a5" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Immediate Medical Emergency Protocol
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Are you experiencing a medical crisis?
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#fee2e2', margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
              If you or someone nearby is experiencing chest pain, severe shortness of breath, sudden numbness, uncontrolled bleeding, or altered mental status, <strong>do not wait for an app or complete a questionnaire</strong>. Contact your local emergency service immediately.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <a
              href="tel:911"
              style={{
                background: '#ffffff',
                color: '#b91c1c',
                fontWeight: 800,
                fontSize: '1.1rem',
                padding: '14px 28px',
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                transition: 'transform 0.15s ease',
              }}
            >
              <PhoneCall size={22} color="#b91c1c" />
              <span>Call 911 (US)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Header and Controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 6 }}>
            <MapPin size={12} color="#38bdf8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Healthcare Discovery
            </span>
          </div>
          <h2 className="page-title">Nearby Hospitals & Emergency Departments</h2>
          <p className="page-subtitle">
            Find verified trauma centers, hospital emergency rooms, and get turn-by-turn driving directions.
          </p>
        </div>

        {/* Location Permission Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={requestLocation}
            disabled={locationStatus === 'requesting'}
            className="btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <Compass size={16} className={locationStatus === 'requesting' ? 'animate-spin' : ''} />
            <span>
              {locationStatus === 'granted'
                ? 'Update Current Location'
                : 'Use My Current Location'}
            </span>
          </button>
        </div>
      </div>

      {/* Location Status Alert / Error */}
      {locationError && (
        <div
          style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#fef3c7',
            fontSize: '0.825rem',
          }}
        >
          <Info size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span>{locationError}</span>
        </div>
      )}

      {/* Search Bar & Filter Options */}
      <div
        className="glass"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <form onSubmit={handleManualSearch} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(10,22,40,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '8px 14px',
              flex: 1,
            }}
          >
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search by City, State, or ZIP code (e.g., Houston, TX or 77030)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '0.85rem',
                width: '100%',
              }}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-secondary" style={{ padding: '8px 16px' }}>
            <span>Search</span>
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterEROnly}
              onChange={(e) => setFilterEROnly(e.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            <span>24/7 Emergency Departments Only</span>
          </label>
        </div>
      </div>

      {/* Hospital Facilities Grid */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={24} className="animate-spin mx-auto mb-3" color="#38bdf8" />
          <div>Querying healthcare facilities and verified trauma centers...</div>
        </div>
      ) : filteredFacilities.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {filteredFacilities.map((hospital) => (
            <div
              key={hospital.id}
              className="glass"
              style={{
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: hospital.trauma_level ? '1px solid rgba(56,189,248,0.25)' : '1px solid rgba(255,255,255,0.06)',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div>
                {/* Trauma Level / ER Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {hospital.has_emergency_department && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <AlertTriangle size={11} />
                      24/7 Emergency Department
                    </span>
                  )}

                  {hospital.trauma_level && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(14,165,233,0.15)',
                        border: '1px solid rgba(14,165,233,0.3)',
                        color: '#38bdf8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {hospital.trauma_level}
                    </span>
                  )}

                  {hospital.distance_miles != null && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.75rem',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      {hospital.distance_miles.toFixed(1)} miles away
                    </span>
                  )}
                </div>

                {/* Facility Name */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px', lineHeight: 1.3 }}>
                  {hospital.name}
                </h3>

                {/* Address */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#94a3b8', fontSize: '0.8rem', marginBottom: 12 }}>
                  <MapPin size={15} color="#64748b" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    {hospital.address}, {hospital.city}, {hospital.state} {hospital.postal_code || ''}
                  </div>
                </div>

                {/* Opening Hours Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: '0.75rem', fontWeight: 500, marginBottom: 16 }}>
                  <Clock size={13} />
                  <span>{hospital.opening_hours}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {hospital.phone && (
                  <a
                    href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.78rem', textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <Phone size={13} />
                    <span>Call Desk</span>
                  </a>
                )}

                <a
                  href={hospital.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.78rem', textDecoration: 'none', justifyContent: 'center' }}
                >
                  <Navigation size={13} />
                  <span>Directions</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <Building2 size={36} color="#64748b" className="mx-auto mb-3" />
          <h3 style={{ color: '#cbd5e1', margin: '0 0 6px' }}>No healthcare facilities found</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 400, margin: '0 auto 16px' }}>
            Try expanding your search query (e.g. search for "Chicago, IL" or "Houston, TX") or click "Use My Current Location".
          </p>
          <button onClick={() => searchByQuery('Chicago, IL')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
            Search Major Medical Centers
          </button>
        </div>
      )}

      {/* Safety & Compliance Information */}
      <div
        className="glass"
        style={{
          padding: '20px 24px',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <strong>Hospital Availability Notice:</strong> MediCare AI provides verified directory listings and routing assistance for regional medical centers. Facility capacity, emergency room wait times, and trauma divert status change in real time. We do not guarantee bed availability or ambulance dispatch without direct 911 dispatch communication.
        </div>
      </div>
    </div>
  )
}
