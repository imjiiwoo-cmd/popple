'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Calendar as CalendarIcon, Camera, X, Sparkles } from 'lucide-react'

export interface MiniPhotoCalendarProps {
  year?: number
  month?: number
  diaries?: Record<string, { imageUrl: string; memo?: string }>
  showSummaryChips?: boolean
  interactive?: boolean
}

export function MiniPhotoCalendar({
  year = 2026,
  month = 10,
  diaries = {},
  showSummaryChips = true,
  interactive = true,
}: MiniPhotoCalendarProps) {
  // 팝업 상세 모달 상태
  const [selectedEntry, setSelectedEntry] = useState<{
    dateKey: string
    day: number
    imageUrl: string
    memo?: string
  } | null>(null)

  // 1. 해당 월의 1일 요일 (0: 일요일 ~ 6: 토요일)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  // 2. 해당 월의 총 일수
  const totalDays = new Date(year, month, 0).getDate()

  const weekdays = ['일', '월', '화', '수', '목', '금', '토']

  // 해당 월에 등록된 다이어리 목록
  const recordedEntries = Object.entries(diaries)
    .filter(([key]) => key.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/60 to-white p-3.5 shadow-xs flex flex-col gap-2.5">
      {/* 캘린더 상단 헤더 */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="size-4 text-[#1884F7]" />
          <h4 className="text-xs font-black text-slate-800">
            {year}년 {month}월 축제 포토 캘린더
          </h4>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1884F7] bg-white px-2 py-0.5 rounded-full border border-sky-200/80 shadow-2xs">
          <Camera className="size-2.5 stroke-[2.5]" />
          <span>{recordedEntries.length}개 축제 기록</span>
        </span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w, idx) => (
          <div
            key={w}
            className={`text-[10px] font-bold py-0.5 ${
              idx === 0
                ? 'text-red-400'
                : idx === 6
                ? 'text-blue-500'
                : 'text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {/* 첫째 주 빈칸 */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* 1일 ~ 말일 */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const diary = diaries[dateKey]

          if (diary && diary.imageUrl) {
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => {
                  if (interactive) {
                    setSelectedEntry({
                      dateKey,
                      day,
                      imageUrl: diary.imageUrl,
                      memo: diary.memo,
                    })
                  }
                }}
                className="group relative aspect-square rounded-lg overflow-hidden border border-sky-300 ring-1 ring-sky-200/80 bg-slate-100 shadow-2xs hover:scale-105 active:scale-95 transition-all text-left"
                title={`${day}일: ${diary.memo || '축제 일상 기록'}`}
              >
                <Image
                  src={diary.imageUrl}
                  alt={`${day}일 기록`}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/65 backdrop-blur-2xs text-white text-[8px] font-black rounded leading-none shadow-xs">
                  {day}
                </span>
              </button>
            )
          }

          return (
            <div
              key={dateKey}
              className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-semibold text-slate-400 bg-white/70 border border-slate-100/80"
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* 하단 기록 요약 칩 (축제/일상 메모) */}
      {showSummaryChips && recordedEntries.length > 0 && (
        <div className="pt-2 border-t border-sky-100/70 flex flex-wrap gap-1.5">
          {recordedEntries.slice(0, 4).map(([dateKey, entry]) => (
            <div
              key={dateKey}
              className="inline-flex items-center gap-1 bg-white text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs max-w-full truncate"
            >
              <span className="text-[#1884F7] font-bold">{dateKey.slice(5)}</span>
              <span className="text-slate-600 truncate">{entry.memo || '축제 기록'}</span>
            </div>
          ))}
          {recordedEntries.length > 4 && (
            <span className="text-[10px] text-slate-400 self-center font-bold">
              +{recordedEntries.length - 4}개
            </span>
          )}
        </div>
      )}

      {/* 포토 썸네일 클릭 시 상세 팝업 모달 */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-amber-500" />
                <span className="text-xs font-bold text-slate-800">
                  {selectedEntry.dateKey} 일상 기록
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="relative aspect-[4/3] w-full bg-slate-100">
              <Image
                src={selectedEntry.imageUrl}
                alt="일상 기록 사진"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="p-4 bg-slate-50 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400">한 줄 일기</span>
              <p className="text-xs font-medium text-slate-800 break-words">
                {selectedEntry.memo || '기록된 일기가 없습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
