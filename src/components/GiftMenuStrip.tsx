import { useEffect, useRef, useState } from 'react'
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
] as const

type ExtraInteractionId = (typeof extraInteractions)[number]['id']
type SimulationQuantityMode = 'multiple' | 'single'

interface GiftMenuStripProps {
  gifts: GiftConfig[]
  onGiftSelect?: (gift: GiftConfig, quantity: number) => void
  onExtraInteractionSelect?: (interactionId: ExtraInteractionId, quantity: number) => void
  quantityMode?: SimulationQuantityMode
  onQuantityModeChange?: (mode: SimulationQuantityMode) => void
  disabled?: boolean
}

export function GiftMenuStrip({ gifts, onGiftSelect, onExtraInteractionSelect, quantityMode = 'multiple', onQuantityModeChange, disabled = false }: GiftMenuStripProps) {
  const [submittedGiftId, setSubmittedGiftId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const submittedGiftTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (submittedGiftTimeoutRef.current !== null) {
        window.clearTimeout(submittedGiftTimeoutRef.current)
      }
    }
  }, [])

  function getQuantity(itemId: string) {
    return Math.max(1, quantities[itemId] ?? 1)
  }

  function setQuantity(itemId: string, nextValue: string) {
    const parsedValue = Number(nextValue)
    setQuantities((current) => ({
      ...current,
      [itemId]: Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : 1,
    }))
  }

  function markSubmitted(itemId: string) {
    setSubmittedGiftId(itemId)
    if (submittedGiftTimeoutRef.current !== null) {
      window.clearTimeout(submittedGiftTimeoutRef.current)
    }

    submittedGiftTimeoutRef.current = window.setTimeout(() => {
      setSubmittedGiftId((currentGiftId) => (currentGiftId === itemId ? null : currentGiftId))
      submittedGiftTimeoutRef.current = null
    }, 950)
  }

  function triggerGift(gift: GiftConfig) {
    if (disabled) {
      return
    }

    markSubmitted(gift.id)
    onGiftSelect?.(gift, getQuantity(gift.id))
  }

  function triggerExtraInteraction(interactionId: ExtraInteractionId) {
    if (disabled) {
      return
    }

    markSubmitted(interactionId)
    onExtraInteractionSelect?.(interactionId, getQuantity(interactionId))
  }

  function preventCardTrigger(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation()
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[#17191c] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.34em] text-slate-500">Premios activos</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-50 sm:text-2xl">Menu visible en stream</h2>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="w-fit rounded-full border border-white/8 bg-[#111315] px-3 py-2 text-xs text-slate-400">
            Formato movil listo
          </span>
          <div className="flex overflow-hidden rounded-2xl border border-white/8 bg-[#111315] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onQuantityModeChange?.('multiple')}
              className={`rounded-xl px-3 py-2 transition ${quantityMode === 'multiple' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-[#23272c]'}`}
            >
              Multiplicar burbujas
            </button>
            <button
              type="button"
              onClick={() => onQuantityModeChange?.('single')}
              className={`rounded-xl px-3 py-2 transition ${quantityMode === 'single' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:bg-[#23272c]'}`}
            >
              Una sola burbuja
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {extraInteractions.map((interaction) => (
          <article
            key={interaction.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => triggerExtraInteraction(interaction.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                triggerExtraInteraction(interaction.id)
              }
            }}
            className="overflow-hidden rounded-[24px] border border-white/8 bg-[#1d2126] p-4 text-left"
          >
            <div className="flex items-center gap-3 2xl:flex-col 2xl:items-center 2xl:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[#111315] p-2 text-center">
                {interaction.icon === 'heart' ? (
                  <svg viewBox="0 0 24 24" className="h-9 w-9 fill-rose-300" aria-hidden="true">
                    <path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
                  </svg>
                ) : interaction.icon === 'chat' ? (
                  <svg viewBox="0 0 24 24" className="h-9 w-9 fill-sky-200" aria-hidden="true">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H10l-4.7 4.03A.75.75 0 0 1 4 18.46V15.5a2.5 2.5 0 0 1-2-2.45v-7Z" />
                  </svg>
                ) : null}
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-slate-50">{interaction.title}</strong>
                <p className="mt-1 text-xs text-slate-400">{interaction.description}</p>
                <p className="mt-2 text-sm font-black text-slate-100">{interaction.value}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={getQuantity(interaction.id)}
                onChange={(event) => setQuantity(interaction.id, event.target.value)}
                onClick={preventCardTrigger}
                onKeyDown={preventCardTrigger}
                className="w-20 rounded-2xl border border-white/8 bg-[#111315] px-3 py-2 text-sm text-slate-50 outline-none focus:border-slate-500"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  triggerExtraInteraction(interaction.id)
                }}
                className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${submittedGiftId === interaction.id ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100' : 'border-white/8 bg-[#111315] text-slate-200 hover:bg-[#23272c]'}`}
              >
                Agregar
              </button>
            </div>
          </article>
        ))}

        {gifts.map((gift) => (
          <article
            key={gift.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={() => triggerGift(gift)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                triggerGift(gift)
              }
            }}
            className={`overflow-hidden rounded-[24px] border p-4 text-left transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 ${submittedGiftId === gift.id ? 'border-emerald-300/35 bg-emerald-500/12 shadow-[0_0_0_1px_rgba(110,231,183,0.12)]' : 'border-white/8 bg-[#1d2126] hover:border-white/14 hover:bg-[#23272c]'}`}
          >
            <div className="flex items-center gap-3 2xl:flex-col 2xl:items-center 2xl:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[#111315] p-2">
                {gift.imageUrl ? (
                  <img src={gift.imageUrl} alt={gift.giftName} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs font-bold uppercase text-slate-300">Gift</div>
                )}
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-slate-50">{gift.giftName}</strong>
                <p className="mt-1 text-xs text-slate-400">
                  {gift.action === 'split' ? 'Divide la sierra principal' : `Dona +${gift.hpReward} HP`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-100">
                    {gift.action === 'split' ? 'DIVIDE' : `+${gift.hpReward} HP`}
                  </p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] transition ${submittedGiftId === gift.id ? 'bg-emerald-400/20 text-emerald-200' : 'bg-transparent text-transparent'}`}>
                    Donado
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={getQuantity(gift.id)}
                onChange={(event) => setQuantity(gift.id, event.target.value)}
                onClick={preventCardTrigger}
                onKeyDown={preventCardTrigger}
                className="w-20 rounded-2xl border border-white/8 bg-[#111315] px-3 py-2 text-sm text-slate-50 outline-none focus:border-slate-500"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  triggerGift(gift)
                }}
                className={`flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${submittedGiftId === gift.id ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100' : 'border-white/8 bg-[#111315] text-slate-200 hover:bg-[#23272c]'}`}
              >
                Agregar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
