import { useCallback, useEffect, useMemo, useState } from 'react'
import { DonationControls } from './components/DonationControls'
import { GameCanvas } from './components/GameCanvas'
import { GiftMenuStrip } from './components/GiftMenuStrip'
import { Leaderboard } from './components/Leaderboard'
import { defaultGiftConfigs } from './game/constants'
import { useCircularSawGame } from './hooks/useCircularSawGame'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { useTikTokLive } from './hooks/useTikTokLive'
import type { DonationEvent, GiftConfig, LiveGiftEvent } from './types/game'

const legacyRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/rose.png'
const currentRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
const koreanHeartImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a4c4dc437fd3a6632aba149769491f49.png~tplv-obj.webp'
const secondRoseImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eb77ead5c3abb6da6034d3cf6cfeb438~tplv-obj.webp'
const perfumeImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/20b8f61246c7b6032777bb81bf4ee055~tplv-obj.webp'
const confettiImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cb4e11b3834e149f08e1cdcc93870b26~tplv-obj.webp'
const boxingGloveImageUrl = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9f8bd92363c400c284179f6719b6ba9c~tplv-obj.webp'
const manualDonationChannelName = 'circular-saw-manual-donations'
const manualDonationStorageKey = 'circular-saw:manual-donation-event'

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

type AppRoute = 'arena' | 'config'

function getCurrentRoute(): AppRoute {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  return pathname === '/config' ? 'config' : 'arena'
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

  useEffect(() => {
    const channel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(manualDonationChannelName)
      : null

    const applyRemoteDonation = (payload: { sourceId: string, event: DonationEvent }) => {
      if (payload.sourceId === instanceId) {
        return
      }

      donate(payload.event)
    }

    const handleMessage = (messageEvent: MessageEvent<{ sourceId: string, event: DonationEvent }>) => {
      applyRemoteDonation(messageEvent.data)
    }

    const handleStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key !== manualDonationStorageKey || !storageEvent.newValue) {
        return
      }

      try {
        applyRemoteDonation(JSON.parse(storageEvent.newValue) as { sourceId: string, event: DonationEvent })
      } catch {
        return
      }
    }

    channel?.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorage)

    return () => {
      channel?.removeEventListener('message', handleMessage)
      channel?.close()
      window.removeEventListener('storage', handleStorage)
    }
  }, [donate, instanceId])

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

  const widgetUrl = `${window.location.origin}/`
  const configUrl = `${window.location.origin}/config`
  const canTriggerManualGift = username.trim().length > 0

  const triggerManualDonation = useCallback((preset: GiftConfig) => {
    if (!preset.enabled || !username.trim()) {
      return
    }

    const event = buildManualDonationEvent(username, avatarUrl, preset)
    const payload = {
      sourceId: instanceId,
      event,
    }

    donate(event)

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(manualDonationChannelName)
      channel.postMessage(payload)
      channel.close()
    }

    window.localStorage.setItem(manualDonationStorageKey, JSON.stringify(payload))
  }, [avatarUrl, donate, instanceId, username])

  const navigateTo = useCallback((pathname: '/' | '/config') => {
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

  if (route === 'arena') {
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#19324f_0%,#09111c_52%,#05070b_100%)] px-4 py-4 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1800px] gap-4">
        <section className="rounded-[28px] border border-white/10 bg-slate-950/50 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-200/75">Panel separado</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Configuracion del widget
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300/80">
                Usa esta ruta para conectar TikTok, editar premios y lanzar donaciones manuales.
                El widget limpio para OBS o navegador queda en la ruta principal.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateTo('/')}
                className="rounded-2xl border border-emerald-300/25 bg-emerald-400/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400/25"
              >
                Abrir widget
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/config')}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Estas en /config
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-slate-300/75 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
              <span className="block uppercase tracking-[0.24em] text-slate-500">Widget</span>
              <strong className="mt-1 block text-sm text-white">{widgetUrl}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
              <span className="block uppercase tracking-[0.24em] text-slate-500">Config</span>
              <strong className="mt-1 block text-sm text-white">{configUrl}</strong>
            </div>
          </div>
        </section>

        <GiftMenuStrip
          gifts={enabledGiftConfigs}
          disabled={!canTriggerManualGift}
          onGiftSelect={triggerManualDonation}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_360px] xl:grid-cols-[minmax(0,1.75fr)_380px]">
          <section className="grid min-h-0 gap-4">
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
            />
          </section>

          <Leaderboard entries={leaderboard} />
        </div>
      </div>
    </main>
  )
}

export default App
