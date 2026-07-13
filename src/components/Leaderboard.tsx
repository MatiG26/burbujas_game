import type { LeaderboardEntry } from '../types/game'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
    maximumFractionDigits: value > 0 && value < 1 ? 2 : 2,
  }).format(value)
}

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <aside className="flex min-h-[620px] flex-col rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-sky-200/75">Leaderboard</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Ranking de donaciones
          </h2>
        </div>
        <div className="rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-right">
          <span className="block text-[10px] uppercase tracking-[0.3em] text-sky-100/70">Participantes</span>
          <strong className="text-lg text-white">{entries.length}</strong>
        </div>
      </div>

      <div className="mt-5 flex-1 space-y-3 overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <article
            key={entry.id}
            className="flex items-center gap-3 rounded-3xl border border-white/8 bg-white/6 px-4 py-3"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fdba74,#fb7185)] text-sm font-black text-slate-950">
              #{index + 1}
            </div>

            {entry.avatarUrl ? (
              <img
                src={entry.avatarUrl}
                alt={entry.username}
                className="h-12 w-12 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-700 text-base font-black text-white">
                {entry.username.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="truncate text-sm text-white">{entry.username}</strong>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${entry.isActive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-slate-400'}`}
                >
                  {entry.isActive ? 'En juego' : 'Eliminada'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Total: {formatNumber(entry.totalDonated)} HP</span>
                <span>Actual: {formatNumber(entry.currentHp)} HP</span>
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                {entry.sawCount} sierras activas
              </div>
            </div>
          </article>
        ))}

        {entries.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-slate-400">
            El ranking se llenara cuando empiecen las donaciones.
          </div>
        ) : null}
      </div>
    </aside>
  )
}