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
    <nav aria-label="Secciones de administrar" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 sm:px-5">
      <div className="mx-auto max-w-[820px] rounded-[24px] border border-white/8 bg-[#17191c]/95 p-2 shadow-[0_-12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const isActive = activeItemId === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center transition ${isActive ? 'border-white/12 bg-[#24282d] text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)]' : 'border-transparent bg-[#111315] text-slate-400 hover:bg-[#1d2126]'}`}
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