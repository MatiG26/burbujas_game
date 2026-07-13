import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { bridgeChannelName, bridgeTransportLabel, getSupabaseClient, supabaseRealtimeEnabled } from '../lib/supabase'
import type {
  BridgeCommandMessage,
  BridgeGiftMessage,
  BridgeStatusMessage,
  LiveGiftEvent,
  TikTokBridgeStatus,
} from '../types/game'

interface UseTikTokLiveOptions {
  uniqueId: string
  onGift: (event: LiveGiftEvent) => void
}

interface UseTikTokLiveResult {
  bridgeUrl: string
  status: TikTokBridgeStatus
  isSocketReady: boolean
  connect: () => void
  disconnect: () => void
}

const idleStatus: TikTokBridgeStatus = {
  state: 'idle',
  uniqueId: '',
  message: supabaseRealtimeEnabled ? 'Canal realtime listo' : 'Configura Supabase Realtime',
}

export function useTikTokLive({ uniqueId, onGift }: UseTikTokLiveOptions): UseTikTokLiveResult {
  const [status, setStatus] = useState<TikTokBridgeStatus>(idleStatus)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pendingConnectRef = useRef<string | null>(null)
  const onGiftRef = useRef(onGift)

  useEffect(() => {
    onGiftRef.current = onGift
  }, [onGift])

  function sendConnectRequest(targetUniqueId: string) {
    if (!targetUniqueId.trim() || !channelRef.current) {
      pendingConnectRef.current = targetUniqueId.trim() || null
      return
    }

    const message: BridgeCommandMessage = {
      type: 'connect',
      payload: { uniqueId: targetUniqueId.trim() },
    }
    void channelRef.current.send({
      type: 'broadcast',
      event: 'bridge-command',
      payload: message,
    })
    pendingConnectRef.current = null
  }

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setStatus({
        state: 'error',
        uniqueId: '',
        message: 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY',
      })
      setIsSocketReady(false)
      return
    }

    let isDisposed = false

    const scheduleReconnect = () => {
      if (isDisposed || reconnectTimeoutRef.current !== null) {
        return
      }

      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null
        connectSocket()
      }, 1500)
    }

    const connectSocket = () => {
      if (isDisposed) {
        return
      }

      const channel = supabase.channel(bridgeChannelName)
      channelRef.current = channel

      channel.on('broadcast', { event: 'bridge' }, ({ payload }) => {
        const message = payload as BridgeGiftMessage | BridgeStatusMessage
        if (message.type === 'gift') {
          onGiftRef.current(message.payload)
          return
        }

        setStatus(message.payload)
      })

      channel.subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setIsSocketReady(true)
          setStatus((current) => ({
            ...current,
            message: current.state === 'connected' ? current.message : 'Canal realtime listo',
          }))

          if (pendingConnectRef.current) {
            sendConnectRequest(pendingConnectRef.current)
          }
          return
        }

        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT' || subscriptionStatus === 'CLOSED') {
          setIsSocketReady(false)
          setStatus((current) => ({
            ...current,
            state: current.state === 'connected' ? 'idle' : current.state,
            message: 'Canal realtime desconectado, reintentando...',
          }))
          channelRef.current = null
          void supabase.removeChannel(channel)
          scheduleReconnect()
        }
      })
    }

    connectSocket()

    return () => {
      isDisposed = true
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  function connect() {
    if (!uniqueId.trim()) {
      return
    }

    setStatus((current) => ({
      ...current,
      state: current.state === 'connected' ? current.state : 'connecting',
      uniqueId: uniqueId.trim(),
      message:
        channelRef.current
          ? 'Conectando con TikTok Live...'
          : 'Esperando canal realtime para conectar...',
    }))
    sendConnectRequest(uniqueId)
  }

  function disconnect() {
    if (!channelRef.current) {
      return
    }

    const message: BridgeCommandMessage = {
      type: 'disconnect',
    }
    void channelRef.current.send({
      type: 'broadcast',
      event: 'bridge-command',
      payload: message,
    })
  }

  return {
    bridgeUrl: bridgeTransportLabel,
    status,
    isSocketReady,
    connect,
    disconnect,
  }
}
