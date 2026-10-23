'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventTypeValue = 'all' | 'festival' | 'popup'

export type EventTypeOption = {
  label: string
  shortLabel: string
  value: EventTypeValue
}

export const EVENT_TYPE_OPTIONS: EventTypeOption[] = [
  { label: '전체', shortLabel: '전체', value: 'all' },
  { label: '지역축제', shortLabel: '지역축제', value: 'festival' },
  { label: '팝업스토어', shortLabel: '팝업스토어', value: 'popup' },
]

type EventTypeSelectProps = {
  value: EventTypeValue
  onChange: (val: EventTypeValue) => void
  disabled?: boolean
}

export function EventTypeSelect({ value, onChange, disabled = false }: EventTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption =
    EVENT_TYPE_OPTIONS.find((opt) => opt.value === value) || EVENT_TYPE_OPTIONS[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleSelect(val: EventTypeValue) {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-foreground shadow-xs outline-none transition-all whitespace-nowrap',
          'hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="text-xs">🏷️</span>
        <span className="text-muted-foreground font-normal">유형:</span>
        <span className="font-bold text-foreground">{selectedOption.shortLabel}</span>
        <ChevronDown
          className={cn(
            'size-3 sm:size-3.5 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1.5 z-50 w-36 overflow-hidden rounded-xl border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="py-0.5">
            {EVENT_TYPE_OPTIONS.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors outline-none cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="size-3 text-primary" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
