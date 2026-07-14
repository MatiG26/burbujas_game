import { useState, type ReactNode } from 'react'
import type { ActiveSawSummary, DonationEvent, GiftConfig, TikTokBridgeStatus } from '../types/game'

export type AdminSection = 'connect' | 'simulate' | 'gifts' | 'monitor'

interface DonationControlsProps {
  username: string
  avatarUrl: string
  tiktokLiveId: string
  bridgeUrl: string
  syncConnected: boolean
  syncCode: string
  syncRemoteEnabled: boolean
  presets: GiftConfig[]
  activeSaws: ActiveSawSummary[]
  recentEvents: DonationEvent[]
  connectionStatus: TikTokBridgeStatus
  onUsernameChange: (value: string) => void
  onAvatarUrlChange: (value: string) => void
  onTikTokLiveIdChange: (value: string) => void
  onGiftConfigChange: (giftId: string, field: keyof GiftConfig, value: string | number | boolean) => void
  onAddGiftConfig: () => void
  onConnectTikTok: () => void
  onDisconnectTikTok: () => void
  onNavigateBack: () => void
  onNavigateBattle: () => void
  onResetMonitor: () => void
  onDownloadDonations: () => void
  onLeaveRoom: () => void
  donationCount: number
  activeSection: AdminSection
  simulationPanel?: ReactNode
  leaderboardPanel?: ReactNode
}

function formatCompact(value: number) {
  if (value > 0 && value < 1) {
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  }

  return new Intl.NumberFormat('es', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function getBridgeLabel(state: TikTokBridgeStatus['state']) {
  switch (state) {
    case 'connected':
      return 'Live conectado'
    case 'connecting':
      return 'Conectando live'
    case 'error':
      return 'Error de conexion'
    default:
      return 'Live desconectado'
  }
}

function getArenaLabel(activeSaws: number) {
  if (activeSaws === 0) {
    return 'Arena vacia'
  }

  if (activeSaws === 1) {
    return '1 sierra activa'
  }

  return `${activeSaws} sierras activas`
}

function getFeedLabel(events: number) {
  if (events === 0) {
    return 'Sin eventos'
  }

  if (events === 1) {
    return '1 evento reciente'
  }

  return `${events} eventos recientes`
}

function getSyncLabel(syncConnected: boolean) {
  return syncConnected ? 'Sync listo' : 'Sync desconectado'
}

export function TabIcon({ section }: { section: AdminSection }) {
  if (section === 'connect') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M7 7a5 5 0 0 1 8.54-3.54l-1.42 1.41A3 3 0 1 0 15 9h2a5 5 0 0 1-10 0Zm0 8h2a3 3 0 1 0 5.88-1h2.04A5 5 0 1 1 7 15Zm12-3-3 3v-2h-4v-2h4V9l3 3ZM8 11v2H4v2l-3-3 3-3v2h4Z" />
      </svg>
    )
  }

  if (section === 'simulate') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M8 5v14l11-7L8 5Zm-4 0h2v14H4V5Z" />
      </svg>
    )
  }

  if (section === 'gifts') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="currentColor" d="M20 7h-2.18A3 3 0 0 0 12 4.76 3 3 0 0 0 6.18 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-5-1a1 1 0 1 1 1 1h-3a1 1 0 1 1 2-1ZM8 5a1 1 0 0 1 1 1 1 1 0 0 1-1 1H5a1 1 0 0 1 1-1Zm3 13H7v-6h4v6Zm6 0h-4v-6h4v6Zm2-8H5V9h14v1Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
    </svg>
  )
}

export function DonationControls({
  username,
  avatarUrl,
  tiktokLiveId,
  bridgeUrl,
  syncConnected,
  syncCode,
  syncRemoteEnabled,
  presets,
  activeSaws,
  recentEvents,
  connectionStatus,
  onUsernameChange,
  onAvatarUrlChange,
  onTikTokLiveIdChange,
  onGiftConfigChange,
  onAddGiftConfig,
  onConnectTikTok,
  onDisconnectTikTok,
  onNavigateBack,
  onNavigateBattle,
  onResetMonitor,
  onDownloadDonations,
  onLeaveRoom,
  donationCount,
  activeSection,
  simulationPanel,
  leaderboardPanel,
}: DonationControlsProps) {
  const [openGiftId, setOpenGiftId] = useState<string | null>(null)

  return (
    <aside className="overflow-hidden rounded-[28px] border border-white/8 bg-[#17191c] shadow-[0_18px_36px_rgba(0,0,0,0.22)]">
      <div>
        <div className="border-b border-white/8 px-4 py-4 sm:px-5 lg:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onNavigateBack}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-[#111315] text-slate-200 transition hover:bg-[#23272c]"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M14.71 6.29a1 1 0 0 1 0 1.42L10.41 12l4.3 4.29a1 1 0 0 1-1.42 1.42l-5-5a1 1 0 0 1 0-1.42l5-5a1 1 0 0 1 1.42 0Z" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 px-2 text-center">
              <h2 className="truncate text-base font-black tracking-tight text-slate-50 sm:text-lg">Administracion</h2>
            </div>

            <button
              type="button"
              onClick={onNavigateBattle}
              className="rounded-full border border-white/10 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white"
            >
              ir a Batalla
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span className={`rounded-full border px-3 py-1.5 ${syncConnected ? 'border-emerald-300/20 bg-emerald-950/40 text-emerald-200' : 'border-amber-300/20 bg-amber-950/40 text-amber-200'}`}>{getSyncLabel(syncConnected)}</span>
            <span className="rounded-full border border-white/8 bg-[#111315] px-3 py-1.5">{getBridgeLabel(connectionStatus.state)}</span>
            <span className="rounded-full border border-white/8 bg-[#111315] px-3 py-1.5">{getArenaLabel(activeSaws.length)}</span>
            <span className="rounded-full border border-white/8 bg-[#111315] px-3 py-1.5">{getFeedLabel(recentEvents.length)}</span>
          </div>
        </div>

  <div className="space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          {activeSection === 'connect' ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-50">TikTok Live Bridge</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                    Conecta el live remoto y comparte los eventos con cualquier dispositivo que tenga abierto el panel o la batalla.
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] ${connectionStatus.state === 'connected' ? 'bg-emerald-950/60 text-emerald-300' : connectionStatus.state === 'connecting' ? 'bg-amber-950/60 text-amber-300' : connectionStatus.state === 'error' ? 'bg-rose-950/60 text-rose-300' : 'bg-[#111315] text-slate-400'}`}>
                  {connectionStatus.state}
                </span>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4 rounded-[24px] border border-white/8 bg-[#1d2126] p-4">
                  <label className="block text-sm font-medium text-slate-300">
                    Usuario del live
                    <input
                      value={tiktokLiveId}
                      onChange={(event) => onTikTokLiveIdChange(event.target.value)}
                      placeholder="@tu_canal o URL completa"
                      className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-4 py-3.5 text-sm text-slate-50 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={onConnectTikTok}
                      disabled={!tiktokLiveId.trim() || connectionStatus.state === 'connecting'}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-100 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {connectionStatus.state === 'connecting' ? (
                        <>
                          <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
                            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Conectando...
                        </>
                      ) : 'Conectar live'}
                    </button>
                    <button
                      type="button"
                      onClick={onDisconnectTikTok}
                      className="rounded-2xl border border-white/8 bg-[#111315] px-4 py-3.5 text-sm font-semibold text-slate-300 transition hover:bg-[#23272c]"
                    >
                      Desconectar
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-l border-white/8 pl-0 text-sm leading-6 text-slate-400 xl:pl-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Estado del bridge</p>
                  <p>Sala actual: {syncCode || 'sin configurar'}</p>
                  <p>Sync remoto: {syncRemoteEnabled ? 'disponible' : 'no configurado'}</p>
                  <p className="break-all">Bridge: {bridgeUrl}</p>
                  <p>Sync: {syncConnected ? 'conectado' : 'desconectado'}</p>
                  <p>Estado: {connectionStatus.message}</p>
                  {connectionStatus.roomId ? <p>Room ID: {connectionStatus.roomId}</p> : null}
                  <button
                    type="button"
                    onClick={onLeaveRoom}
                    className="mt-3 rounded-2xl border border-white/8 bg-[#111315] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-[#23272c]"
                  >
                    Abandonar sala
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'simulate' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
              <section className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-50 sm:text-xl">Datos del jugador</h3>
                  </div>
                  <div className="rounded-full border border-white/8 bg-[#111315] px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-400">
                    Modo prueba
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Usuario manual
                    <input
                      value={username}
                      onChange={(event) => onUsernameChange(event.target.value)}
                      placeholder="Ej. PlayerOne"
                      className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-4 py-3.5 text-sm text-slate-50 outline-none transition focus:border-slate-500"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-300">
                    URL del avatar manual
                    <input
                      value={avatarUrl}
                      onChange={(event) => onAvatarUrlChange(event.target.value)}
                      placeholder="https://..."
                      className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-4 py-3.5 text-sm text-slate-50 outline-none transition focus:border-slate-500"
                    />
                  </label>
                </div>
              </section>

              <div className="min-h-0">{simulationPanel}</div>
            </div>
          ) : null}

          {activeSection === 'gifts' ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-50">Configuracion de premios</h3>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={onAddGiftConfig}
                    className="rounded-2xl border border-white/10 bg-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-white"
                  >
                    Agregar donacion
                  </button>
                  <span className="text-xs text-slate-400">Sincronizable entre dispositivos</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#1d2126]">
                {presets.map((preset) => (
                  <div key={preset.id} className="border-b border-white/8 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenGiftId((current) => (current === preset.id ? null : preset.id))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#111315] p-1.5">
                          {preset.imageUrl ? (
                            <img src={preset.imageUrl} alt={preset.giftName} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-bold uppercase text-slate-500">Gift</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-slate-50">{preset.giftName || 'Nuevo regalo'}</strong>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>{preset.hpReward} HP</span>
                            <span className={`rounded-full px-2 py-0.5 ${preset.enabled ? 'bg-emerald-950/60 text-emerald-300' : 'bg-[#111315] text-slate-500'}`}>
                              {preset.enabled ? 'Visible' : 'Oculto'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className={`shrink-0 text-slate-400 transition ${openGiftId === preset.id ? 'rotate-180' : ''}`}>
                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                          <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z" />
                        </svg>
                      </span>
                    </button>

                    {openGiftId === preset.id ? (
                      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-5">
                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          Nombre del regalo
                          <input
                            value={preset.giftName}
                            onChange={(event) => onGiftConfigChange(preset.id, 'giftName', event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-3 py-3 text-sm text-slate-50 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          Imagen
                          <input
                            value={preset.imageUrl}
                            onChange={(event) => onGiftConfigChange(preset.id, 'imageUrl', event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-3 py-3 text-sm text-slate-50 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          HP otorgado
                          <input
                            type="number"
                            min="0"
                            value={preset.hpReward}
                            onChange={(event) => onGiftConfigChange(preset.id, 'hpReward', Number(event.target.value))}
                            className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-3 py-3 text-sm text-slate-50 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          Accion
                          <select
                            value={preset.action}
                            onChange={(event) => onGiftConfigChange(preset.id, 'action', event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/8 bg-[#111315] px-3 py-3 text-sm text-slate-50 outline-none focus:border-slate-500"
                          >
                            <option value="boost">Sumar HP</option>
                            <option value="split">Dividir sierra</option>
                            <option value="confetti">Confeti especial</option>
                            <option value="boxing">Golpe de boxeo</option>
                            <option value="lion">Leon jefe</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#111315] px-3 py-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-300 sm:col-span-2 xl:col-span-1 xl:self-end">
                          <input
                            type="checkbox"
                            checked={preset.enabled}
                            onChange={(event) => onGiftConfigChange(preset.id, 'enabled', event.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-400"
                          />
                          Visible en el campo
                        </label>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === 'monitor' ? (
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="grid min-w-0 gap-4">
                <section className="rounded-[24px] border border-white/8 bg-[#1d2126] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                        Acciones del monitor
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">Historial disponible: {donationCount} donaciones.</p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={onDownloadDonations}
                        className="rounded-2xl border border-white/8 bg-[#111315] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-[#23272c]"
                      >
                        Descargar
                      </button>
                      <button
                        type="button"
                        onClick={onResetMonitor}
                        className="rounded-2xl border border-rose-300/15 bg-rose-950/40 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/55"
                      >
                        Reiniciar
                      </button>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Sierras activas
                    </h3>
                    <span className="text-xs text-slate-400">{activeSaws.length} en arena</span>
                  </div>

                  <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#1d2126]">
                    {activeSaws.slice(0, 5).map((saw) => (
                      <article
                        key={saw.id}
                        className="border-b border-white/8 p-3.5 last:border-b-0"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3 text-sm text-slate-50">
                          <strong className="truncate">{saw.username}</strong>
                          <span className="shrink-0">{formatCompact(saw.hp)} HP</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-[#111315]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#fb923c,#facc15)]"
                            style={{ width: `${Math.max(8, Math.min(100, (saw.hp / Math.max(saw.maxHp, 1)) * 100))}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                          <span>Radio {saw.radius}px</span>
                          <span>{saw.isPrimary ? 'Principal' : 'Division'}</span>
                        </div>
                      </article>
                    ))}

                    {activeSaws.length === 0 ? (
                      <p className="px-4 py-5 text-sm text-slate-400">
                        Aun no hay sierras. Usa una donacion rapida o conecta el live para instanciar la primera.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Feed reciente
                  </h3>
                  <div className="overflow-hidden rounded-[24px] border border-white/8 bg-[#1d2126] text-sm text-slate-400">
                    {recentEvents.map((event) => (
                      <div
                        key={`${event.username}-${event.timestamp}`}
                        className="flex min-w-0 flex-col gap-1.5 border-b border-white/8 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <span className="min-w-0 truncate">{event.username}</span>
                        <span className="min-w-0 break-words text-slate-100 sm:max-w-[58%] sm:text-right">
                          {event.action === 'split' ? `${event.sourceLabel}: divide` : `${event.sourceLabel}: +${event.hpDelta} HP`}
                        </span>
                      </div>
                    ))}

                    {recentEvents.length === 0 ? (
                      <p className="px-4 py-4 text-slate-400">Sin eventos todavia.</p>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className="min-h-0 min-w-0">{leaderboardPanel}</div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
