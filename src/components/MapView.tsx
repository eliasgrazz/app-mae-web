'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Location } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Fix ícones do Leaflet no Next.js
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

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1 })
  }, [lat, lng, map])
  return null
}

type Props = {
  locations: Location[]
  currentLocation: Location | null
}

export default function MapView({ locations, currentLocation }: Props) {
  const center: [number, number] = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : [-15.8267, -47.9218] // Brasília como default

  const path: [number, number][] = locations.map(l => [l.latitude, l.longitude])

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Trajeto histórico */}
      {path.length > 1 && (
        <Polyline positions={path} color="#764ba2" weight={3} opacity={0.7} />
      )}

      {/* Posição atual destacada */}
      {currentLocation && (
        <>
          <FlyTo lat={currentLocation.latitude} lng={currentLocation.longitude} />
          <Marker
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={currentIcon}
          >
            <Popup>
              <strong>Posição atual</strong><br />
              {format(new Date(currentLocation.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
              {currentLocation.battery_level != null && `Bateria: ${currentLocation.battery_level}%`}
            </Popup>
          </Marker>
        </>
      )}

      {/* Pontos do histórico */}
      {locations.slice(0, -1).map(loc => (
        <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
          <Popup>
            {format(new Date(loc.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}<br />
            {loc.battery_level != null && `Bateria: ${loc.battery_level}%`}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
