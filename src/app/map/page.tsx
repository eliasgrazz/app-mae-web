'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase, type Location, type Config } from '@/lib/supabase'
import { format, subHours } from 'date-fns'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

const toInputDate = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

export default function MapPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [config, setConfig] = useState<Config | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [pickingGeofence, setPickingGeofence] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

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

    if (!error && data) setLocations(data as Location[])
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

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single()
    if (data) setConfig(data as Config)
  }, [])

  useEffect(() => {
    checkAuth()
    fetchCurrent()
    fetchLocations()
    fetchConfig()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchCurrent()
      fetchConfig()
    }, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchCurrent, fetchConfig])

  async function saveConfig() {
    if (!config) return
    setSavingConfig(true)
    await supabase.from('config').update({
      interval_minutes: config.interval_minutes,
      geofence_enabled: config.geofence_enabled,
      geofence_lat: config.geofence_lat,
      geofence_lng: config.geofence_lng,
      geofence_radius_meters: config.geofence_radius_meters,
      geofence_interval_minutes: config.geofence_interval_minutes,
    }).eq('id', 1)
    setSavingConfig(false)
    setPickingGeofence(false)
    alert('Configurações salvas!')
  }

  function handleMapClick(lat: number, lng: number) {
    if (!pickingGeofence || !config) return
    setConfig({ ...config, geofence_lat: lat, geofence_lng: lng })
    setPickingGeofence(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>App Mãe</h2>

        {currentLocation && (
          <div style={styles.statusCard}>
            <div style={styles.statusDot} />
            <div>
              <div style={styles.statusLabel}>Última posição</div>
              <div style={styles.statusTime}>
                {format(new Date(currentLocation.timestamp), 'dd/MM/yyyy HH:mm:ss')}
              </div>
              {currentLocation.battery_level != null && (
                <div style={styles.battery}>🔋 {currentLocation.battery_level}%</div>
              )}
            </div>
          </div>
        )}

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        {/* Filtro de histórico */}
        <h3 style={styles.sectionTitle}>Filtrar histórico</h3>
        <label style={styles.label}>De</label>
        <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} />
        <label style={styles.label}>Até</label>
        <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} />
        <button onClick={fetchLocations} style={styles.btnSearch} disabled={loading}>
          {loading ? 'Buscando...' : '🔍 Buscar trajeto'}
        </button>
        <div style={styles.countInfo}>{locations.length} pontos encontrados</div>
        <div style={styles.quickFilters}>
          <span style={styles.quickLabel}>Atalhos:</span>
          {[1, 6, 24].map(h => (
            <button key={h} style={styles.quickBtn} onClick={() => {
              setStartDate(toInputDate(subHours(new Date(), h)))
              setEndDate(toInputDate(new Date()))
            }}>{h}h</button>
          ))}
        </div>

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        {/* Configurações */}
        <button onClick={() => setShowConfig(!showConfig)} style={styles.btnToggleConfig}>
          ⚙️ Configurações {showConfig ? '▲' : '▼'}
        </button>

        {showConfig && config && (
          <div style={styles.configPanel}>
            <label style={styles.label}>Intervalo normal (minutos)</label>
            <input
              type="number" min={1} value={config.interval_minutes}
              onChange={e => setConfig({ ...config, interval_minutes: parseInt(e.target.value) || 1 })}
              style={styles.input}
            />

            <hr style={{ margin: '12px 0', borderColor: '#eee' }} />

            <div style={styles.switchRow}>
              <label style={styles.label}>Cerca virtual</label>
              <input
                type="checkbox" checked={config.geofence_enabled}
                onChange={e => setConfig({ ...config, geofence_enabled: e.target.checked })}
              />
            </div>

            {config.geofence_enabled && (
              <>
                <button
                  onClick={() => setPickingGeofence(true)}
                  style={{ ...styles.btnSearch, background: pickingGeofence ? '#f59e0b' : '#22c55e', marginBottom: 8 }}
                >
                  {pickingGeofence ? '🖱️ Clique no mapa...' : '📍 Definir centro no mapa'}
                </button>

                {config.geofence_lat && (
                  <div style={styles.countInfo}>
                    Centro: {config.geofence_lat.toFixed(5)}, {config.geofence_lng?.toFixed(5)}
                  </div>
                )}

                <label style={styles.label}>Raio (metros)</label>
                <input
                  type="number" min={50} value={config.geofence_radius_meters}
                  onChange={e => setConfig({ ...config, geofence_radius_meters: parseInt(e.target.value) || 500 })}
                  style={styles.input}
                />

                <label style={styles.label}>Intervalo fora da cerca (minutos)</label>
                <input
                  type="number" min={1} value={config.geofence_interval_minutes}
                  onChange={e => setConfig({ ...config, geofence_interval_minutes: parseInt(e.target.value) || 1 })}
                  style={styles.input}
                />
              </>
            )}

            <button onClick={saveConfig} style={styles.btnSave} disabled={savingConfig}>
              {savingConfig ? 'Salvando...' : '💾 Salvar configurações'}
            </button>
          </div>
        )}

        <hr style={{ margin: '16px 0', borderColor: '#eee' }} />

        <label style={styles.autoRefreshLabel}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ marginRight: 8 }} />
          Atualizar automaticamente
        </label>

        <button onClick={handleLogout} style={styles.btnLogout}>Sair</button>
      </div>

      <div style={styles.mapWrapper}>
        <MapView
          locations={locations}
          currentLocation={currentLocation}
          config={config}
          pickingGeofence={pickingGeofence}
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: {
    width: 280, background: '#fff', borderRight: '1px solid #eee',
    padding: '20px 16px', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
  },
  sidebarTitle: { fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#333' },
  statusCard: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginTop: 4, flexShrink: 0 },
  statusLabel: { fontSize: 12, color: '#666', fontWeight: 600 },
  statusTime: { fontSize: 13, color: '#333', fontWeight: 500 },
  battery: { fontSize: 12, color: '#666', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1.5px solid #ddd', fontSize: 13, marginBottom: 10, outline: 'none',
    boxSizing: 'border-box',
  },
  btnSearch: {
    width: '100%', padding: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  countInfo: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  quickFilters: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  quickLabel: { fontSize: 12, color: '#888' },
  quickBtn: { padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, background: '#f8f8f8', cursor: 'pointer' },
  btnToggleConfig: {
    width: '100%', padding: '10px', background: '#f3f4f6',
    color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8, textAlign: 'left',
  },
  configPanel: { background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 8 },
  switchRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  btnSave: {
    width: '100%', padding: '10px', background: '#22c55e',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginTop: 4,
  },
  autoRefreshLabel: { fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 16 },
  btnLogout: {
    marginTop: 'auto', padding: '10px', background: '#fff',
    color: '#e53e3e', border: '1.5px solid #e53e3e', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  mapWrapper: { flex: 1, position: 'relative' },
}
