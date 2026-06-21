'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Location, Geofence } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'


const makeIcon = (cssColor: string) => L.divIcon({
  className: '',
  html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41C12.5 41 25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${cssColor}" stroke="white" stroke-width="1.5"/>
  </svg>`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const currentIcon = makeIcon('#22c55e')
const geofenceIcon = makeIcon('#ef4444')
const historyIcon = makeIcon('#3b82f6')

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 })
  }, [lat, lng, map])
  return null
}

function MapClickHandler({ onMapClick, active }: { onMapClick: (lat: number, lng: number) => void; active: boolean }) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

type Props = {
  locations: Location[]
  currentLocation: Location | null
  geofences: Geofence[]
  pickingGeofence: boolean
  onMapClick: (lat: number, lng: number) => void
}

export default function MapView({ locations, currentLocation, geofences, pickingGeofence, onMapClick }: Props) {
  const casaGeofence = geofences.find(g => g.name.toLowerCase().includes('casa')) ?? geofences[0]
  const center: [number, number] = casaGeofence
    ? [casaGeofence.latitude, casaGeofence.longitude]
    : currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : [-15.8267, -47.9218]

  const path: [number, number][] = locations.map(l => [l.latitude, l.longitude])

  return (
    <MapContainer center={center} zoom={15} style={{ width: '100%', height: '100%', cursor: pickingGeofence ? 'crosshair' : '' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <MapClickHandler onMapClick={onMapClick} active={pickingGeofence} />

      {path.length > 1 && (
        <Polyline positions={path} color="#764ba2" weight={3} opacity={0.7} />
      )}

      {currentLocation && (
        <>
          <FlyTo lat={currentLocation.latitude} lng={currentLocation.longitude} />
          <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={currentIcon} interactive={!pickingGeofence} zIndexOffset={2000}>
            <Tooltip permanent direction="top" offset={[0, 10]} opacity={1}>
              {format(new Date(currentLocation.timestamp), "HH:mm", { locale: ptBR })}
            </Tooltip>
            <Popup>
              <strong>Posição atual</strong><br />
              {format(new Date(currentLocation.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
              {currentLocation.battery_level != null && `Bateria: ${currentLocation.battery_level}%`}
            </Popup>
          </Marker>
        </>
      )}

      {!pickingGeofence && locations.slice(0, -1).map(loc => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={historyIcon} zIndexOffset={500}>
          <Tooltip permanent direction="top" offset={[0, 10]} opacity={1}>
            {format(new Date(loc.timestamp), "HH:mm", { locale: ptBR })}
          </Tooltip>
          <Popup>
            {loc.tag_local ? (
              <>
                <strong>{loc.tag_local}</strong><br />
                🟢 Entrada: {format(new Date(loc.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
                🔴 Saída: {format(new Date(loc.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
                {loc.battery_level != null && `🔋 Bateria: ${loc.battery_level}%`}
              </>
            ) : (
              <>
                {format(new Date(loc.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
                {loc.battery_level != null && `🔋 Bateria: ${loc.battery_level}%`}
              </>
            )}
          </Popup>
        </Marker>
      ))}

      {geofences.map(gf => (
        <div key={gf.id}>
          <Marker position={[gf.latitude, gf.longitude]} icon={geofenceIcon} zIndexOffset={-1000}>
            <Popup>
              <strong>{gf.name}</strong><br />
              Tag: {gf.tag_local}<br />
              Raio: {gf.radius_meters}m<br />
              Intervalo: {gf.interval_minutes} min
            </Popup>
          </Marker>
          <Circle
            center={[gf.latitude, gf.longitude]}
            radius={gf.radius_meters}
            pathOptions={{ color: gf.enabled ? '#ef4444' : '#aaa', fillOpacity: 0.1 }}
          />
        </div>
      ))}
    </MapContainer>
  )
}
