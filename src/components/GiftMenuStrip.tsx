import type { GiftConfig } from '../types/game'

const extraInteractions = [
  {
    id: 'comment-bubble',
    title: 'Chat',
    description: 'Crea una burbuja',
    value: 'BURBUJA',
    icon: 'chat',
  },
  {
    id: 'tap-tap-like',
    title: 'Tap Tap',
    description: 'Suma 0.25 HP',
    value: '+0.25 HP',
    icon: 'heart',
  },
]

interface GiftMenuStripProps {
  gifts: GiftConfig[]
  onGiftSelect?: (gift: GiftConfig) => void
  disabled?: boolean
}

export function GiftMenuStrip({ gifts, onGiftSelect, disabled = false }: GiftMenuStripProps) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(6,18,32,0.88))] p-4 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.34em] text-orange-300/75">Premios activos</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">Menu visible en stream</h2>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          Formato movil listo
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {extraInteractions.map((interaction) => (
          <article
            key={interaction.id}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.68))] p-4 text-left shadow-[0_14px_40px_rgba(2,6,23,0.22)]"
          >
            <div className="flex items-center gap-3 2xl:flex-col 2xl:items-center 2xl:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-white/10 p-2 shadow-inner shadow-white/10 text-center">
                {interaction.icon === 'heart' ? (
                  <svg viewBox="0 0 24 24" className="h-9 w-9 fill-rose-300" aria-hidden="true">
                    <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                  </svg>
                ) : interaction.icon === 'chat' ? (
                  <svg viewBox="0 0 24 24" className="h-9 w-9 fill-sky-200" aria-hidden="true">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.7 4.03A.75.75 0 0 1 4 18.46V15.5a2.5 2.5 0 0 1-2-2.45v-7Z" />
                  </svg>
                ) : (
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-100">
                    {interaction.title}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-white">{interaction.title}</strong>
                <p className="mt-1 text-xs text-slate-300/75">{interaction.description}</p>
                <p className="mt-2 text-sm font-black text-orange-300">{interaction.value}</p>
              </div>
            </div>
          </article>
        ))}

        {gifts.slice(0, 6).map((gift) => (
          <button
            key={gift.id}
            type="button"
            disabled={disabled}
            onClick={() => onGiftSelect?.(gift)}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(15,23,42,0.68))] p-4 text-left shadow-[0_14px_40px_rgba(2,6,23,0.22)] transition hover:border-orange-300/45 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(15,23,42,0.8))] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex items-center gap-3 2xl:flex-col 2xl:items-center 2xl:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-white/10 p-2 shadow-inner shadow-white/10">
                {gift.imageUrl ? (
                  <img src={gift.imageUrl} alt={gift.giftName} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs font-bold uppercase text-slate-300">Gift</div>
                )}
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-white">{gift.giftName}</strong>
                <p className="mt-1 text-xs text-slate-300/75">
                  {gift.action === 'split' ? 'Divide la sierra principal' : `Dona +${gift.hpReward} HP`}
                </p>
                <p className="mt-2 text-sm font-black text-orange-300">
                  {gift.action === 'split' ? 'DIVIDE' : `+${gift.hpReward} HP`}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
