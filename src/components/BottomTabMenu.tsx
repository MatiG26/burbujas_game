import type { ReactNode } from 'react'

interface BottomTabMenuItem<T extends string> {
  id: T
  label: string
  icon: ReactNode
}

interface BottomTabMenuProps<T extends string> {
  items: BottomTabMenuItem<T>[]
  activeItemId: T
  onSelect: (itemId: T) => void
}

export function BottomTabMenu<T extends string>({ items, activeItemId, onSelect }: BottomTabMenuProps<T>) {
  return (
    <nav aria-label="Secciones de administrar" className="sticky bottom-0 z-40 px-3 pb-3 pt-2 sm:px-5">
      <div className="mx-auto max-w-[820px] rounded-[26px] border border-white/10 bg-slate-950/82 p-2 shadow-[0_-10px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const isActive = activeItemId === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition ${isActive ? 'border-cyan-200/35 bg-cyan-300/16 text-white shadow-[0_10px_35px_rgba(34,211,238,0.12)]' : 'border-white/10 bg-slate-950/35 text-slate-300 hover:bg-white/8'}`}
            >
              {item.icon}
              <strong className="mt-1 text-xs">{item.label}</strong>
            </button>
          )
        })}
        </div>
      </div>
    </nav>
  )
}