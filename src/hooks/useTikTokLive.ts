import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { bridgeChannelName, bridgeTransportLabel, getLocalBridgeWebSocketUrl, getLocalBridgeWebSocketUrls, getSupabaseClient, supabaseRealtimeEnabled } from '../lib/supabase'
import type {
  BridgeCommandTransportMessage,
  BridgeCommandMessage,
  BridgeGiftMessage,
  BridgeStatusMessage,
  LiveGiftEvent,
  LocalBridgeSocketMessage,
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
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pendingConnectRef = useRef<string | null>(null)
  const onGiftRef = useRef(onGift)
  const socketUrlIndexRef = useRef(0)

  useEffect(() => {
    onGiftRef.current = onGift
  }, [onGift])

  function sendConnectRequest(targetUniqueId: string) {
    if (!targetUniqueId.trim()) {
      pendingConnectRef.current = targetUniqueId.trim() || null
      return
    }

    const message: BridgeCommandMessage = {
      type: 'connect',
      payload: { uniqueId: targetUniqueId.trim() },
    }

    if (supabaseRealtimeEnabled) {
      if (!channelRef.current) {
        pendingConnectRef.current = targetUniqueId.trim() || null
        return
      }

      void channelRef.current.send({
        type: 'broadcast',
        event: 'bridge-command',
        payload: message,
      })
    } else {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        pendingConnectRef.current = targetUniqueId.trim() || null
        return
      }

      const envelope: BridgeCommandTransportMessage = {
        type: 'bridge-command',
        payload: message,
      }
      socketRef.current.send(JSON.stringify(envelope))
    }
    pendingConnectRef.current = null
  }

  useEffect(() => {
    const supabase = getSupabaseClient()

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

      if (!supabaseRealtimeEnabled) {
        const socketUrls = getLocalBridgeWebSocketUrls()
        const socketUrl = socketUrls[socketUrlIndexRef.current % socketUrls.length]
        socketUrlIndexRef.current += 1
        const socket = new WebSocket(socketUrl)
        socketRef.current = socket

        socket.addEventListener('open', () => {
          socketUrlIndexRef.current = 0
          setIsSocketReady(true)
          setStatus((current) => ({
            ...current,
            message: current.state === 'connected' ? current.message : 'Bridge local listo',
          }))

          if (pendingConnectRef.current) {
            sendConnectRequest(pendingConnectRef.current)
          }
        })

        socket.addEventListener('error', () => {
          setIsSocketReady(false)
          setStatus((current) => ({
            ...current,
            state: current.state === 'connected' ? current.state : 'idle',
            message: socketUrls.length > 1 ? 'Probando otra ruta del bridge local...' : 'Esperando bridge local...',
          }))
        })

        socket.addEventListener('close', () => {
          setIsSocketReady(false)
          setStatus((current) => ({
            ...current,
            state: current.state === 'connected' ? 'idle' : current.state,
            message: 'Bridge local desconectado, reintentando...',
          }))
          socketRef.current = null
          scheduleReconnect()
        })

        socket.addEventListener('message', (messageEvent) => {
          const message = JSON.parse(String(messageEvent.data)) as LocalBridgeSocketMessage
          if (message.type === 'gift') {
            onGiftRef.current(message.payload)
            return
          }

          if (message.type === 'status') {
            setStatus(message.payload)
          }
        })

        return
      }

      if (!supabase) {
        setStatus({
          state: 'error',
          uniqueId: '',
          message: 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY',
        })
        setIsSocketReady(false)
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
      socketRef.current?.close()
      if (channelRef.current && supabase) {
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
    const message: BridgeCommandMessage = {
      type: 'disconnect',
    }

    if (supabaseRealtimeEnabled) {
      if (!channelRef.current) {
        return
      }

      void channelRef.current.send({
        type: 'broadcast',
        event: 'bridge-command',
        payload: message,
      })
      return
    }

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }

    const envelope: BridgeCommandTransportMessage = {
      type: 'bridge-command',
      payload: message,
    }
    socketRef.current.send(JSON.stringify(envelope))
  }

  return {
    bridgeUrl: supabaseRealtimeEnabled ? bridgeTransportLabel : getLocalBridgeWebSocketUrl(),
    status,
    isSocketReady,
    connect,
    disconnect,
  }
}
