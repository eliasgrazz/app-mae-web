'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Location, Geofence } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const makeIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const currentIcon = makeIcon('green')
const geofenceIcon = makeIcon('red')
const historyIcon = makeIcon('blue')

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
  const center: [number, number] = currentLocation
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
          <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={currentIcon} interactive={!pickingGeofence}>
            <Popup>
              <strong>Posição atual</strong><br />
              {format(new Date(currentLocation.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
              {currentLocation.battery_level != null && `Bateria: ${currentLocation.battery_level}%`}
            </Popup>
          </Marker>
        </>
      )}

      {!pickingGeofence && locations.slice(0, -1).map(loc => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={historyIcon}>
          <Popup>
            {format(new Date(loc.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
            {loc.battery_level != null && `Bateria: ${loc.battery_level}%`}
            {loc.tag_local && <><br />{loc.tag_local}</>}
          </Popup>
        </Marker>
      ))}

      {geofences.map(gf => (
        <div key={gf.id}>
          <Marker position={[gf.latitude, gf.longitude]} icon={geofenceIcon}>
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
