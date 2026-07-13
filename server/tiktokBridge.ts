import 'dotenv/config'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
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

interface SharedGiftConfig {
  id: string
  giftName: string
  imageUrl: string
  hpReward: number
  action: 'boost' | 'split' | 'comment' | 'confetti' | 'boxing'
  enabled: boolean
}

interface SharedAppState {
  username: string
  avatarUrl: string
  tiktokLiveId: string
  giftConfigs: SharedGiftConfig[]
}

interface SharedGameState {
  entities: Array<Record<string, unknown>>
  leaderboard: Array<Record<string, unknown>>
  recentEvents: Array<Record<string, unknown>>
  donationHistory: Array<Record<string, unknown>>
}

type SharedAppMessage =
  | {
    kind: 'manual-donation'
    sourceId: string
    event: {
      username: string
      avatarUrl: string
      hpDelta: number
      sourceLabel: string
      sourceImageUrl?: string
      action: 'boost' | 'split' | 'comment' | 'confetti' | 'boxing'
      commentText?: string
      quantity: number
      timestamp: number
    }
  }
  | {
    kind: 'state-request'
    sourceId: string
  }
  | {
    kind: 'game-state-request'
    sourceId: string
  }
  | {
    kind: 'state-snapshot'
    sourceId: string
    state: SharedAppState
  }
  | {
    kind: 'game-state-snapshot'
    sourceId: string
    state: SharedGameState
  }
  | {
    kind: 'reset-game'
    sourceId: string
  }

interface BridgeCommandTransportMessage {
  type: 'bridge-command'
  payload: BridgeCommandMessage
}

interface AppSyncTransportMessage {
  type: 'app-sync'
  payload: SharedAppMessage
}

type LocalBridgeSocketMessage =
  | BridgeGiftMessage
  | BridgeStatusMessage
  | BridgeCommandTransportMessage
  | AppSyncTransportMessage

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

const bridgePort = Number(process.env.PORT ?? process.env.TIKTOK_BRIDGE_PORT ?? 3189)
const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
const supabaseChannelId = (process.env.SUPABASE_CHANNEL_ID?.trim() ?? 'default-room').replace(/\s+/g, '-').toLowerCase()
const bridgeChannelName = `circular-saw-bridge:${supabaseChannelId}`
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey)

const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

let connection: TikTokLive | null = null
let currentUniqueId = ''
let currentRoomId = ''
let bridgeChannel: RealtimeChannel | null = null

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  response.end(
    JSON.stringify({
      ok: true,
      state: connection ? 'connected' : 'idle',
      uniqueId: currentUniqueId,
      roomId: currentRoomId || undefined,
      mode: supabaseEnabled ? 'supabase+ws' : 'ws-local',
      channel: bridgeChannelName,
    }),
  )
})

const wss = new WebSocketServer({ server })

function broadcastSocketMessage(message: LocalBridgeSocketMessage, except?: WebSocket) {
  const serialized = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client === except || client.readyState !== WebSocket.OPEN) {
      continue
    }

    client.send(serialized)
  }
}

async function broadcastBridgeMessage(message: BridgeGiftMessage | BridgeStatusMessage) {
  broadcastSocketMessage(message)

  if (!bridgeChannel) {
    return
  }

  const sendStatus = await bridgeChannel.send({
    type: 'broadcast',
    event: 'bridge',
    payload: message,
  })

  if (sendStatus !== 'ok') {
    console.warn('[bridge] realtime broadcast status:', sendStatus)
  }
}

function pushStatus(payload: BridgeStatusPayload) {
  void broadcastBridgeMessage({ type: 'status', payload })
}

function normalizeGiftImage(payload: TikTokGiftPayload) {
  return payload.giftPictureUrl?.trim() || payload.giftImageUrl?.trim() || ''
}

function shouldEmitGift(payload: TikTokGiftPayload) {
  if (payload.giftType === 1) {
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
      if (!shouldEmitGift(payload)) {
        return
      }

      void broadcastBridgeMessage({
        type: 'gift',
        payload: {
          username: payload.user?.uniqueId ?? payload.user?.nickname ?? 'anonymous',
          avatarUrl: payload.user?.profilePictureUrl ?? '',
          giftName: payload.giftName ?? `gift-${payload.giftId ?? 'unknown'}`,
          giftImageUrl: normalizeGiftImage(payload),
          repeatCount: Math.max(1, Number(payload.repeatCount ?? 1)),
          giftId: String(payload.giftId ?? ''),
          timestamp: Date.now(),
        },
      })
    })

    liveConnection.on('like', (payload: TikTokLikePayload) => {
      const likeCount = Math.max(1, Number(payload.likeCount ?? 1))

      void broadcastBridgeMessage({
        type: 'gift',
        payload: {
          username: payload.user?.uniqueId ?? payload.user?.nickname ?? 'anonymous',
          avatarUrl: payload.user?.profilePictureUrl ?? '',
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
      const commentText = payload.comment?.trim()
      if (!commentText) {
        return
      }

      void broadcastBridgeMessage({
        type: 'gift',
        payload: {
          eventType: 'comment',
          username: payload.user?.uniqueId ?? payload.user?.nickname ?? 'anonymous',
          avatarUrl: payload.user?.profilePictureUrl ?? '',
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
        roomId: currentRoomId || undefined,
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

async function handleCommand(command: BridgeCommandMessage) {
  if (command.type === 'disconnect') {
    await disconnectCurrentConnection()
    return
  }

  if (command.type === 'connect') {
    await connectToLive(command.payload?.uniqueId ?? '')
  }
}

wss.on('connection', (socket) => {
  const initialStatus: BridgeStatusMessage = {
    type: 'status',
    payload: {
      state: connection ? 'connected' : 'idle',
      uniqueId: currentUniqueId,
      roomId: currentRoomId || undefined,
      message: connection ? 'Bridge conectado' : 'Bridge listo',
    },
  }
  socket.send(JSON.stringify(initialStatus))

  socket.on('message', (rawMessage) => {
    try {
      const message = JSON.parse(String(rawMessage)) as LocalBridgeSocketMessage
      if (message.type === 'bridge-command') {
        void handleCommand(message.payload)
        return
      }

      if (message.type === 'app-sync') {
        broadcastSocketMessage(message, socket)
      }
    } catch (error) {
      console.error('[bridge] invalid socket message', error)
    }
  })
})

async function setupSupabaseRealtime() {
  if (!supabaseEnabled || !supabase) {
    console.log('[bridge] starting in local websocket mode')
    return
  }

  bridgeChannel = supabase.channel(bridgeChannelName)
  bridgeChannel.on('broadcast', { event: 'bridge-command' }, ({ payload }) => {
    const command = payload as BridgeCommandMessage
    void handleCommand(command)
  })

  await new Promise<void>((resolve, reject) => {
    if (!bridgeChannel) {
      reject(new Error('No realtime channel available'))
      return
    }

    bridgeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve()
        return
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Supabase realtime status: ${status}`))
      }
    })
  })

  console.log(`[bridge] realtime channel ready: ${bridgeChannelName}`)
}

async function main() {
  await setupSupabaseRealtime()

  server.listen(bridgePort, '0.0.0.0', () => {
    console.log(`[bridge] listening on http://0.0.0.0:${bridgePort}`)
    pushStatus({
      state: 'idle',
      uniqueId: '',
      message: supabaseEnabled ? 'Bridge remoto listo' : 'Bridge local listo',
    })
  })
}

void main().catch((error) => {
  console.error('[bridge] startup failed', error)
  process.exit(1)
})
