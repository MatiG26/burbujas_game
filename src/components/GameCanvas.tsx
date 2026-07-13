import type { CanvasSize, GiftConfig, LeaderboardEntry } from '../types/game'

const extraDonationEntries = [
  {
    id: 'comment-bubble',
    title: 'Chat',
    value: 'Burbuja',
    icon: 'chat',
  },
  {
    id: 'tap-tap-like',
    title: 'Tap Tap',
    value: '+0.25 HP',
    icon: 'heart',
  },
]

interface GameCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  activeCount: number
  canvasSize: CanvasSize
  fullscreen?: boolean
  topDonors?: LeaderboardEntry[]
  gifts?: GiftConfig[]
  audioEnabled?: boolean
  onToggleAudio?: () => void
  onTopDonorsSecretTap?: () => void
}

function formatValue(value: number) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  }).format(value)
}

function getTopDonorCardStyles(index: number) {
  if (index === 0) {
    return {
      card: 'border-yellow-200/60 bg-[linear-gradient(135deg,rgba(250,204,21,0.5),rgba(202,138,4,0.4))]',
      badge: 'text-yellow-950 bg-yellow-200/80',
      value: 'text-yellow-950',
      name: 'text-yellow-950',
      crown: true,
    }
  }

  if (index === 1) {
    return {
      card: 'border-slate-200/50 bg-[linear-gradient(135deg,rgba(226,232,240,0.4),rgba(148,163,184,0.32))]',
      badge: 'text-slate-900 bg-slate-200/75',
      value: 'text-slate-100',
      name: 'text-white',
      crown: false,
    }
  }

  return {
    card: 'border-amber-700/60 bg-[linear-gradient(135deg,rgba(180,83,9,0.45),rgba(120,53,15,0.34))]',
    badge: 'text-amber-100 bg-amber-800/75',
    value: 'text-amber-200',
    name: 'text-white',
    crown: false,
  }
}

export function GameCanvas({ canvasRef, activeCount, canvasSize, fullscreen = false, topDonors = [], gifts = [], audioEnabled = false, onToggleAudio, onTopDonorsSecretTap }: GameCanvasProps) {
  if (fullscreen) {
    return (
      <section className="relative flex h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#0d6d82_0%,#09536d_45%,#083a57_100%)] px-3 py-3 sm:px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(190,242,255,0.22),transparent_42%),radial-gradient(circle_at_bottom,rgba(12,74,110,0.32),transparent_45%)]" />

        <div className="relative z-10 shrink-0">
          <div className="grid gap-3">
            <div className="relative rounded-3xl border border-white/10 bg-slate-950/60 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center text-[10px] uppercase tracking-[0.28em] text-sky-100/75">
                  <span>Top</span>
                  {onTopDonorsSecretTap ? (
                    <button
                      type="button"
                      onClick={onTopDonorsSecretTap}
                      aria-label="Ir al inicio"
                      className="pointer-events-auto mx-1 rounded-sm px-0.5 text-sky-100/75"
                    >
                      3
                    </button>
                  ) : (
                    <span className="mx-1">3</span>
                  )}
                  <span>donadores</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400">En vivo</span>
                  <button
                    type="button"
                    onClick={onToggleAudio}
                    aria-label={audioEnabled ? 'Silenciar sonido' : 'Activar sonido'}
                    className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border transition ${audioEnabled ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100' : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/20'}`}
                  >
                    {audioEnabled ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path fill="currentColor" d="M14 8.82v6.36a4.5 4.5 0 0 0 0-6.36Zm2.5-2.95v2.16a8 8 0 0 1 0 8v2.1a10 10 0 0 0 0-12.26ZM3 10v4h4l5 4V6L7 10H3Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path fill="currentColor" d="M3 10v4h4l5 4V6L7 10H3Z" />
                        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M5 5 19 19" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {topDonors.map((entry, index) => {
                  const styles = getTopDonorCardStyles(index)

                  return (
                    <article
                      key={entry.id}
                      className={`rounded-2xl border px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${styles.card}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="relative shrink-0">
                          {styles.crown ? (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-base leading-none">
                              👑
                            </span>
                          ) : null}

                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.username}
                          className="h-10 w-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-black text-white">
                          {entry.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                        </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${styles.badge}`}>
                            #{index + 1}
                          </span>
                          <span className={`text-xs font-semibold ${styles.value}`}>
                            {formatValue(entry.totalDonated)} HP
                          </span>
                        </div>
                        <strong className={`mt-1 block truncate text-xs sm:text-sm ${styles.name}`}>
                          {entry.username}
                        </strong>
                      </div>
                    </div>
                    </article>
                  )
                })}

                {topDonors.length === 0 ? (
                  <div className="col-span-3 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-center text-xs text-slate-400">
                    El top aparecera cuando lleguen donaciones.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 min-h-0 flex-1 py-3">
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
          />
        </div>

        <div className="pointer-events-none absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-4">
          <div className="flex flex-col items-start gap-2 rounded-3xl bg-slate-700/30 px-3 py-3 text-white backdrop-blur-sm">
            {extraDonationEntries.map((entry) => (
              <article
                key={entry.id}
                className="flex w-full items-center justify-start gap-2 text-left text-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[9px] font-black uppercase tracking-[0.16em] text-sky-100">
                  {entry.icon === 'heart' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-rose-300" aria-hidden="true">
                      <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                    </svg>
                  ) : entry.icon === 'chat' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-sky-200" aria-hidden="true">
                      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.7 4.03A.75.75 0 0 1 4 18.46V15.5a2.5 2.5 0 0 1-2-2.45v-7Z" />
                    </svg>
                  ) : (
                    'Txt'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/80">{entry.title}</p>
                  <span className="text-sm font-black text-orange-200">{entry.value}</span>
                </div>
              </article>
            ))}

            {gifts.slice(0, 8).map((gift) => (
              <article
                key={gift.id}
                className="flex w-full items-center justify-start gap-2 text-left text-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center p-1">
                  {gift.imageUrl ? (
                    <img src={gift.imageUrl} alt={gift.giftName} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[9px] font-bold uppercase text-slate-300">Gift</span>
                  )}
                </div>
                <span className="text-sm font-black text-orange-200">
                  {gift.action === 'split' ? 'DIVIDE' : `+${formatValue(gift.hpReward)} HP`}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-[380px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/40 shadow-[0_24px_80px_rgba(2,6,23,0.6)] backdrop-blur sm:min-h-[520px] xl:min-h-[620px]">
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/45 px-5 py-4 backdrop-blur-md">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-orange-300/80">Arena en vivo</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Circular Saw Showdown
          </h1>
        </div>

        <div className="flex gap-3 text-right text-sm text-slate-200/80">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2">
            <span className="block text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">
              Activas
            </span>
            <strong className="text-lg text-white">{activeCount}</strong>
          </div>
          <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2">
            <span className="block text-[10px] uppercase tracking-[0.3em] text-sky-100/70">
              Canvas
            </span>
            <strong className="text-lg text-white">{canvasSize.width} x {canvasSize.height}</strong>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="block h-[calc(100%-74px)] min-h-[380px] w-full sm:min-h-[520px] xl:min-h-[620px]"
      />
    </section>
  )
}