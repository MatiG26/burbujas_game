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
import { appSyncChannelName, getLocalBridgeWebSocketUrl, getSupabaseClient, supabaseRealtimeEnabled } from './lib/supabase'
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

const migratedDefaultGiftConfigMap = new Map([
  ['rose', { giftName: 'Rosa 2', imageUrl: currentRoseImageUrl, hpReward: 10, action: 'boost' as const }],
  ['tiktok', { giftName: 'Corazon coreano', imageUrl: koreanHeartImageUrl, hpReward: 55, action: 'boost' as const }],
  ['korean-heart', { giftName: 'Corazon coreano', imageUrl: koreanHeartImageUrl, hpReward: 55, action: 'boost' as const }],
  ['split-saw', { giftName: 'Rosa', imageUrl: secondRoseImageUrl, hpReward: 110, action: 'boost' as const }],
  ['second-rose', { giftName: 'Rosa', imageUrl: secondRoseImageUrl, hpReward: 110, action: 'boost' as const }],
  ['perfume', { giftName: 'Perfume', imageUrl: perfumeImageUrl, hpReward: 220, action: 'boost' as const }],
  ['treasure-box', { giftName: 'Confeti', imageUrl: confettiImageUrl, hpReward: 1000, action: 'confetti' as const }],
  ['confetti', { giftName: 'Confeti', imageUrl: confettiImageUrl, hpReward: 1000, action: 'confetti' as const }],
  ['lion', { giftName: 'Guante de boxeo', imageUrl: boxingGloveImageUrl, hpReward: 3000, action: 'boxing' as const }],
  ['boxing-glove', { giftName: 'Guante de boxeo', imageUrl: boxingGloveImageUrl, hpReward: 3000, action: 'boxing' as const }],
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
  const migratedDefault = migratedDefaultGiftConfigMap.get(gift.id)

  return {
    ...gift,
    ...(migratedDefault ?? {}),
    enabled: gift.enabled ?? true,
    imageUrl:
      gift.id === 'rose' && (gift.imageUrl === legacyRoseImageUrl || gift.imageUrl.trim().length === 0)
        ? currentRoseImageUrl
        : (migratedDefault?.imageUrl || gift.imageUrl),
  }
}

function buildManualDonationEvent(
  username: string,
  avatarUrl: string,
  preset: GiftConfig,
): DonationEvent {
  return {
    username,
    avatarUrl,
    hpDelta: preset.action === 'split' ? 0 : preset.hpReward,
    sourceLabel: preset.giftName,
    sourceImageUrl: preset.imageUrl,
    action: preset.action,
    quantity: 1,
    timestamp: Date.now(),
  }
}

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute())
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSection>('connect')
  const [username, setUsername] = useState('StreamerPro')
  const [avatarUrl, setAvatarUrl] = useState(
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  )
  const [tiktokLiveId, setTikTokLiveId] = useLocalStorageState('circular-saw:tiktok-live-id', '')
  const [giftConfigs, setGiftConfigs] = useLocalStorageState<GiftConfig[]>(
    'circular-saw:gift-configs',
    defaultGiftConfigs,
  )
  const [instanceId] = useState(() => crypto.randomUUID())
  const syncChannelRef = useRef<RealtimeChannel | null>(null)
  const syncSocketRef = useRef<WebSocket | null>(null)
  const sharedStateRef = useRef<SharedAppState | null>(null)
  const skippedSharedStateRef = useRef<string | null>(null)
  const { canvasRef, canvasSize, leaderboard, activeSaws, recentEvents, audioEnabled, enableAudio, donate } =
    useCircularSawGame()

  useEffect(() => {
    if (giftConfigs.length === 0) {
      setGiftConfigs(defaultGiftConfigs)
      return
    }

    if (giftConfigs.some((gift) => gift.enabled === undefined)) {
      setGiftConfigs((current) => current.map(normalizeGiftConfig))
    }
  }, [giftConfigs, setGiftConfigs])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const normalizedGiftConfigs = useMemo(
    () => sortGiftConfigs(giftConfigs.map(normalizeGiftConfig)),
    [giftConfigs],
  )

  const enabledGiftConfigs = useMemo(
    () => normalizedGiftConfigs.filter((gift) => gift.enabled),
    [normalizedGiftConfigs],
  )

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

  const topDonors = useMemo(() => leaderboard.slice(0, 3), [leaderboard])

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
        donate({
          username: event.username,
          avatarUrl: event.avatarUrl,
          hpDelta: 0.25 * Math.max(1, event.repeatCount),
          sourceLabel: 'Like',
          sourceImageUrl: event.giftImageUrl,
          action: 'boost',
          quantity: Math.max(1, event.repeatCount),
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

      if (mappedGift.action === 'confetti' || mappedGift.action === 'boxing') {
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

  const broadcastSharedMessage = useCallback((message: SharedAppMessage) => {
    if (supabaseRealtimeEnabled) {
      const channel = syncChannelRef.current
      if (!channel) {
        return
      }

      void channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: message,
      })
      return
    }

    if (syncSocketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }

    const envelope: AppSyncTransportMessage = {
      type: 'app-sync',
      payload: message,
    }
    syncSocketRef.current.send(JSON.stringify(envelope))
  }, [])

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

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabaseRealtimeEnabled) {
      const socket = new WebSocket(getLocalBridgeWebSocketUrl())
      syncSocketRef.current = socket

      socket.addEventListener('open', () => {
        broadcastSharedMessage({
          kind: 'state-request',
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
          donate(payload.event)
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

      socket.addEventListener('close', () => {
        syncSocketRef.current = null
      })

      return () => {
        syncSocketRef.current?.close()
        syncSocketRef.current = null
      }
    }

    if (!supabase) {
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
        donate(message.event)
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
        broadcastSharedMessage({
          kind: 'state-request',
          sourceId: instanceId,
        })
      }
    })

    return () => {
      if (syncChannelRef.current === channel) {
        syncChannelRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [applySharedState, broadcastSharedMessage, donate, instanceId])

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

  const battleUrl = `${window.location.origin}/batalla`
  const configUrl = `${window.location.origin}/config`
  const canTriggerManualGift = username.trim().length > 0

  const triggerManualDonation = useCallback((preset: GiftConfig) => {
    if (!preset.enabled || !username.trim()) {
      return
    }

    const event = buildManualDonationEvent(username, avatarUrl, preset)

    donate(event)

    broadcastSharedMessage({
      kind: 'manual-donation',
      sourceId: instanceId,
      event,
    })
  }, [avatarUrl, broadcastSharedMessage, donate, instanceId, username])

  const navigateTo = useCallback((pathname: '/' | '/batalla' | '/config') => {
    if (window.location.pathname === pathname) {
      setRoute(getCurrentRoute())
      return
    }

    window.history.pushState({}, '', pathname)
    setRoute(getCurrentRoute())
  }, [])

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

  if (route === 'battle') {
    return (
      <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#19324f_0%,#09111c_52%,#05070b_100%)] text-slate-100">
        <GameCanvas
          canvasRef={canvasRef}
          activeCount={activeSaws.length}
          canvasSize={canvasSize}
          fullscreen
          topDonors={topDonors}
          gifts={enabledGiftConfigs}
          audioEnabled={audioEnabled}
          onEnableAudio={() => {
            void enableAudio()
          }}
        />
      </main>
    )
  }

  if (route === 'home') {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#79e6f2_0%,rgba(121,230,242,0)_24%),linear-gradient(180deg,#114a60_0%,#0a293a_52%,#05131d_100%)] px-4 py-5 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl items-center justify-center">
          <section className="w-full overflow-hidden rounded-[38px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.1),rgba(2,6,23,0.48))] p-6 shadow-[0_30px_100px_rgba(2,12,27,0.45)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.38em] text-cyan-100/70">Circular Saw</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Elige a donde entrar
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-50/78 sm:text-base">
              Usa batalla para abrir el campo limpio del juego y config para conectar TikTok,
              editar regalos y lanzar pruebas manuales.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-cyan-50/78">
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">Widget para OBS</span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">Control desde celular</span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2">TikTok Live</span>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => navigateTo('/batalla')}
                className="rounded-[30px] border border-cyan-100/20 bg-[linear-gradient(160deg,rgba(94,234,212,0.26),rgba(8,145,178,0.2))] px-6 py-8 text-left shadow-[0_20px_60px_rgba(8,145,178,0.2)] transition hover:border-cyan-100/35 hover:bg-[linear-gradient(160deg,rgba(94,234,212,0.34),rgba(8,145,178,0.28))]"
              >
                <span className="block text-xs uppercase tracking-[0.32em] text-cyan-100/70">Ruta</span>
                <strong className="mt-3 block text-3xl font-black text-white">Batalla</strong>
                <span className="mt-3 block text-sm leading-6 text-cyan-50/75">
                  Abre el widget del campo completo en /batalla.
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/config')}
                className="rounded-[30px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.12),rgba(15,23,42,0.38))] px-6 py-8 text-left shadow-[0_20px_60px_rgba(15,23,42,0.28)] transition hover:border-white/20 hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.18),rgba(15,23,42,0.48))]"
              >
                <span className="block text-xs uppercase tracking-[0.32em] text-slate-200/70">Ruta</span>
                <strong className="mt-3 block text-3xl font-black text-white">Administrar</strong>
                <span className="mt-3 block text-sm leading-6 text-slate-200/78">
                  Entra al panel de administracion en /config.
                </span>
              </button>
                </div>

                <div className="mt-8 grid gap-3 text-xs text-slate-200/80 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                <span className="block uppercase tracking-[0.24em] text-slate-300/55">Batalla</span>
                <strong className="mt-1 block text-sm text-white">{battleUrl}</strong>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
                <span className="block uppercase tracking-[0.24em] text-slate-300/55">Config</span>
                <strong className="mt-1 block text-sm text-white">{configUrl}</strong>
              </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-slate-950/22 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-200/70">Flujo recomendado</p>
                <div className="mt-4 space-y-3 text-sm text-slate-100/88">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300/14 text-xs font-black text-cyan-100">1</span>
                    <div>
                      <strong className="block text-white">Abre Administrar</strong>
                      <span className="text-slate-300/78">Conecta el live y ajusta premios.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300/14 text-xs font-black text-emerald-100">2</span>
                    <div>
                      <strong className="block text-white">Lanza Batalla</strong>
                      <span className="text-slate-300/78">Muestra el campo limpio en PC u OBS.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-300/14 text-xs font-black text-orange-100">3</span>
                    <div>
                      <strong className="block text-white">Prueba o transmite</strong>
                      <span className="text-slate-300/78">Simula regalos o espera los eventos reales.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.22),transparent_24%),linear-gradient(180deg,#0d3042_0%,#071825_48%,#041019_100%)] px-3 py-3 text-slate-100 sm:px-5 sm:py-4 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1800px] gap-4 sm:min-h-[calc(100vh-2.5rem)]">
        <section className="sticky top-0 z-30 overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.06),rgba(2,6,23,0.72))] px-3 py-2 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <p className="text-[10px] uppercase tracking-[0.34em] text-sky-200/75">Administrar</p>
              <span className="hidden text-sm text-slate-300/78 sm:inline">/config administra y /batalla muestra el widget.</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigateTo('/batalla')}
                className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400/25"
              >
                Batalla
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-300/20"
              >
                Inicio
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/config')}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Administrar
              </button>
            </div>
          </div>
        </section>

        <DonationControls
          username={username}
          avatarUrl={avatarUrl}
          tiktokLiveId={tiktokLiveId}
          bridgeUrl={bridgeUrl}
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
          activeSection={activeAdminSection}
          simulationPanel={(
            <GiftMenuStrip
              gifts={enabledGiftConfigs}
              disabled={!canTriggerManualGift}
              onGiftSelect={triggerManualDonation}
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
  )
}

export default App
