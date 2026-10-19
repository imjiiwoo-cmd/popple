'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, MapPin, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AreaOption = {
  label: string
  shortLabel: string
  code: string
}

export const AREA_OPTIONS: AreaOption[] = [
  { label: '전체 (전국)', shortLabel: '전체', code: '' },
  { label: '서울', shortLabel: '서울', code: '1' },
  { label: '인천', shortLabel: '인천', code: '2' },
  { label: '경기', shortLabel: '경기', code: '31' },
  { label: '강원', shortLabel: '강원', code: '32' },
  { label: '부산', shortLabel: '부산', code: '6' },
  { label: '대구', shortLabel: '대구', code: '4' },
  { label: '대전', shortLabel: '대전', code: '3' },
  { label: '광주', shortLabel: '광주', code: '5' },
  { label: '제주', shortLabel: '제주', code: '39' },
]

type AreaSelectProps = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
}

export function AreaSelect({ value, onChange, disabled = false }: AreaSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = AREA_OPTIONS.find((opt) => opt.code === value) || AREA_OPTIONS[0]

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

  function handleSelect(code: string) {
    onChange(code)
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
          'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs outline-none transition-all',
          'hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/30',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="text-xs">📍</span>
        <span className="text-muted-foreground font-normal">지역:</span>
        <span className="font-bold text-foreground">{selectedOption.shortLabel}</span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform duration-200',
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
          <div className="max-h-60 overflow-y-auto py-0.5">
            {AREA_OPTIONS.map((option) => {
              const isSelected = option.code === value
              return (
                <button
                  key={option.code || 'all'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.code)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors outline-none',
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
