import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Location = {
  id: number
  latitude: number
  longitude: number
  accuracy: number | null
  battery_level: number | null
  timestamp: string
  created_at: string
}

export type Config = {
  id: number
  interval_minutes: number
  geofence_enabled: boolean
  geofence_lat: number | null
  geofence_lng: number | null
  geofence_radius_meters: number
  geofence_interval_minutes: number
}
