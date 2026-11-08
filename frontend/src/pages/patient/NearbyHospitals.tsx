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
  Compass,
  Info,
  RefreshCw,
  Phone,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'

interface HospitalFacility {
  id: string
  name: string
  facility_type: string
  trauma_level?: string | null
  has_emergency_department: boolean
  is_emergency_department?: boolean
  address: string
  city: string
  state: string
  postal_code?: string | null
  zip_code?: string | null
  phone?: string | null
  emergency_phone?: string | null
  distance_miles?: number | null
  distance_km?: number | null
  opening_hours: string
  verified_emergency_center?: boolean
  is_verified?: boolean
  directions_url: string
  website?: string | null
  data_source?: string
}

interface SearchOrigin {
  latitude: number
  longitude: number
  city?: string
  state?: string
  postal_code?: string
  label?: string
  provider?: string
}

export default function NearbyHospitals() {
  const [facilities, setFacilities] = useState<HospitalFacility[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('37067')
  const [radiusMiles, setRadiusMiles] = useState<number>(25)
  const [filterEROnly, setFilterEROnly] = useState<boolean>(false)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [lastSearchedLocation, setLastSearchedLocation] = useState<string | null>(null)
  const [resolvedOrigin, setResolvedOrigin] = useState<SearchOrigin | null>(null)
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  // Request HTML5 Geolocation
  const requestLocation = () => {
    setLocationStatus('requesting')
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationStatus('denied')
      setLocationError('Geolocation is not supported by your browser. Please enter your ZIP code or city below.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setCurrentCoords({ lat: latitude, lon: longitude })
        setLocationStatus('granted')
        fetchNearbyByCoords(latitude, longitude, radiusMiles, filterEROnly)
      },
      (error) => {
        setLocationStatus('denied')
        let msg = 'Location access was declined or timed out. Please enter your ZIP code or city below.'
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can manually enter your 5-digit ZIP code or city.'
        }
        setLocationError(msg)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const fetchNearbyByCoords = async (lat: number, lon: number, radius: number, erOnly: boolean) => {
    try {
      setLoading(true)
      setLocationError(null)
      const res = await api.get('/api/v1/vitals/emergency/hospitals', {
        params: {
          latitude: lat,
          longitude: lon,
          radius_miles: radius,
          emergency_only: erOnly,
        },
      })
      const found = res.data?.facilities || []
      setFacilities(found)
      setResolvedOrigin(res.data?.origin || null)
      setLastSearchedLocation(res.data?.origin?.label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`)
      setHasSearched(true)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Unable to retrieve nearby hospitals. Please try again.'
      setLocationError(errorMsg)
      setFacilities([])
      setHasSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const searchByQuery = async (queryText: string, radius: number = radiusMiles, erOnly: boolean = filterEROnly) => {
    const clean = queryText.trim()
    if (!clean) {
      setLocationError('Please enter a valid 5-digit US ZIP code or city (e.g. 37067 or Franklin, TN).')
      return
    }

    try {
      setLoading(true)
      setLocationError(null)
      const res = await api.get('/api/v1/vitals/emergency/hospitals', {
        params: {
          query: clean,
          radius_miles: radius,
          emergency_only: erOnly,
        },
      })

      const found = res.data?.facilities || []
      setFacilities(found)
      setResolvedOrigin(res.data?.origin || null)
      setLastSearchedLocation(res.data?.origin?.label || clean)
      setHasSearched(true)
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Unable to retrieve nearby hospitals. Please try again.'
      setLocationError(errorMsg)
      setFacilities([])
      setHasSearched(true)
    } finally {
      setLoading(false)
    }
  }

  // Load Franklin, TN (37067) on initial mount
  useEffect(() => {
    searchByQuery('37067', 25, false)
  }, [])

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchByQuery(searchQuery, radiusMiles, filterEROnly)
  }

  const handleRadiusChange = (newRadius: number) => {
    setRadiusMiles(newRadius)
    if (currentCoords && locationStatus === 'granted') {
      fetchNearbyByCoords(currentCoords.lat, currentCoords.lon, newRadius, filterEROnly)
    } else if (searchQuery.trim()) {
      searchByQuery(searchQuery, newRadius, filterEROnly)
    }
  }

  const handleERFilterToggle = (checked: boolean) => {
    setFilterEROnly(checked)
    if (currentCoords && locationStatus === 'granted') {
      fetchNearbyByCoords(currentCoords.lat, currentCoords.lon, radiusMiles, checked)
    } else if (searchQuery.trim()) {
      searchByQuery(searchQuery, radiusMiles, checked)
    }
  }

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
              Accurate Location Discovery
            </span>
          </div>
          <h2 className="page-title">Nearby Hospitals & Emergency Departments</h2>
          <p className="page-subtitle">
            Find verified trauma centers and 24/7 hospital emergency rooms using accurate geocoding and real distance calculations.
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

      {/* Search Bar, Radius Selector & Filter Options */}
      <div
        className="glass"
        style={{
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Text/ZIP Search Form */}
          <form onSubmit={handleManualSearch} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(10,22,40,0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '8px 14px',
                flex: 1,
              }}
            >
              <Search size={16} color="#64748b" />
              <input
                type="text"
                placeholder="Enter 5-digit ZIP code or City, State (e.g., 37067 or Franklin, TN)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-secondary" style={{ padding: '8px 20px', fontWeight: 600 }}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <span>Search</span>}
            </button>
          </form>

          {/* Radius Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={14} color="#94a3b8" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Radius:</span>
            <select
              value={radiusMiles}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              style={{
                background: 'rgba(10,22,40,0.85)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles (Default)</option>
              <option value={50}>50 miles</option>
              <option value={100}>100 miles</option>
            </select>
          </div>

          {/* 24/7 Emergency Department Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterEROnly}
                onChange={(e) => handleERFilterToggle(e.target.checked)}
                style={{ accentColor: '#38bdf8', width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 500 }}>24/7 Emergency Departments Only</span>
            </label>
          </div>
        </div>

        {/* Quick Search Test Location Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Test Locations:</span>
          {[
            { label: 'Franklin, TN (37067)', val: '37067' },
            { label: 'Brentwood, TN (37027)', val: '37027' },
            { label: 'Chicago, IL (60611)', val: '60611' },
            { label: 'New York, NY (10001)', val: '10001' },
          ].map((chip) => (
            <button
              key={chip.val}
              type="button"
              onClick={() => {
                setSearchQuery(chip.val)
                searchByQuery(chip.val, radiusMiles, filterEROnly)
              }}
              style={{
                background: searchQuery === chip.val ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                border: searchQuery === chip.val ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: searchQuery === chip.val ? '#38bdf8' : '#cbd5e1',
                padding: '3px 10px',
                borderRadius: 14,
                fontSize: '0.74rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location Status / Error Alert */}
      {locationError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#fecaca',
            fontSize: '0.85rem',
          }}
        >
          <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
          <span>{locationError}</span>
        </div>
      )}

      {/* Active Location & Distance Context Indicator */}
      {lastSearchedLocation && !loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '8px 16px',
            background: 'rgba(15,23,42,0.6)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.8rem',
            color: '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} color="#38bdf8" />
            <span>
              Showing results for: <strong style={{ color: '#f8fafc' }}>{lastSearchedLocation}</strong>
              {resolvedOrigin?.latitude && resolvedOrigin?.longitude && (
                <span style={{ color: '#64748b', marginLeft: 6 }}>
                  ({resolvedOrigin.latitude.toFixed(4)}° N, {resolvedOrigin.longitude.toFixed(4)}° W)
                </span>
              )}
            </span>
          </div>
          <div>
            Search Radius: <strong style={{ color: '#38bdf8' }}>{radiusMiles} miles</strong> • Found: <strong style={{ color: '#10b981' }}>{facilities.length}</strong> facilities
          </div>
        </div>
      )}

      {/* Hospital Facilities Grid */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <RefreshCw size={28} className="animate-spin mx-auto mb-3" color="#38bdf8" />
          <div style={{ fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 600 }}>Querying regional medical centers and verified emergency departments…</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6 }}>Resolving geographic coordinates and computing exact Haversine distances</div>
        </div>
      ) : facilities.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          {facilities.map((hospital) => (
            <div
              key={hospital.id}
              className="glass"
              style={{
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: hospital.has_emergency_department ? '1px solid rgba(56,189,248,0.25)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: hospital.has_emergency_department ? '0 4px 20px rgba(14,165,233,0.08)' : 'none',
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
                        fontSize: '0.78rem',
                        color: '#38bdf8',
                        fontWeight: 700,
                        background: 'rgba(14,165,233,0.1)',
                        padding: '2px 8px',
                        borderRadius: 6,
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
                    {hospital.address}, {hospital.city}, {hospital.state} {hospital.postal_code || hospital.zip_code || ''}
                  </div>
                </div>

                {/* Opening Hours Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: '0.75rem', fontWeight: 500, marginBottom: 12 }}>
                  <Clock size={13} />
                  <span>{hospital.opening_hours}</span>
                </div>

                {/* Data Source Badge */}
                {hospital.data_source && (
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 14 }}>
                    Source: <span style={{ color: '#94a3b8' }}>{hospital.data_source}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Genuine Call Desk & Google Maps Directions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {hospital.phone ? (
                  <a
                    href={`tel:${hospital.phone.replace(/[^0-9+]/g, '')}`}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.78rem', textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <Phone size={13} />
                    <span>Call Desk</span>
                  </a>
                ) : (
                  <a
                    href="tel:911"
                    className="btn-secondary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.78rem', textDecoration: 'none', justifyContent: 'center' }}
                  >
                    <Phone size={13} />
                    <span>Call 911</span>
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
      ) : hasSearched ? (
        <div className="glass" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <Building2 size={36} color="#64748b" className="mx-auto mb-3" />
          <h3 style={{ color: '#cbd5e1', margin: '0 0 6px' }}>No healthcare facilities found within {radiusMiles} miles</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 440, margin: '0 auto 18px' }}>
            There are no verified hospitals matching your criteria in this search radius. Try expanding the search radius or disabling the 24/7 ER filter.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => handleRadiusChange(50)}
              className="btn-secondary"
              style={{ fontSize: '0.82rem' }}
            >
              Expand Radius to 50 miles
            </button>
            {filterEROnly && (
              <button
                onClick={() => handleERFilterToggle(false)}
                className="btn-secondary"
                style={{ fontSize: '0.82rem' }}
              >
                Include All Healthcare Facilities
              </button>
            )}
          </div>
        </div>
      ) : null}

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
