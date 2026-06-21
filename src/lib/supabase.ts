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
  tag_local: string | null
}

export type Config = {
  id: number
  default_interval_minutes: number
  alarm_duration_seconds: number
  wifi_ssid: string | null
  wifi_geofence_id: number | null
}

export type Geofence = {
  id: number
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  tag_local: string
  interval_minutes: number
  enabled: boolean
  created_at: string
}
