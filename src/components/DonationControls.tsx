import type {
  ActiveSawSummary,
  DonationEvent,
  GiftConfig,
  TikTokBridgeStatus,
} from '../types/game'

interface DonationControlsProps {
  username: string
  avatarUrl: string
  tiktokLiveId: string
  bridgeUrl: string
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

export function DonationControls({
  username,
  avatarUrl,
  tiktokLiveId,
  bridgeUrl,
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
}: DonationControlsProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-4 rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-orange-300/80">Simulador + Live</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Control del widget</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300/80">
          Configura regalos, conecta tu TikTok Live y aplica HP o divisiones en tiempo real.
        </p>
      </div>

      <label className="block text-sm font-medium text-slate-100">
        Usuario manual
        <input
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder="Ej. PlayerOne"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/70"
        />
      </label>

      <label className="block text-sm font-medium text-slate-100">
        URL del avatar manual
        <input
          value={avatarUrl}
          onChange={(event) => onAvatarUrlChange(event.target.value)}
          placeholder="https://..."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-400/70"
        />
      </label>

      <div className="rounded-3xl border border-sky-300/15 bg-sky-500/8 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-100/80">
              TikTok Live Bridge
            </h3>
            <p className="mt-1 text-xs text-slate-300/75">Conecta el live remoto y comparte los eventos con cualquier dispositivo.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${connectionStatus.state === 'connected' ? 'bg-emerald-400/20 text-emerald-200' : connectionStatus.state === 'connecting' ? 'bg-amber-400/20 text-amber-100' : connectionStatus.state === 'error' ? 'bg-rose-400/20 text-rose-100' : 'bg-white/10 text-slate-300'}`}>
            {connectionStatus.state}
          </span>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-100">
          Usuario del live
          <input
            value={tiktokLiveId}
            onChange={(event) => onTikTokLiveIdChange(event.target.value)}
            placeholder="@tu_canal o URL completa"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/70"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onConnectTikTok}
            disabled={!tiktokLiveId.trim()}
            className="rounded-2xl border border-sky-300/30 bg-sky-400/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Conectar live
          </button>
          <button
            type="button"
            onClick={onDisconnectTikTok}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Desconectar
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-3 text-xs text-slate-300/80">
          <p>Bridge: {bridgeUrl}</p>
          <p className="mt-1">Estado: {connectionStatus.message}</p>
          {connectionStatus.roomId ? <p className="mt-1">Room ID: {connectionStatus.roomId}</p> : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300/70">
            Configuracion de premios
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddGiftConfig}
              className="rounded-xl border border-emerald-300/25 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400/25"
            >
              Agregar donacion
            </button>
            <span className="text-xs text-slate-400">Sincronizable entre dispositivos</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {presets.map((preset) => (
            <div key={preset.id} className="rounded-2xl border border-white/8 bg-white/5 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Nombre del regalo
                  <input
                    value={preset.giftName}
                    onChange={(event) => onGiftConfigChange(preset.id, 'giftName', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Imagen
                  <input
                    value={preset.imageUrl}
                    onChange={(event) => onGiftConfigChange(preset.id, 'imageUrl', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  HP otorgado
                  <input
                    type="number"
                    min="0"
                    value={preset.hpReward}
                    onChange={(event) => onGiftConfigChange(preset.id, 'hpReward', Number(event.target.value))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/60"
                  />
                </label>
                <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  Accion
                  <select
                    value={preset.action}
                    onChange={(event) => onGiftConfigChange(preset.id, 'action', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/60"
                  >
                    <option value="boost">Sumar HP</option>
                    <option value="split">Dividir sierra</option>
                    <option value="confetti">Confeti especial</option>
                    <option value="boxing">Golpe de boxeo</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-300 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={preset.enabled}
                    onChange={(event) => onGiftConfigChange(preset.id, 'enabled', event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-400"
                  />
                  Visible en el campo
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300/70">
            Sierras activas
          </h3>
          <span className="text-xs text-slate-400">{activeSaws.length} en arena</span>
        </div>

        <div className="mt-4 space-y-3">
          {activeSaws.slice(0, 5).map((saw) => (
            <article
              key={saw.id}
              className="rounded-2xl border border-white/8 bg-white/5 p-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm text-white">
                <strong className="truncate">{saw.username}</strong>
                <span>{formatCompact(saw.hp)} HP</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
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
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
              Aun no hay sierras. Usa una donacion rapida o conecta el live para instanciar la primera.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300/70">
          Feed reciente
        </h3>
        <div className="mt-4 space-y-2 text-sm text-slate-300/85">
          {recentEvents.map((event) => (
            <div
              key={`${event.username}-${event.timestamp}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2"
            >
              <span className="truncate">{event.username}</span>
              <span className="whitespace-nowrap text-orange-200">
                {event.action === 'split' ? `${event.sourceLabel}: divide` : `${event.sourceLabel}: +${event.hpDelta} HP`}
              </span>
            </div>
          ))}

          {recentEvents.length === 0 ? (
            <p className="text-slate-500">Sin eventos todavia.</p>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
