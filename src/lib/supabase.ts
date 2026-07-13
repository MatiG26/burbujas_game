import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const configuredChannelId = import.meta.env.VITE_SUPABASE_CHANNEL_ID?.trim() ?? ''

export const supabaseChannelId = (configuredChannelId || 'default-room').replace(/\s+/g, '-').toLowerCase()
export const supabaseRealtimeEnabled = Boolean(supabaseUrl && supabaseAnonKey)
export const bridgeChannelName = `circular-saw-bridge:${supabaseChannelId}`
export const appSyncChannelName = `circular-saw-sync:${supabaseChannelId}`
export const bridgeTransportLabel = supabaseRealtimeEnabled
  ? `Supabase Realtime (${supabaseChannelId})`
  : 'Supabase Realtime no configurado'

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient() {
  if (!supabaseRealtimeEnabled) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return supabaseClient
}