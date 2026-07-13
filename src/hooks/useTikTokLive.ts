import { useEffect, useRef, useState } from 'react'
import { bridgeWebSocketUrl } from '../game/constants'
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
  message: 'Bridge local listo',
}

export function useTikTokLive({ uniqueId, onGift }: UseTikTokLiveOptions): UseTikTokLiveResult {
  const [status, setStatus] = useState<TikTokBridgeStatus>(idleStatus)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const pendingConnectRef = useRef<string | null>(null)
  const onGiftRef = useRef(onGift)

  useEffect(() => {
    onGiftRef.current = onGift
  }, [onGift])

  function sendConnectRequest(targetUniqueId: string) {
    if (!targetUniqueId.trim() || socketRef.current?.readyState !== WebSocket.OPEN) {
      pendingConnectRef.current = targetUniqueId.trim() || null
      return
    }

    const message: BridgeCommandMessage = {
      type: 'connect',
      payload: { uniqueId: targetUniqueId.trim() },
    }
    socketRef.current.send(JSON.stringify(message))
    pendingConnectRef.current = null
  }

  useEffect(() => {
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

      const socket = new WebSocket(bridgeWebSocketUrl)
      socketRef.current = socket

      socket.addEventListener('open', () => {
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
          message: 'Esperando bridge local...',
        }))
      })

      socket.addEventListener('close', () => {
        setIsSocketReady(false)
        setStatus((current) => ({
          ...current,
          state: current.state === 'connected' ? 'idle' : current.state,
          message: 'Bridge desconectado, reintentando...',
        }))
        scheduleReconnect()
      })

      socket.addEventListener('message', (messageEvent) => {
        const message = JSON.parse(String(messageEvent.data)) as BridgeGiftMessage | BridgeStatusMessage
        if (message.type === 'gift') {
          onGiftRef.current(message.payload)
          return
        }

        setStatus(message.payload)
      })
    }

    connectSocket()

    return () => {
      isDisposed = true
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      socketRef.current?.close()
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
        socketRef.current?.readyState === WebSocket.OPEN
          ? 'Conectando con TikTok Live...'
          : 'Esperando bridge local para conectar...',
    }))
    sendConnectRequest(uniqueId)
  }

  function disconnect() {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }

    const message: BridgeCommandMessage = {
      type: 'disconnect',
    }
    socketRef.current.send(JSON.stringify(message))
  }

  return {
    bridgeUrl: bridgeWebSocketUrl,
    status,
    isSocketReady,
    connect,
    disconnect,
  }
}
