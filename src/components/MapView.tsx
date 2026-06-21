'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Location, Config } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const currentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

const geofenceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 })
  }, [lat, lng, map])
  return null
}

function MapClickHandler({ onMapClick, active }: { onMapClick: (lat: number, lng: number) => void, active: boolean }) {
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
  config: Config | null
  pickingGeofence: boolean
  onMapClick: (lat: number, lng: number) => void
}

export default function MapView({ locations, currentLocation, config, pickingGeofence, onMapClick }: Props) {
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
          <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={currentIcon}>
            <Popup>
              <strong>Posição atual</strong><br />
              {format(new Date(currentLocation.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
              {currentLocation.battery_level != null && `Bateria: ${currentLocation.battery_level}%`}
            </Popup>
          </Marker>
        </>
      )}

      {locations.slice(0, -1).map(loc => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
          <Popup>
            {format(new Date(loc.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
            {loc.battery_level != null && `Bateria: ${loc.battery_level}%`}
          </Popup>
        </Marker>
      ))}

      {config?.geofence_lat && config?.geofence_lng && (
        <>
          <Marker position={[config.geofence_lat, config.geofence_lng]} icon={geofenceIcon}>
            <Popup>Centro da cerca virtual</Popup>
          </Marker>
          <Circle
            center={[config.geofence_lat, config.geofence_lng]}
            radius={config.geofence_radius_meters}
            pathOptions={{ color: config.geofence_enabled ? '#22c55e' : '#aaa', fillOpacity: 0.1 }}
          />
        </>
      )}
    </MapContainer>
  )
}
