'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase, type Location } from '@/lib/supabase'
import { format, subHours } from 'date-fns'

// Leaflet só funciona no browser, não no servidor
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

const toInputDate = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

export default function MapPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const now = new Date()
  const [startDate, setStartDate] = useState(toInputDate(subHours(now, 6)))
  const [endDate, setEndDate] = useState(toInputDate(now))

  async function checkAuth() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) router.push('/')
  }

  const fetchLocations = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .gte('timestamp', new Date(startDate).toISOString())
      .lte('timestamp', new Date(endDate).toISOString())
      .order('timestamp', { ascending: true })

    if (!error && data) {
      setLocations(data as Location[])
    }
    setLoading(false)
  }, [startDate, endDate])

  const fetchCurrent = useCallback(async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (data) setCurrentLocation(data as Location)
  }, [])

  useEffect(() => {
    checkAuth()
    fetchCurrent()
    fetchLocations()
  }, [])

  // Auto-refresh a cada 60 segundos
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchCurrent()
    }, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchCurrent])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>App Mãe</h2>

        {/* Status atual */}
        {currentLocation && (
          <div style={styles.statusCard}>
            <div style={styles.statusDot} />
            <div>
              <div style={styles.statusLabel}>Última posição</div>
              <div style={styles.statusTime}>
                {format(new Date(currentLocation.timestamp), 'dd/MM/yyyy HH:mm:ss')}
              </div>
              {currentLocation.battery_level != null && (
                <div style={styles.battery}>
                  🔋 {currentLocation.battery_level}%
                </div>
              )}
            </div>
          </div>
        )}

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        {/* Filtro de histórico */}
        <h3 style={styles.filterTitle}>Filtrar histórico</h3>

        <label style={styles.label}>De</label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          style={styles.input}
        />

        <label style={styles.label}>Até</label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          style={styles.input}
        />

        <button onClick={fetchLocations} style={styles.btnSearch} disabled={loading}>
          {loading ? 'Buscando...' : '🔍 Buscar trajeto'}
        </button>

        <div style={styles.countInfo}>
          {locations.length} pontos encontrados
        </div>

        {/* Atalhos rápidos */}
        <div style={styles.quickFilters}>
          <span style={styles.quickLabel}>Atalhos:</span>
          <button style={styles.quickBtn} onClick={() => {
            setStartDate(toInputDate(subHours(new Date(), 1)))
            setEndDate(toInputDate(new Date()))
          }}>1h</button>
          <button style={styles.quickBtn} onClick={() => {
            setStartDate(toInputDate(subHours(new Date(), 6)))
            setEndDate(toInputDate(new Date()))
          }}>6h</button>
          <button style={styles.quickBtn} onClick={() => {
            setStartDate(toInputDate(subHours(new Date(), 24)))
            setEndDate(toInputDate(new Date()))
          }}>24h</button>
        </div>

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        <label style={styles.autoRefreshLabel}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Atualizar posição automaticamente
        </label>

        <button onClick={handleLogout} style={styles.btnLogout}>
          Sair
        </button>
      </div>

      {/* Mapa */}
      <div style={styles.mapWrapper}>
        <MapView locations={locations} currentLocation={currentLocation} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  sidebar: {
    width: 280,
    background: '#fff',
    borderRight: '1px solid #eee',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
    boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 16,
    color: '#333',
  },
  statusCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: 8,
    padding: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#22c55e',
    marginTop: 4,
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 600,
  },
  statusTime: {
    fontSize: 13,
    color: '#333',
    fontWeight: 500,
  },
  battery: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#555',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    marginBottom: 4,
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1.5px solid #ddd',
    fontSize: 13,
    marginBottom: 10,
    outline: 'none',
  },
  btnSearch: {
    width: '100%',
    padding: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: 8,
  },
  countInfo: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 12,
  },
  quickFilters: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  quickLabel: {
    fontSize: 12,
    color: '#888',
  },
  quickBtn: {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #ddd',
    borderRadius: 6,
    background: '#f8f8f8',
    cursor: 'pointer',
  },
  autoRefreshLabel: {
    fontSize: 13,
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    marginBottom: 16,
  },
  btnLogout: {
    marginTop: 'auto',
    padding: '10px',
    background: '#fff',
    color: '#e53e3e',
    border: '1.5px solid #e53e3e',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
}
