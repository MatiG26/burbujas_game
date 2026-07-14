import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DonationControls } from './components/DonationControls'
import { BottomTabMenu } from './components/BottomTabMenu'
import { GameCanvas } from './components/GameCanvas'
import { GiftMenuStrip } from './components/GiftMenuStrip'
import { Leaderboard } from './components/Leaderboard'
import { defaultGiftConfigs } from './game/constants'
import { useCircularSawGame } from './hooks/useCircularSawGame'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useTikTokLive } from './hooks/useTikTokLive'
import { getAppSyncChannelName, getLocalBridgeWebSocketUrls, getSupabaseClient, isValidSyncRoomCode, normalizeSyncRoomCode, supabaseRealtimeEnabled } from './lib/supabase'
import type { AppSyncTransportMessage, DonationEvent, GiftConfig, LiveGiftEvent, LocalBridgeSocketMessage, SharedAppMessage, SharedAppState } from './types/game'
import type { AdminSection } from './components/DonationControls'
import { TabIcon } from './components/DonationControls'

const legacyRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/rose.png'
const currentRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
const koreanHeartImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp'
const secondRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp'
const perfumeImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp'
const confettiImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp'
const boxingGloveImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9f8bd92363c400c284179f6719b6ba9c~tplv-obj.webp'
const lionImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/4fb89af2082a290b37d704e20f4fe729~tplv-obj.webp'
const tapTapThreshold = 3

const migratedDefaultGiftConfigMap = new Map([
  ['rose', { giftName: 'Rosa 2', imageUrl: currentRoseImageUrl, hpReward: 10, action: 'boost' as const }],
  ['tiktok', { giftName: 'Corazon coreano', imageUrl: koreanHeartImageUrl, hpReward: 55, action: 'boost' as const }],
  ['korean-heart', { giftName: 'Corazon coreano', imageUrl: koreanHeartImageUrl, hpReward: 55, action: 'boost' as const }],
  ['split-saw', { giftName: 'Rosa', imageUrl: secondRoseImageUrl, hpReward: 110, action: 'boost' as const }],
  ['second-rose', { giftName: 'Rosa', imageUrl: secondRoseImageUrl, hpReward: 110, action: 'boost' as const }],
  ['perfume', { giftName: 'Perfume', imageUrl: perfumeImageUrl, hpReward: 220, action: 'boost' as const }],
  ['treasure-box', { giftName: 'Confeti', imageUrl: confettiImageUrl, hpReward: 1000, action: 'confetti' as const }],
  ['confetti', { giftName: 'Confeti', imageUrl: confettiImageUrl, hpReward: 1000, action: 'confetti' as const }],
  ['lion', { giftName: 'Leon', imageUrl: lionImageUrl, hpReward: 10000, action: 'lion' as const }],
  ['boxing-glove', { giftName: 'Guante de boxeo', imageUrl: boxingGloveImageUrl, hpReward: 3000, action: 'boxing' as const }],
])

const canonicalGiftIdMap = new Map([
  ['tiktok', 'korean-heart'],
  ['split-saw', 'second-rose'],
  ['treasure-box', 'confetti'],
])

function sortGiftConfigs(gifts: GiftConfig[]) {
  return [...gifts].sort((left, right) => {
    if (left.hpReward !== right.hpReward) {
      return left.hpReward - right.hpReward
    }

    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1
    }

    if (left.giftName !== right.giftName) {
      return left.giftName.localeCompare(right.giftName)
    }

    return left.id.localeCompare(right.id)
  })
}

function normalizeGiftId(giftId: string) {
  return canonicalGiftIdMap.get(giftId) ?? giftId
}

function areGiftConfigsEqual(left: GiftConfig[], right: GiftConfig[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((gift, index) => {
    const comparison = right[index]
    return comparison
      && gift.id === comparison.id
      && gift.giftName === comparison.giftName
      && gift.imageUrl === comparison.imageUrl
      && gift.hpReward === comparison.hpReward
      && gift.action === comparison.action
      && gift.enabled === comparison.enabled
  })
}

function normalizeGiftName(value: string) {
  return value.trim().toLowerCase()
}

function normalizeGiftImageKey(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  try {
    const parsedUrl = new URL(trimmedValue)
    return parsedUrl.pathname.split('/').pop()?.toLowerCase() ?? trimmedValue.toLowerCase()
  } catch {
    return trimmedValue.split('?')[0].split('#')[0].split('/').pop()?.toLowerCase() ?? trimmedValue.toLowerCase()
  }
}

type AppRoute = 'home' | 'battle' | 'config'

function getCurrentRoute(): AppRoute {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  if (pathname === '/config') {
    return 'config'
  }

  if (pathname === '/batalla') {
    return 'battle'
  }

  return 'home'
}

function normalizeGiftConfig(gift: GiftConfig): GiftConfig {
  const normalizedId = normalizeGiftId(gift.id)
  const migratedDefault = migratedDefaultGiftConfigMap.get(gift.id) ?? migratedDefaultGiftConfigMap.get(normalizedId)

  return {
    ...gift,
    id: normalizedId,
    ...(migratedDefault ?? {}),
    enabled: gift.enabled ?? true,
    imageUrl:
      normalizedId === 'rose' && (gift.imageUrl === legacyRoseImageUrl || gift.imageUrl.trim().length === 0)
        ? currentRoseImageUrl
        : (migratedDefault?.imageUrl || gift.imageUrl),
  }
}

function mergeGiftConfigs(gifts: GiftConfig[]) {
  const mergedGiftMap = new Map<string, GiftConfig>()

  for (const gift of gifts) {
    const normalizedGift = normalizeGiftConfig(gift)
    if (!mergedGiftMap.has(normalizedGift.id)) {
      mergedGiftMap.set(normalizedGift.id, normalizedGift)
    }
  }

  for (const defaultGift of defaultGiftConfigs) {
    if (!mergedGiftMap.has(defaultGift.id)) {
      mergedGiftMap.set(defaultGift.id, defaultGift)
    }
  }

  return [...mergedGiftMap.values()]
}

function buildManualDonationEvent(
  username: string,
  avatarUrl: string,
  preset: GiftConfig,
  quantity = 1,
): DonationEvent {
  const normalizedQuantity = Math.max(1, quantity)

  return {
    username,
    avatarUrl,
    hpDelta: preset.action === 'split' ? 0 : preset.hpReward * normalizedQuantity,
    sourceLabel: preset.giftName,
    sourceImageUrl: preset.imageUrl,
    action: preset.action,
    quantity: normalizedQuantity,
    timestamp: Date.now(),
  }
}

function buildSimulationUsername(baseUsername: string, index: number) {
  const trimmedUsername = baseUsername.trim()
  return index === 0 ? trimmedUsername : `${trimmedUsername}${index}`
}

type SimulationQuantityMode = 'multiple' | 'single'

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute())
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>('connect')
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [homeSyncCodeInput, setHomeSyncCodeInput] = useState('')
  const [simulationQuantityMode, setSimulationQuantityMode] = useState<SimulationQuantityMode>('multiple')
  const [username, setUsername] = useState('StreamerPro')
  const [avatarUrl, setAvatarUrl] = useState(
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  )
  const [tiktokLiveId, setTikTokLiveId] = useLocalStorageState('circular-saw:tiktok-live-id', '')
  const [syncCode, setSyncCode] = useLocalStorageState('circular-saw:sync-code', '')
  const [giftConfigs, setGiftConfigs] = useLocalStorageState<GiftConfig[]>(
    'circular-saw:gift-configs',
    defaultGiftConfigs,
  )
  const [instanceId] = useState(() => crypto.randomUUID())
  const [syncConnected, setSyncConnected] = useState(false)
  const syncChannelRef = useRef<RealtimeChannel | null>(null)
  const syncSocketRef = useRef<WebSocket | null>(null)
  const syncReadyRef = useRef(false)
  const pendingSharedMessagesRef = useRef<SharedAppMessage[]>([])
  const pendingTapTapCountsRef = useRef(new Map<string, number>())
  const reconnectTimeoutRef = useRef<number | null>(null)
  const sharedStateRef = useRef<SharedAppState | null>(null)
  const skippedSharedStateRef = useRef<string | null>(null)
  const pullDistanceRef = useRef(0)
  const isPullRefreshingRef = useRef(false)
  const syncSocketUrlIndexRef = useRef(0)
  const { canvasRef, canvasSize, leaderboard, activeSaws, recentEvents, donationHistory, roundStatus, audioEnabled, toggleAudio, resetGame, donate, getSharedGameState, applySharedGameState } =
    useCircularSawGame()
  const donateRef = useRef(donate)
  const resetGameRef = useRef(resetGame)
  const getSharedGameStateRef = useRef(getSharedGameState)
  const applySharedGameStateRef = useRef(applySharedGameState)
  const broadcastCurrentGameStateRef = useRef<() => void>(() => {})

  useEffect(() => {
    isPullRefreshingRef.current = isPullRefreshing
  }, [isPullRefreshing])

  useEffect(() => {
    donateRef.current = donate
    resetGameRef.current = resetGame
    getSharedGameStateRef.current = getSharedGameState
    applySharedGameStateRef.current = applySharedGameState
  }, [applySharedGameState, donate, getSharedGameState, resetGame])

  useEffect(() => {
    if (giftConfigs.length === 0) {
      setGiftConfigs(defaultGiftConfigs)
      return
    }

    const mergedGiftConfigs = mergeGiftConfigs(giftConfigs)

    if (!areGiftConfigsEqual(giftConfigs, mergedGiftConfigs)) {
      setGiftConfigs(mergedGiftConfigs)
    }
  }, [giftConfigs, setGiftConfigs])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let touchStartY = 0
    let shouldRefresh = false
    let reachedRefreshThreshold = false
    let refreshTimeout: number | null = null
    const refreshThreshold = 96

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || event.touches.length !== 1 || isPullRefreshingRef.current) {
        shouldRefresh = false
        reachedRefreshThreshold = false
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }

      touchStartY = event.touches[0].clientY
      shouldRefresh = true
      reachedRefreshThreshold = false
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!shouldRefresh || event.touches.length !== 1) {
        return
      }

      const nextPullDistance = Math.max(0, event.touches[0].clientY - touchStartY)
      const cappedPullDistance = Math.min(nextPullDistance, refreshThreshold + 36)
      pullDistanceRef.current = cappedPullDistance
      reachedRefreshThreshold = nextPullDistance >= refreshThreshold
      setPullDistance(cappedPullDistance)
    }

    const handleTouchEnd = () => {
      const shouldTriggerRefresh = shouldRefresh && reachedRefreshThreshold && !isPullRefreshingRef.current
      shouldRefresh = false
      reachedRefreshThreshold = false

      if (shouldTriggerRefresh) {
        pullDistanceRef.current = refreshThreshold
        setPullDistance(refreshThreshold)
        setIsPullRefreshing(true)
        refreshTimeout = window.setTimeout(() => {
          window.location.reload()
        }, 320)
        return
      }

      pullDistanceRef.current = 0
      if (!isPullRefreshingRef.current) {
        setPullDistance(0)
      }
    }

    const handleTouchCancel = () => {
      shouldRefresh = false
      reachedRefreshThreshold = false
      pullDistanceRef.current = 0
      if (!isPullRefreshingRef.current) {
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout)
      }
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [])

  const pullRefreshProgress = Math.min(1, pullDistance / 96)

  const pullRefreshIndicator = (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-opacity duration-200 ${pullDistance > 0 || isPullRefreshing ? 'opacity-100' : 'opacity-0'}`}
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      aria-hidden="true"
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#17191c]/92 text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-md"
        style={{ transform: `translateY(${Math.min(pullDistance * 0.45, 28)}px) scale(${0.82 + pullRefreshProgress * 0.18})` }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${isPullRefreshing ? 'animate-spin' : ''}`}
          style={{ transform: isPullRefreshing ? undefined : `rotate(${pullRefreshProgress * 220}deg)` }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 2v6h-6" />
          <path d="M3 22v-6h6" />
          <path d="M21 8a9 9 0 0 0-15.55-3.36L3 7" />
          <path d="M3 16a9 9 0 0 0 15.55 3.36L21 17" />
        </svg>
      </div>
    </div>
  )

  const normalizedGiftConfigs = useMemo(
    () => sortGiftConfigs(mergeGiftConfigs(giftConfigs)),
    [giftConfigs],
  )

  const enabledGiftConfigs = useMemo(
    () => normalizedGiftConfigs.filter((gift) => gift.enabled),
    [normalizedGiftConfigs],
  )

  const normalizedSyncCode = useMemo(() => normalizeSyncRoomCode(syncCode), [syncCode])
  const hasValidSyncCode = useMemo(() => isValidSyncRoomCode(normalizedSyncCode), [normalizedSyncCode])
  const appSyncChannelName = useMemo(
    () => getAppSyncChannelName(hasValidSyncCode ? normalizedSyncCode : undefined),
    [hasValidSyncCode, normalizedSyncCode],
  )

  useEffect(() => {
    setHomeSyncCodeInput(normalizedSyncCode)
  }, [normalizedSyncCode])

  const giftConfigMap = useMemo(
    () => new Map(enabledGiftConfigs.map((gift) => [normalizeGiftName(gift.giftName), gift])),
    [enabledGiftConfigs],
  )

  const giftConfigByImageMap = useMemo(
    () =>
      new Map(
        enabledGiftConfigs
          .filter((gift) => normalizeGiftImageKey(gift.imageUrl))
          .map((gift) => [normalizeGiftImageKey(gift.imageUrl), gift]),
      ),
    [enabledGiftConfigs],
  )

  const topDonors = useMemo(
    () => leaderboard.filter((entry) => entry.isActive && entry.currentHp > 0).slice(0, 3),
    [leaderboard],
  )

  const syncGiftImageFromEvent = useCallback((giftId: string, eventImageUrl: string) => {
    const normalizedEventImage = eventImageUrl.trim()
    if (!normalizedEventImage) {
      return
    }

    setGiftConfigs((current) =>
      current.map((gift) => {
        if (gift.id !== giftId) {
          return gift
        }

        if (normalizeGiftImageKey(gift.imageUrl) === normalizeGiftImageKey(normalizedEventImage)) {
          return gift
        }

        return {
          ...gift,
          imageUrl: normalizedEventImage,
        }
      }),
    )
  }, [setGiftConfigs])

  const handleLiveGift = useCallback(
    (event: LiveGiftEvent) => {
      if (event.eventType === 'comment' || event.giftId === 'comment') {
        donate({
          username: event.username,
          avatarUrl: event.avatarUrl,
          hpDelta: 0.25,
          sourceLabel: 'Comment',
          sourceImageUrl: event.giftImageUrl,
          action: 'comment',
          commentText: event.commentText,
          quantity: 1,
          timestamp: event.timestamp,
        })
        return
      }

      if (event.giftId === 'like' || normalizeGiftName(event.giftName) === 'like') {
        const normalizedLikeUser = event.username.trim().toLowerCase() || event.username.trim()
        const previousTapCount = pendingTapTapCountsRef.current.get(normalizedLikeUser) ?? 0
        const totalTapCount = previousTapCount + Math.max(1, event.repeatCount)
        const readyTapBundles = Math.floor(totalTapCount / tapTapThreshold)
        const remainingTapCount = totalTapCount % tapTapThreshold

        if (remainingTapCount > 0) {
          pendingTapTapCountsRef.current.set(normalizedLikeUser, remainingTapCount)
        } else {
          pendingTapTapCountsRef.current.delete(normalizedLikeUser)
        }

        if (readyTapBundles === 0) {
          return
        }

        donate({
          username: event.username,
          avatarUrl: event.avatarUrl,
          hpDelta: 0.25 * readyTapBundles,
          sourceLabel: 'Like',
          sourceImageUrl: event.giftImageUrl,
          action: 'boost',
          quantity: readyTapBundles * tapTapThreshold,
          timestamp: event.timestamp,
        })
        return
      }

      const mappedGift =
        giftConfigMap.get(normalizeGiftName(event.giftName)) ||
        giftConfigByImageMap.get(normalizeGiftImageKey(event.giftImageUrl))
      if (!mappedGift) {
        return
      }

      syncGiftImageFromEvent(mappedGift.id, event.giftImageUrl)

      const quantity = Math.max(1, event.repeatCount)
      if (mappedGift.action === 'split') {
        for (let index = 0; index < quantity; index += 1) {
          donate({
            username: event.username,
            avatarUrl: event.avatarUrl,
            hpDelta: 0,
            sourceLabel: mappedGift.giftName,
            sourceImageUrl: mappedGift.imageUrl || event.giftImageUrl,
            action: 'split',
            quantity: 1,
            timestamp: event.timestamp + index,
          })
        }
        return
      }

      if (mappedGift.action === 'confetti' || mappedGift.action === 'boxing' || mappedGift.action === 'lion') {
        donate({
          username: event.username,
          avatarUrl: event.avatarUrl,
          hpDelta: mappedGift.hpReward * quantity,
          sourceLabel: mappedGift.giftName,
          sourceImageUrl: mappedGift.imageUrl || event.giftImageUrl,
          action: mappedGift.action,
          quantity,
          timestamp: event.timestamp,
        })
        return
      }

      donate({
        username: event.username,
        avatarUrl: event.avatarUrl,
        hpDelta: mappedGift.hpReward * quantity,
        sourceLabel: mappedGift.giftName,
        sourceImageUrl: mappedGift.imageUrl || event.giftImageUrl,
        action: 'boost',
        quantity,
        timestamp: event.timestamp,
      })
    },
    [donate, giftConfigByImageMap, giftConfigMap, syncGiftImageFromEvent],
  )

  const { bridgeUrl, status, connect, disconnect } = useTikTokLive({
    uniqueId: tiktokLiveId,
    onGift: handleLiveGift,
  })

  const sharedAppState = useMemo<SharedAppState>(() => ({
    username,
    avatarUrl,
    tiktokLiveId,
    giftConfigs: giftConfigs.map(normalizeGiftConfig),
  }), [avatarUrl, giftConfigs, tiktokLiveId, username])

  const sharedAppStateSerialized = useMemo(
    () => JSON.stringify(sharedAppState),
    [sharedAppState],
  )

  useEffect(() => {
    sharedStateRef.current = sharedAppState
  }, [sharedAppState])

  const sendSharedMessageNow = useCallback((message: SharedAppMessage) => {
    if (supabaseRealtimeEnabled) {
      const channel = syncChannelRef.current
      if (!channel || !syncReadyRef.current) {
        return false
      }

      void channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: message,
      })
      return true
    }

    if (syncSocketRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    const envelope: AppSyncTransportMessage = {
      type: 'app-sync',
      payload: message,
    }
    syncSocketRef.current.send(JSON.stringify(envelope))
    return true
  }, [])

  const flushPendingSharedMessages = useCallback(() => {
    if (!syncReadyRef.current || pendingSharedMessagesRef.current.length === 0) {
      return
    }

    const pendingMessages = pendingSharedMessagesRef.current
    pendingSharedMessagesRef.current = []

    for (const pendingMessage of pendingMessages) {
      if (!sendSharedMessageNow(pendingMessage)) {
        pendingSharedMessagesRef.current.push(pendingMessage)
      }
    }
  }, [sendSharedMessageNow])

  const broadcastSharedMessage = useCallback((message: SharedAppMessage) => {
    if (sendSharedMessageNow(message)) {
      return
    }

    if (message.kind === 'state-snapshot' || message.kind === 'game-state-snapshot') {
      pendingSharedMessagesRef.current = pendingSharedMessagesRef.current.filter((pendingMessage) => pendingMessage.kind !== message.kind)
    }

    pendingSharedMessagesRef.current.push(message)
  }, [sendSharedMessageNow])

  const applySharedState = useCallback((state: SharedAppState) => {
    const normalizedState: SharedAppState = {
      ...state,
      giftConfigs: state.giftConfigs.map(normalizeGiftConfig),
    }
    skippedSharedStateRef.current = JSON.stringify(normalizedState)
    setUsername(normalizedState.username)
    setAvatarUrl(normalizedState.avatarUrl)
    setTikTokLiveId(normalizedState.tiktokLiveId)
    setGiftConfigs(normalizedState.giftConfigs)
  }, [setGiftConfigs, setTikTokLiveId])

  const broadcastCurrentGameState = useCallback(() => {
    broadcastSharedMessage({
      kind: 'game-state-snapshot',
      sourceId: instanceId,
      state: getSharedGameStateRef.current(),
    })
  }, [broadcastSharedMessage, instanceId])

  useEffect(() => {
    broadcastCurrentGameStateRef.current = broadcastCurrentGameState
  }, [broadcastCurrentGameState])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabaseRealtimeEnabled) {
      let disposed = false

      const scheduleReconnect = () => {
        if (disposed || reconnectTimeoutRef.current !== null) {
          return
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null
          connectSyncSocket()
        }, 1200)
      }

      const connectSyncSocket = () => {
        if (disposed) {
          return
        }

        const socketUrls = getLocalBridgeWebSocketUrls()
        const socketUrl = socketUrls[syncSocketUrlIndexRef.current % socketUrls.length]
        syncSocketUrlIndexRef.current += 1
        const socket = new WebSocket(socketUrl)
        syncSocketRef.current = socket

        socket.addEventListener('open', () => {
          syncSocketUrlIndexRef.current = 0
          syncReadyRef.current = true
          setSyncConnected(true)
          flushPendingSharedMessages()
          broadcastSharedMessage({
            kind: 'state-request',
            sourceId: instanceId,
          })
          broadcastSharedMessage({
            kind: 'game-state-request',
            sourceId: instanceId,
          })
        })

        socket.addEventListener('message', (messageEvent) => {
          const message = JSON.parse(String(messageEvent.data)) as LocalBridgeSocketMessage
          if (message.type !== 'app-sync') {
            return
          }

          const payload = message.payload
          if (payload.sourceId === instanceId) {
            return
          }

          if (payload.kind === 'manual-donation') {
            donateRef.current(payload.event)
            return
          }

          if (payload.kind === 'game-state-request') {
            broadcastCurrentGameState()
            return
          }

          if (payload.kind === 'game-state-snapshot') {
            applySharedGameStateRef.current(payload.state)
            return
          }

          if (payload.kind === 'reset-game') {
            resetGameRef.current()
            return
          }

          if (payload.kind === 'state-request') {
            if (!sharedStateRef.current) {
              return
            }

            broadcastSharedMessage({
              kind: 'state-snapshot',
              sourceId: instanceId,
              state: sharedStateRef.current,
            })
            return
          }

          applySharedState(payload.state)
        })

        socket.addEventListener('error', () => {
          syncReadyRef.current = false
          setSyncConnected(false)
        })

        socket.addEventListener('close', () => {
          syncReadyRef.current = false
          setSyncConnected(false)
          syncSocketRef.current = null
          scheduleReconnect()
        })
      }

      connectSyncSocket()

      return () => {
        disposed = true
        syncReadyRef.current = false
        setSyncConnected(false)
        if (reconnectTimeoutRef.current !== null) {
          window.clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        syncSocketRef.current?.close()
        syncSocketRef.current = null
      }
    }

    if (!supabase) {
      return
    }

    if (!hasValidSyncCode) {
      syncReadyRef.current = false
      setSyncConnected(false)
      if (syncChannelRef.current) {
        void supabase.removeChannel(syncChannelRef.current)
        syncChannelRef.current = null
      }
      return
    }

    const channel = supabase.channel(appSyncChannelName)
    syncChannelRef.current = channel

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const message = payload as SharedAppMessage
      if (message.sourceId === instanceId) {
        return
      }

      if (message.kind === 'manual-donation') {
        donateRef.current(message.event)
        return
      }

      if (message.kind === 'game-state-request') {
        broadcastCurrentGameState()
        return
      }

      if (message.kind === 'game-state-snapshot') {
        applySharedGameStateRef.current(message.state)
        return
      }

      if (message.kind === 'reset-game') {
        resetGameRef.current()
        return
      }

      if (message.kind === 'state-request') {
        if (!sharedStateRef.current) {
          return
        }

        broadcastSharedMessage({
          kind: 'state-snapshot',
          sourceId: instanceId,
          state: sharedStateRef.current,
        })
        return
      }

      applySharedState(message.state)
    })

    channel.subscribe((subscriptionStatus) => {
      if (subscriptionStatus === 'SUBSCRIBED') {
        syncReadyRef.current = true
        setSyncConnected(true)
        flushPendingSharedMessages()
        broadcastSharedMessage({
          kind: 'state-request',
          sourceId: instanceId,
        })
        broadcastSharedMessage({
          kind: 'game-state-request',
          sourceId: instanceId,
        })
        return
      }

      if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT' || subscriptionStatus === 'CLOSED') {
        syncReadyRef.current = false
        setSyncConnected(false)
      }
    })

    return () => {
      syncReadyRef.current = false
      setSyncConnected(false)
      if (syncChannelRef.current === channel) {
        syncChannelRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [appSyncChannelName, applySharedState, broadcastCurrentGameState, broadcastSharedMessage, flushPendingSharedMessages, hasValidSyncCode, instanceId])

  useEffect(() => {
    if (!syncChannelRef.current && syncSocketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }

    if (skippedSharedStateRef.current === sharedAppStateSerialized) {
      skippedSharedStateRef.current = null
      return
    }

    broadcastSharedMessage({
      kind: 'state-snapshot',
      sourceId: instanceId,
      state: sharedAppState,
    })
  }, [broadcastSharedMessage, instanceId, sharedAppState, sharedAppStateSerialized])

  const canTriggerManualGift = username.trim().length > 0

  const triggerManualDonation = useCallback((preset: GiftConfig, quantity = 1) => {
    if (!preset.enabled || !username.trim()) {
      return
    }

    const normalizedQuantity = Math.max(1, quantity)

    if (simulationQuantityMode === 'single') {
      const event = buildManualDonationEvent(username, avatarUrl, preset, normalizedQuantity)
      donate(event)
      broadcastSharedMessage({
        kind: 'manual-donation',
        sourceId: instanceId,
        event,
      })
      return
    }

    for (let index = 0; index < normalizedQuantity; index += 1) {
      const simulatedUsername = buildSimulationUsername(username, index)
      const event = buildManualDonationEvent(simulatedUsername, avatarUrl, preset, 1)
      event.timestamp += index

      donate(event)

      broadcastSharedMessage({
        kind: 'manual-donation',
        sourceId: instanceId,
        event,
      })
    }
  }, [avatarUrl, broadcastSharedMessage, donate, instanceId, simulationQuantityMode, username])

  const triggerManualExtraInteraction = useCallback((interactionId: 'comment-bubble' | 'tap-tap-like', quantity = 1) => {
    if (!username.trim()) {
      return
    }

    const normalizedQuantity = Math.max(1, quantity)

    if (interactionId === 'tap-tap-like') {
      const event: DonationEvent = {
        username,
        avatarUrl,
        hpDelta: 0.25 * normalizedQuantity,
        sourceLabel: 'Tap Tap',
        action: 'boost',
        quantity: normalizedQuantity,
        timestamp: Date.now(),
      }

      donate(event)
      broadcastSharedMessage({
        kind: 'manual-donation',
        sourceId: instanceId,
        event,
      })
      return
    }

    if (simulationQuantityMode === 'single') {
      const event: DonationEvent = {
        username,
        avatarUrl,
        hpDelta: 0.25 * normalizedQuantity,
        sourceLabel: 'Chat',
        action: 'comment',
        commentText: username,
        quantity: normalizedQuantity,
        timestamp: Date.now(),
      }

      donate(event)
      broadcastSharedMessage({
        kind: 'manual-donation',
        sourceId: instanceId,
        event,
      })
      return
    }

    for (let index = 0; index < normalizedQuantity; index += 1) {
      const event: DonationEvent = {
        username: buildSimulationUsername(username, index),
        avatarUrl,
        hpDelta: 0.25,
        sourceLabel: 'Chat',
        action: 'comment',
        commentText: buildSimulationUsername(username, index),
        quantity: 1,
        timestamp: Date.now() + index,
      }

      donate(event)
      broadcastSharedMessage({
        kind: 'manual-donation',
        sourceId: instanceId,
        event,
      })
    }
  }, [avatarUrl, broadcastSharedMessage, donate, instanceId, simulationQuantityMode, username])

  const resetMonitorState = useCallback(() => {
    pendingTapTapCountsRef.current.clear()
    resetGame()
    broadcastSharedMessage({
      kind: 'reset-game',
      sourceId: instanceId,
    })
    broadcastCurrentGameState()
  }, [broadcastCurrentGameState, broadcastSharedMessage, instanceId, resetGame])

  const downloadDonations = useCallback(() => {
    const serializedHistory = donationHistory.map((event) => ({
      usuario: event.username,
      avatar: event.avatarUrl,
      hp: event.hpDelta,
      origen: event.sourceLabel,
      accion: event.action,
      cantidad: event.quantity,
      comentario: event.commentText ?? '',
      fecha: new Date(event.timestamp).toISOString(),
    }))

    const blob = new Blob([JSON.stringify(serializedHistory, null, 2)], { type: 'application/json;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = objectUrl
    link.download = `donaciones-${timestamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }, [donationHistory])

  const navigateTo = useCallback((pathname: '/' | '/batalla' | '/config') => {
    if (window.location.pathname === pathname) {
      setRoute(getCurrentRoute())
      return
    }

    window.history.pushState({}, '', pathname)
    setRoute(getCurrentRoute())
  }, [])

  const navigateBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    navigateTo('/')
  }, [navigateTo])

  const submitHomeSyncCode = useCallback(() => {
    const nextCode = normalizeSyncRoomCode(homeSyncCodeInput)
    if (!isValidSyncRoomCode(nextCode)) {
      return
    }

    setSyncCode(nextCode)
    navigateTo('/')
  }, [homeSyncCodeInput, navigateTo, setSyncCode])

  const leaveRoom = useCallback(() => {
    pendingTapTapCountsRef.current.clear()
    setSyncCode('')
    setHomeSyncCodeInput('')
    navigateTo('/')
  }, [navigateTo, setSyncCode])

  function updateGiftConfig(giftId: string, field: keyof GiftConfig, value: string | number | boolean) {
    setGiftConfigs((current) =>
      current.map((gift) => (gift.id === giftId ? { ...gift, [field]: value } : gift)),
    )
  }

  function addGiftConfig() {
    setGiftConfigs((current) => [
      ...current,
      {
        id: `custom-${crypto.randomUUID()}`,
        giftName: 'Nuevo regalo',
        imageUrl: '',
        hpReward: 100,
        action: 'boost',
        enabled: true,
      },
    ])
  }

  if (!hasValidSyncCode) {
    return (
      <>
        {pullRefreshIndicator}
        <main className="min-h-screen bg-[#111315] px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl items-center justify-center">
            <section className="w-full max-w-2xl overflow-hidden rounded-[36px] border border-white/8 bg-[#17191c] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.22)] sm:p-8 lg:p-10">
              <p className="text-[11px] uppercase tracking-[0.38em] text-slate-500">Circular Saw</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-50 sm:text-5xl">Entrar a sala</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
                Coloca una clave de 6 digitos. Si en tu celular y en tu PC usas la misma clave, ambos dispositivos comparten la misma sala y veran las mismas donaciones.
              </p>

              <div className="mt-8 rounded-[30px] border border-white/8 bg-[#1d2126] p-5">
                <label className="block text-sm font-medium text-slate-300">
                  Clave de sala
                  <input
                    value={homeSyncCodeInput}
                    onChange={(event) => setHomeSyncCodeInput(normalizeSyncRoomCode(event.target.value))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="123456"
                    className="mt-3 w-full rounded-2xl border border-white/8 bg-[#111315] px-4 py-4 text-center text-2xl font-black tracking-[0.42em] text-slate-50 outline-none transition focus:border-slate-500"
                  />
                </label>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={submitHomeSyncCode}
                    disabled={!isValidSyncRoomCode(homeSyncCodeInput)}
                    className="rounded-2xl border border-white/10 bg-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Entrar
                  </button>
                  <span className={`text-xs ${isValidSyncRoomCode(homeSyncCodeInput) ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {isValidSyncRoomCode(homeSyncCodeInput) ? 'Clave lista para entrar' : 'La clave debe tener 6 digitos'}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </>
    )
  }

  if (route === 'battle') {
    return (
      <>
        {pullRefreshIndicator}
        <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#19324f_0%,#09111c_52%,#05070b_100%)] text-slate-100">
          <GameCanvas
            canvasRef={canvasRef}
            activeCount={activeSaws.length}
            canvasSize={canvasSize}
            fullscreen
            topDonors={topDonors}
            gifts={enabledGiftConfigs}
            recentEvents={recentEvents}
            roundStatus={roundStatus}
            audioEnabled={audioEnabled}
            onToggleAudio={() => {
              void toggleAudio()
            }}
            onTopDonorsSecretTap={() => navigateTo('/')}
          />
        </main>
      </>
    )
  }

  if (route === 'home') {
    return (
      <>
        {pullRefreshIndicator}
        <main className="min-h-screen bg-[#111315] px-4 py-5 text-slate-50 sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl items-center justify-center">
            <section className="w-full overflow-hidden rounded-[36px] border border-white/8 bg-[#17191c] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.22)] sm:p-8 lg:p-10">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.38em] text-slate-500">Circular Saw</p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">
                    Inicio
                  </h1>

                  <div className="mt-6 max-w-xl rounded-[30px] border border-white/8 bg-[#1d2126] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sala compartida</p>
                        <h2 className="mt-2 text-2xl font-black text-slate-50">Sala {normalizedSyncCode}</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Esta sala queda enlazada entre dispositivos mientras usen la misma clave.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={leaveRoom}
                        className="rounded-2xl border border-white/8 bg-[#111315] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-[#23272c]"
                      >
                        Abandonar sala
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => navigateTo('/batalla')}
                      className="rounded-[28px] border border-white/10 bg-slate-100 px-6 py-8 text-left shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:bg-white"
                    >
                      <strong className="mt-3 block text-3xl font-black text-slate-950">Batalla</strong>
                      <span className="mt-3 block text-sm leading-6 text-slate-600">
                        Abre el widget del campo completo
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo('/config')}
                      className="rounded-[28px] border border-white/8 bg-[#1d2126] px-6 py-8 text-left transition hover:border-white/14 hover:bg-[#23272c]"
                    >
                      <strong className="mt-3 block text-3xl font-black text-slate-50">Administrar</strong>
                      <span className="mt-3 block text-sm leading-6 text-slate-400">
                        Entra al panel de administracion
                      </span>
                    </button>
                  </div>
              </div>

              <div className="rounded-[30px] border border-white/8 bg-[#1d2126] p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Flujo recomendado</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-950">1</span>
                    <div>
                      <strong className="block text-slate-50">Abre Administrar</strong>
                      <span className="text-slate-400">Conecta el live y ajusta premios.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#111315] text-xs font-black text-slate-200">2</span>
                    <div>
                      <strong className="block text-slate-50">Lanza Batalla</strong>
                      <span className="text-slate-400">Muestra el campo limpio en PC u OBS.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#111315] text-xs font-black text-slate-200">3</span>
                    <div>
                      <strong className="block text-slate-50">Prueba o transmite</strong>
                      <span className="text-slate-400">Simula regalos o espera los eventos reales.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </section>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      {pullRefreshIndicator}
      <main className="min-h-screen bg-[#111315] px-3 pb-28 pt-3 text-slate-50 sm:px-5 sm:pb-32 sm:pt-4 lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1800px] gap-4 sm:min-h-[calc(100vh-2.5rem)]">
          <DonationControls
            username={username}
            avatarUrl={avatarUrl}
            tiktokLiveId={tiktokLiveId}
            bridgeUrl={bridgeUrl}
            syncConnected={syncConnected}
            syncCode={normalizedSyncCode}
            syncRemoteEnabled={supabaseRealtimeEnabled}
            presets={normalizedGiftConfigs}
            activeSaws={activeSaws}
            recentEvents={recentEvents}
            connectionStatus={status}
            onUsernameChange={setUsername}
            onAvatarUrlChange={setAvatarUrl}
            onTikTokLiveIdChange={setTikTokLiveId}
            onGiftConfigChange={updateGiftConfig}
            onAddGiftConfig={addGiftConfig}
            onConnectTikTok={connect}
            onDisconnectTikTok={disconnect}
            onNavigateBack={navigateBack}
            onNavigateBattle={() => navigateTo('/batalla')}
            onResetMonitor={resetMonitorState}
            onDownloadDonations={downloadDonations}
            onLeaveRoom={leaveRoom}
            donationCount={donationHistory.length}
            activeSection={activeAdminSection}
            simulationPanel={(
              <GiftMenuStrip
                gifts={enabledGiftConfigs}
                disabled={!canTriggerManualGift}
                onGiftSelect={triggerManualDonation}
                onExtraInteractionSelect={triggerManualExtraInteraction}
                quantityMode={simulationQuantityMode}
                onQuantityModeChange={setSimulationQuantityMode}
              />
            )}
            leaderboardPanel={<Leaderboard entries={leaderboard} />}
          />

          <BottomTabMenu
            items={[
              { id: 'connect', label: 'Conectar', icon: <TabIcon section="connect" /> },
              { id: 'simulate', label: 'Simular', icon: <TabIcon section="simulate" /> },
              { id: 'gifts', label: 'Premios', icon: <TabIcon section="gifts" /> },
              { id: 'monitor', label: 'Monitorear', icon: <TabIcon section="monitor" /> },
            ]}
            activeItemId={activeAdminSection}
            onSelect={setActiveAdminSection}
          />
        </div>
      </main>
    </>
  )
}

export default App
