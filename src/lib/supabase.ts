import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
const configuredChannelId = import.meta.env.VITE_SUPABASE_CHANNEL_ID?.trim() ?? ''
const configuredBridgeHost = import.meta.env.VITE_BRIDGE_HOST?.trim() ?? ''
const configuredBridgePort = import.meta.env.VITE_BRIDGE_PORT?.trim() ?? '3189'

export const supabaseChannelId = (configuredChannelId || 'default-room').replace(/\s+/g, '-').toLowerCase()
export const supabaseRealtimeEnabled = Boolean(supabaseUrl && supabaseAnonKey)
export const bridgeChannelName = `circular-saw-bridge:${supabaseChannelId}`
export const appSyncChannelName = `circular-saw-sync:${supabaseChannelId}`
export const bridgeTransportLabel = supabaseRealtimeEnabled
  ? `Supabase Realtime (${supabaseChannelId})`
  : 'Supabase Realtime no configurado'

let supabaseClient: SupabaseClient | null = null

function shouldUseSameOriginBridgeProxy() {
  return import.meta.env.DEV && !configuredBridgeHost
}

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

export function getLocalBridgeWebSocketUrl() {
  if (shouldUseSameOriginBridgeProxy()) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${window.location.host}/bridge-ws`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = configuredBridgeHost || window.location.hostname || '127.0.0.1'
  return `${protocol}://${host}:${configuredBridgePort}`
}

export function getLocalBridgeHttpUrl() {
  if (shouldUseSameOriginBridgeProxy()) {
    return `${window.location.origin}/bridge-http`
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
  const host = configuredBridgeHost || window.location.hostname || '127.0.0.1'
  return `${protocol}://${host}:${configuredBridgePort}`
}