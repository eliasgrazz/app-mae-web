'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase, type Location, type Config, type Geofence } from '@/lib/supabase'
import { format, subHours } from 'date-fns'

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false })

const toInputDate = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

const emptyGeofence = (): Partial<Geofence> => ({
  name: '',
  latitude: undefined,
  longitude: undefined,
  radius_meters: 200,
  tag_local: '',
  interval_minutes: 5,
  enabled: true,
})

export default function MapPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [config, setConfig] = useState<Config | null>(null)
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [requestingLocation, setRequestingLocation] = useState(false)
  const [triggeringAlarm, setTriggeringAlarm] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'geofences' | 'config'>('history')

  // Estado do formulário de cerca
  const [editingGeofence, setEditingGeofence] = useState<Partial<Geofence> | null>(null)
  const [pickingGeofence, setPickingGeofence] = useState(false)
  const [savingGeofence, setSavingGeofence] = useState(false)

  const now = new Date()
  const [startDate, setStartDate] = useState(toInputDate(subHours(now, 6)))
  const [endDate, setEndDate] = useState(toInputDate(now))

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
      const filtered: Location[] = []
      let lastTag: string | null = null
      for (const loc of data as Location[]) {
        if (loc.tag_local) {
          if (loc.tag_local !== lastTag) filtered.push(loc)
          else filtered[filtered.length - 1] = loc
          lastTag = loc.tag_local
        } else {
          filtered.push(loc)
          lastTag = null
        }
      }
      setLocations(filtered)
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

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single()
    if (data) setConfig(data as Config)
  }, [])

  const fetchGeofences = useCallback(async () => {
    const { data } = await supabase.from('geofences').select('*').order('created_at', { ascending: true })
    if (data) setGeofences(data as Geofence[])
  }, [])

  useEffect(() => {
    checkAuth()
    fetchCurrent()
    fetchLocations()
    fetchConfig()
    fetchGeofences()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchCurrent()
    }, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchCurrent])

  async function requestLocationNow() {
    setRequestingLocation(true)
    await supabase.from('commands').insert({ type: 'send_location_now', status: 'pending' })
    setTimeout(() => {
      fetchCurrent()
      setRequestingLocation(false)
    }, 35000)
  }

  async function triggerAlarm() {
    setTriggeringAlarm(true)
    await supabase.from('commands').insert({ type: 'play_alarm', status: 'pending' })
    setTimeout(() => setTriggeringAlarm(false), 35000)
  }

  async function saveDefaultInterval() {
    if (!config) return
    await supabase.from('config').update({
      default_interval_minutes: config.default_interval_minutes,
      alarm_duration_seconds: config.alarm_duration_seconds,
    }).eq('id', 1)
    alert('Configurações salvas!')
  }

  function handleMapClick(lat: number, lng: number) {
    if (!pickingGeofence || !editingGeofence) return
    setEditingGeofence({ ...editingGeofence, latitude: lat, longitude: lng })
    setPickingGeofence(false)
  }

  async function saveGeofence() {
    const g = editingGeofence
    if (!g || !g.name || !g.latitude || !g.longitude || !g.tag_local) {
      alert('Preencha todos os campos e defina o centro no mapa.')
      return
    }
    setSavingGeofence(true)
    if (g.id) {
      await supabase.from('geofences').update({
        name: g.name, latitude: g.latitude, longitude: g.longitude,
        radius_meters: g.radius_meters, tag_local: g.tag_local,
        interval_minutes: g.interval_minutes, enabled: g.enabled,
      }).eq('id', g.id)
    } else {
      await supabase.from('geofences').insert({
        name: g.name, latitude: g.latitude, longitude: g.longitude,
        radius_meters: g.radius_meters, tag_local: g.tag_local,
        interval_minutes: g.interval_minutes, enabled: g.enabled ?? true,
      })
    }
    setSavingGeofence(false)
    setEditingGeofence(null)
    fetchGeofences()
  }

  async function deleteGeofence(id: number) {
    if (!confirm('Deletar esta cerca eletrônica?')) return
    await supabase.from('geofences').delete().eq('id', id)
    fetchGeofences()
  }

  async function toggleGeofence(gf: Geofence) {
    await supabase.from('geofences').update({ enabled: !gf.enabled }).eq('id', gf.id)
    fetchGeofences()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const tabHistory = (
    <>
      <h3 style={styles.sectionTitle}>Filtrar histórico</h3>
      <label style={styles.label}>De</label>
      <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} style={styles.input} />
      <label style={styles.label}>Até</label>
      <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.input} />
      <button onClick={fetchLocations} style={styles.btnPrimary} disabled={loading}>
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
    </>
  )

  const tabGeofences = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>Cercas eletrônicas</h3>
        <button onClick={() => setEditingGeofence(emptyGeofence())} style={styles.btnGreen}>+ Nova</button>
      </div>

      {geofences.length === 0 && (
        <div style={styles.countInfo}>Nenhuma cerca cadastrada.</div>
      )}

      {geofences.map(gf => (
        <div key={gf.id} style={{ ...styles.geofenceCard, opacity: gf.enabled ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={styles.geofenceName}>{gf.name}</div>
              <div style={styles.geofenceDetail}>Tag: {gf.tag_local}</div>
              <div style={styles.geofenceDetail}>Raio: {gf.radius_meters}m · {gf.interval_minutes} min</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => toggleGeofence(gf)} style={styles.btnIcon} title={gf.enabled ? 'Desativar' : 'Ativar'}>
                {gf.enabled ? '🟢' : '⚫'}
              </button>
              <button onClick={() => setEditingGeofence({ ...gf })} style={styles.btnIcon} title="Editar">✏️</button>
              <button onClick={() => deleteGeofence(gf.id)} style={styles.btnIcon} title="Deletar">🗑️</button>
            </div>
          </div>
        </div>
      ))}

      {editingGeofence && (
        <div style={styles.formCard}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#333' }}>
            {editingGeofence.id ? 'Editar cerca' : 'Nova cerca'}
          </h4>

          <label style={styles.label}>Nome</label>
          <input value={editingGeofence.name ?? ''} onChange={e => setEditingGeofence({ ...editingGeofence, name: e.target.value })} style={styles.input} placeholder="Ex: Casa" />

          <label style={styles.label}>Tag-Local</label>
          <input value={editingGeofence.tag_local ?? ''} onChange={e => setEditingGeofence({ ...editingGeofence, tag_local: e.target.value })} style={styles.input} placeholder="Ex: Casa CXS" />

          <button
            onClick={() => setPickingGeofence(true)}
            style={{ ...styles.btnPrimary, background: pickingGeofence ? '#f59e0b' : '#22c55e', marginBottom: 8 }}
          >
            {pickingGeofence ? '🖱️ Clique no mapa...' : '📍 Definir centro no mapa'}
          </button>

          {editingGeofence.latitude && (
            <div style={styles.countInfo}>
              {editingGeofence.latitude.toFixed(5)}, {editingGeofence.longitude?.toFixed(5)}
            </div>
          )}

          <label style={styles.label}>Raio (metros)</label>
          <input type="text" inputMode="numeric" value={editingGeofence.radius_meters ?? 200}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setEditingGeofence({ ...editingGeofence, radius_meters: v === '' ? 0 : parseInt(v) })
            }}
            style={styles.input} />

          <label style={styles.label}>Intervalo dentro da cerca (minutos)</label>
          <input type="text" inputMode="numeric" value={editingGeofence.interval_minutes ?? 5}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setEditingGeofence({ ...editingGeofence, interval_minutes: v === '' ? 0 : parseInt(v) })
            }}
            style={styles.input} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveGeofence} style={{ ...styles.btnGreen, flex: 1 }} disabled={savingGeofence}>
              {savingGeofence ? 'Salvando...' : '💾 Salvar'}
            </button>
            <button onClick={() => { setEditingGeofence(null); setPickingGeofence(false) }} style={{ ...styles.btnCancel, flex: 1 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )

  const tabConfig = (
    <>
      <h3 style={styles.sectionTitle}>Configurações</h3>
      {config && (
        <>
          <label style={styles.label}>Intervalo padrão de GPS (minutos)</label>
          <input type="text" inputMode="numeric" value={config.default_interval_minutes}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setConfig({ ...config, default_interval_minutes: v === '' ? 0 : parseInt(v) })
            }}
            style={styles.input} />

          <label style={styles.label}>Duração do alarme de chamada (segundos)</label>
          <input type="text" inputMode="numeric" value={config.alarm_duration_seconds ?? 30}
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setConfig({ ...config, alarm_duration_seconds: v === '' ? 0 : parseInt(v) })
            }}
            style={styles.input} />

          <button onClick={saveDefaultInterval} style={styles.btnGreen}>💾 Salvar configurações</button>
        </>
      )}
      <hr style={{ margin: '16px 0', borderColor: '#eee' }} />
      <label style={styles.autoRefreshLabel}>
        <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ marginRight: 8 }} />
        Atualizar automaticamente
      </label>
    </>
  )

  const sidebar = (
    <>
      {currentLocation && (
        <div style={styles.statusCard}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={styles.statusDot} />
            <div>
              <div style={styles.statusLabel}>Última posição</div>
              <div style={styles.statusTime}>
                {format(new Date(currentLocation.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                {currentLocation.battery_level != null && <span style={styles.batteryInline}> 🔋 {currentLocation.battery_level}%</span>}
              </div>
            </div>
          </div>
          <div style={styles.legend}>
            <span style={styles.legendItem}><span style={styles.legendDotRed} /><span style={styles.legendText}>Cerca eletrônica</span></span>
            <span style={styles.legendItem}><span style={styles.legendDotBlue} /><span style={styles.legendText}>Histórico</span></span>
          </div>
        </div>
      )}

      <div style={{ display: 'none' }}>
      </div>

      <button onClick={requestLocationNow} style={styles.btnBlue} disabled={requestingLocation}>
        {requestingLocation ? '⏳ Aguardando...' : '📡 Verificar Posição Agora'}
      </button>

      <button onClick={triggerAlarm} style={styles.btnAlarm} disabled={triggeringAlarm}>
        {triggeringAlarm ? '⏳ Aguardando...' : '🔔 Alarme de Chamada'}
      </button>

      <hr style={{ margin: '12px 0', borderColor: '#eee' }} />

      <div style={styles.tabs}>
        {(['history', 'geofences', 'config'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}>
            {tab === 'history' ? '🗺️ Mapa' : tab === 'geofences' ? '📍 Cercas' : '⚙️ Config'}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {activeTab === 'history' && tabHistory}
        {activeTab === 'geofences' && tabGeofences}
        {activeTab === 'config' && tabConfig}
      </div>

      <hr style={{ margin: '16px 0', borderColor: '#eee' }} />
      <button onClick={handleLogout} style={styles.btnLogout}>Sair</button>
    </>
  )

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={styles.mobileHeader}>
          <span style={styles.mobileTitle}>App Mãe</span>
          {currentLocation && (
            <span style={styles.mobileStatus}>
              🟢 {format(new Date(currentLocation.timestamp), 'HH:mm')}
              {currentLocation.battery_level != null && `  🔋${currentLocation.battery_level}%`}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={requestLocationNow}
              disabled={requestingLocation}
              style={styles.mobileIconBtn}
              title="Verificar Posição Agora"
            >
              {requestingLocation ? '⏳' : '📡'}
            </button>
            <button
              onClick={triggerAlarm}
              disabled={triggeringAlarm}
              style={styles.mobileIconBtn}
              title="Alarme de Chamada"
            >
              {triggeringAlarm ? '⏳' : '🔔'}
            </button>
            <button onClick={() => setShowPanel(!showPanel)} style={styles.mobileMenuBtn}>
              {showPanel ? '✕' : '☰'}
            </button>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView
            locations={locations}
            currentLocation={currentLocation}
            geofences={geofences}
            pickingGeofence={pickingGeofence}
            onMapClick={handleMapClick}
          />
        </div>
        {showPanel && (
          <div style={styles.mobilePanel}>{sidebar}</div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>App Mãe</h2>
        {sidebar}
      </div>
      <div style={styles.mapWrapper}>
        <MapView
          locations={locations}
          currentLocation={currentLocation}
          geofences={geofences}
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
    width: 300, background: '#fff', borderRight: '1px solid #eee',
    padding: '20px 16px', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', flexShrink: 0, boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
  },
  sidebarTitle: { fontSize: 22, fontWeight: 700, marginBottom: 16, color: '#333' },
  statusCard: {
    display: 'flex', flexDirection: 'column', gap: 8,
    background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: '50%', background: '#22c55e', marginTop: 4, flexShrink: 0 },
  statusLabel: { fontSize: 12, color: '#666', fontWeight: 600 },
  statusTime: { fontSize: 13, color: '#333', fontWeight: 500 },
  battery: { fontSize: 12, color: '#666', marginTop: 2 },
  batteryInline: { fontSize: 18, color: '#555', marginLeft: 6 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4, display: 'block' },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1.5px solid #ddd', fontSize: 13, marginBottom: 10, outline: 'none',
    boxSizing: 'border-box',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 4 },
  tab: {
    flex: 1, padding: '8px 4px', fontSize: 12, border: '1px solid #ddd',
    borderRadius: 6, background: '#f8f8f8', cursor: 'pointer', fontWeight: 500,
  },
  tabActive: { background: '#667eea', color: '#fff', border: '1px solid #667eea' },
  btnPrimary: {
    width: '100%', padding: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  btnBlue: {
    width: '100%', padding: '10px', background: '#60a5fa',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  btnAlarm: {
    width: '100%', padding: '10px', background: '#f87171',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginBottom: 8,
  },
  btnGreen: {
    padding: '8px 14px', background: '#22c55e',
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
  },
  btnCancel: {
    padding: '8px 14px', background: '#f3f4f6',
    color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  btnIcon: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px' },
  countInfo: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  quickFilters: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  quickLabel: { fontSize: 12, color: '#888' },
  quickBtn: { padding: '4px 10px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, background: '#f8f8f8', cursor: 'pointer' },
  geofenceCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8,
    padding: '10px 12px', marginBottom: 8,
  },
  geofenceName: { fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 2 },
  geofenceDetail: { fontSize: 11, color: '#666' },
  formCard: {
    background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
    padding: 12, marginTop: 8,
  },
  autoRefreshLabel: { fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: 16 },
  btnLogout: {
    marginTop: 8, padding: '10px', background: '#fff',
    color: '#e53e3e', border: '1.5px solid #e53e3e', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  mapWrapper: { flex: 1, position: 'relative' },
  legend: { display: 'flex', gap: 12, justifyContent: 'center', borderTop: '1px solid #86efac', paddingTop: 8 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  legendDotRed: { width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0 },
  legendDotBlue: { width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 },
  legendText: { fontSize: 12, color: '#555', fontWeight: 500 },
  mobileHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)', zIndex: 10, flexShrink: 0,
  },
  mobileTitle: { fontSize: 18, fontWeight: 700, color: '#333' },
  mobileStatus: { fontSize: 12, color: '#555' },
  mobileMenuBtn: { fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#333', padding: '4px 8px' },
  mobileIconBtn: { fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' },
  mobilePanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: '#fff', borderTop: '1px solid #eee',
    padding: '16px', overflowY: 'auto', maxHeight: '65vh',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 1000,
  },
}
