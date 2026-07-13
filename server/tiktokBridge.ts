import 'dotenv/config'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { TikTokLive } from 'tiktok-live-events'

type BridgeState = 'idle' | 'connecting' | 'connected' | 'error'

interface BridgeStatusPayload {
  state: BridgeState
  uniqueId: string
  message: string
  roomId?: string
}

interface BridgeStatusMessage {
  type: 'status'
  payload: BridgeStatusPayload
}

interface BridgeGiftMessage {
  type: 'gift'
  payload: {
    username: string
    avatarUrl: string
    eventType?: 'gift' | 'like' | 'comment'
    giftName: string
    giftImageUrl: string
    commentText?: string
    repeatCount: number
    giftId: string
    timestamp: number
  }
}

interface BridgeCommandMessage {
  type: 'connect' | 'disconnect'
  payload?: {
    uniqueId?: string
  }
}

interface TikTokGiftPayload {
  user?: {
    uniqueId?: string
    nickname?: string
    profilePictureUrl?: string
  }
  giftId?: number
  giftName?: string
  giftPictureUrl?: string
  giftImageUrl?: string
  repeatCount?: number
  repeatEnd?: boolean
  giftType?: number
}

interface TikTokLikePayload {
  user?: {
    uniqueId?: string
    nickname?: string
    profilePictureUrl?: string
  }
  likeCount?: number
  totalLikes?: number
}

interface TikTokChatPayload {
  user?: {
    uniqueId?: string
    nickname?: string
    profilePictureUrl?: string
  }
  comment?: string
}

interface TikTokRoomInfoPayload {
  roomId?: string
}

const bridgePort = Number(process.env.TIKTOK_BRIDGE_PORT ?? 3189)

let connection: TikTokLive | null = null
let currentUniqueId = ''
let currentRoomId = ''

const server = createServer()
const wss = new WebSocketServer({ server })

function broadcast(message: BridgeGiftMessage | BridgeStatusMessage) {
  const serialized = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(serialized)
    }
  }
}

function pushStatus(payload: BridgeStatusPayload) {
  broadcast({ type: 'status', payload })
}

function normalizeGiftImage(payload: TikTokGiftPayload) {
  return payload.giftPictureUrl?.trim() || payload.giftImageUrl?.trim() || ''
}

function shouldEmitGift(payload: TikTokGiftPayload) {
  const giftType = payload.giftType
  if (giftType === 1) {
    return Boolean(payload.repeatEnd)
  }

  return true
}

function normalizeUniqueIdInput(uniqueIdInput: string) {
  const trimmedValue = uniqueIdInput.trim()
  if (!trimmedValue) {
    return ''
  }

  const withoutQuery = trimmedValue.split('?')[0].split('#')[0]
  const urlMatch = withoutQuery.match(/tiktok\.com\/@([^/]+)/i)
  if (urlMatch?.[1]) {
    return urlMatch[1].trim().replace(/^@+/, '')
  }

  return withoutQuery.replace(/^@+/, '').replace(/\/$/, '').trim()
}

function formatConnectErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'No se pudo conectar al live'
  }

  return `${error.name}: ${error.message}`
}

async function disconnectCurrentConnection() {
  if (!connection) {
    currentUniqueId = ''
    currentRoomId = ''
    pushStatus({
      state: 'idle',
      uniqueId: '',
      message: 'Bridge en espera',
    })
    return
  }

  connection.disconnect()
  connection = null
  currentUniqueId = ''
  currentRoomId = ''
  pushStatus({
    state: 'idle',
    uniqueId: '',
    message: 'Live desconectado',
  })
}

async function connectToLive(uniqueIdInput: string) {
  const uniqueId = normalizeUniqueIdInput(uniqueIdInput)
  if (!uniqueId) {
    pushStatus({
      state: 'error',
      uniqueId: '',
      message: 'Falta el usuario del live',
    })
    return
  }

  await disconnectCurrentConnection()
  currentUniqueId = uniqueId
  currentRoomId = ''
  pushStatus({
    state: 'connecting',
    uniqueId,
    message: 'Conectando con TikTok Live...',
  })
  console.log(`[bridge] connect request: input="${uniqueIdInput}" normalized="${uniqueId}"`)

  try {
    const liveConnection = new TikTokLive(uniqueId, {
      autoReconnect: false,
      mode: 'direct',
    })

    liveConnection.on('gift', (payload: TikTokGiftPayload) => {
      const giftPayload = payload as TikTokGiftPayload
      if (!shouldEmitGift(giftPayload)) {
        return
      }

      broadcast({
        type: 'gift',
        payload: {
          username: giftPayload.user?.uniqueId ?? giftPayload.user?.nickname ?? 'anonymous',
          avatarUrl: giftPayload.user?.profilePictureUrl ?? '',
          giftName: giftPayload.giftName ?? `gift-${giftPayload.giftId ?? 'unknown'}`,
          giftImageUrl: normalizeGiftImage(giftPayload),
          repeatCount: Math.max(1, Number(giftPayload.repeatCount ?? 1)),
          giftId: String(giftPayload.giftId ?? ''),
          timestamp: Date.now(),
        },
      })
    })

    liveConnection.on('like', (payload: TikTokLikePayload) => {
      const likePayload = payload as TikTokLikePayload
      const likeCount = Math.max(1, Number(likePayload.likeCount ?? 1))

      broadcast({
        type: 'gift',
        payload: {
          username: likePayload.user?.uniqueId ?? likePayload.user?.nickname ?? 'anonymous',
          avatarUrl: likePayload.user?.profilePictureUrl ?? '',
          eventType: 'like',
          giftName: 'Like',
          giftImageUrl: '',
          repeatCount: likeCount,
          giftId: 'like',
          timestamp: Date.now(),
        },
      })
    })

    liveConnection.on('chat', (payload: TikTokChatPayload) => {
      const chatPayload = payload as TikTokChatPayload
      const commentText = chatPayload.comment?.trim()
      if (!commentText) {
        return
      }

      broadcast({
        type: 'gift',
        payload: {
          eventType: 'comment',
          username: chatPayload.user?.uniqueId ?? chatPayload.user?.nickname ?? 'anonymous',
          avatarUrl: chatPayload.user?.profilePictureUrl ?? '',
          giftName: 'Comment',
          giftImageUrl: '',
          commentText,
          repeatCount: 1,
          giftId: 'comment',
          timestamp: Date.now(),
        },
      })
    })

    liveConnection.on('roomInfo', (payload: TikTokRoomInfoPayload) => {
      currentRoomId = payload.roomId ?? ''
      pushStatus({
        state: 'connected',
        uniqueId,
        roomId: currentRoomId,
        message: 'Recibiendo regalos del live',
      })
    })

    liveConnection.on('connected', () => {
      pushStatus({
        state: 'connected',
        uniqueId,
        roomId: currentRoomId || undefined,
        message: 'Conexion abierta con TikTok Live',
      })
    })

    liveConnection.on('disconnected', (_code: number, reason: string) => {
      connection = null
      pushStatus({
        state: 'idle',
        uniqueId: currentUniqueId,
        roomId: currentRoomId || undefined,
        message: reason || 'TikTok Live se cerro',
      })
    })

    liveConnection.on('error', (error: Error) => {
      console.error(`[bridge] runtime error for "${uniqueId}"`, error)
      pushStatus({
        state: 'error',
        uniqueId,
        roomId: currentRoomId || undefined,
        message: formatConnectErrorMessage(error),
      })
    })

    await liveConnection.connect()
    connection = liveConnection
    console.log(`[bridge] connected: uniqueId="${uniqueId}" roomId="${currentRoomId}"`)

    pushStatus({
      state: 'connected',
      uniqueId,
      roomId: currentRoomId || undefined,
      message: 'Recibiendo regalos del live',
    })
  } catch (error) {
    connection = null
    currentRoomId = ''
    const errorMessage = formatConnectErrorMessage(error)
    console.error(`[bridge] connect failed for "${uniqueId}"`, error)
    pushStatus({
      state: 'error',
      uniqueId,
      message: errorMessage,
    })
  }
}

wss.on('connection', (socket: WebSocket) => {
  socket.send(
    JSON.stringify({
      type: 'status',
      payload: {
        state: connection ? 'connected' : 'idle',
        uniqueId: currentUniqueId,
        roomId: currentRoomId || undefined,
        message: connection ? 'Bridge conectado' : 'Bridge local listo',
      },
    } satisfies BridgeStatusMessage),
  )

  socket.on('message', async (rawMessage: WebSocket.RawData) => {
    try {
      const message = JSON.parse(String(rawMessage)) as BridgeCommandMessage
      console.log(`[bridge] ws message: ${message.type}`)
      if (message.type === 'connect') {
        await connectToLive(message.payload?.uniqueId ?? '')
        return
      }

      if (message.type === 'disconnect') {
        await disconnectCurrentConnection()
      }
    } catch (error) {
      pushStatus({
        state: 'error',
        uniqueId: currentUniqueId,
        message: error instanceof Error ? error.message : 'Mensaje invalido',
      })
    }
  })
})

server.listen(bridgePort, () => {
  console.log(`TikTok bridge listening on ws://127.0.0.1:${bridgePort}`)
})
