'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Flame,
  Zap,
  MapPin,
  Calendar,
  ChevronRight,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { PoppleEvent } from '@/lib/events'
import {
  fetchWeeklyTopFestivals,
  fetchDailyLiveFestivals,
  recordEventClick,
} from '@/lib/ranking'
import { EventDetail } from './event-detail'

export function RankingScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = searchParams.get('type') === 'daily' ? 'daily' : 'weekly'

  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>(initialType)
  const [weeklyList, setWeeklyList] = useState<PoppleEvent[]>([])
  const [dailyList, setDailyList] = useState<PoppleEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<PoppleEvent | null>(null)

  // URL query parameter 변경 시 탭 동기화
  useEffect(() => {
    const type = searchParams.get('type')
    if (type === 'daily' || type === 'weekly') {
      setActiveTab(type)
    }
  }, [searchParams])

  // 실시간 축제 풀 및 랭킹 데이터 로드
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/festivals', { cache: 'no-store' })
        let candidatePool: PoppleEvent[] = []
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.festivals)) {
            candidatePool = data.festivals
          }
        }

        // 주간 TOP 5 (최근 7일간 조회수 누적) 및 오늘 실시간 인기 행사 (당일 조회수) 병렬 조회
        const [weeklyRanked, dailyRanked] = await Promise.all([
          fetchWeeklyTopFestivals(candidatePool, 10),
          fetchDailyLiveFestivals(candidatePool, 10),
        ])

        if (isMounted) {
          setWeeklyList(weeklyRanked)
          setDailyList(dailyRanked)
        }
      } catch (err) {
        console.warn('[RankingScreen] Failed to load ranking:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [])

  const currentList = activeTab === 'weekly' ? weeklyList : dailyList

  // 상세 페이지 열람 시
  if (selectedEvent) {
    return (
      <main className="min-h-dvh bg-slate-100 sm:px-4 sm:py-6 pb-24 sm:pb-28">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <EventDetail
            event={selectedEvent}
            onBack={() => setSelectedEvent(null)}
          />
        </div>
      </main>
    )
  }

  return (
    <div className="relative flex flex-col min-h-dvh bg-slate-50 text-slate-900 pb-20">
      {/* 1. 상단 네비게이션 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="size-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
              aria-label="홈으로 돌아가기"
            >
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">
              축제 랭킹
            </h1>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[11px] font-bold">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>실시간 순위</span>
          </div>
        </div>
      </header>

      {/* 2. 탭 스위처 (주간 TOP 5 vs 당일 실시간 인기) */}
      <div className="sticky top-[57px] z-30 bg-white border-b border-slate-100 px-4 pt-2 pb-3 shadow-2xs">
        <div className="mx-auto max-w-md">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100/90 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('weekly')
                router.replace('/ranking?type=weekly')
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-white text-[#1884F7] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Flame className="size-3.5" />
              <span>주간 핫한 축제 TOP 5</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('daily')
                router.replace('/ranking?type=daily')
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-white text-[#1884F7] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="size-3.5" />
              <span>오늘 실시간 인기</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. 랭킹 메인 컨텐츠 */}
      <main className="mx-auto w-full max-w-md px-4 pt-4 flex flex-col gap-4">
        {/* 안내 배너 카드 */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50/70 to-indigo-50/50 p-4 border border-sky-100/80 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#1884F7] flex items-center justify-center text-white shrink-0 mt-0.5">
              {activeTab === 'weekly' ? (
                <Trophy className="size-4" />
              ) : (
                <Zap className="size-4" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {activeTab === 'weekly'
                  ? '이번 주 가장 핫한 축제'
                  : '오늘 실시간 인기 축제'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                {activeTab === 'weekly'
                  ? '최근 7일간 전국 사용자의 누적 조회수 순위대로 집계된 랭킹입니다.'
                  : '오늘 날짜 기준으로 조회수가 가장 빠르게 상승 중인 축제입니다.'}
              </p>
            </div>
          </div>
        </div>

        {/* 랭킹 리스트 */}
        {isLoading ? (
          <div className="flex flex-col gap-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex gap-3.5 p-3.5 bg-white rounded-2xl border border-slate-100 animate-pulse"
              >
                <div className="size-20 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded-md" />
                  <div className="h-3 w-1/3 bg-slate-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold">집계된 랭킹 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {currentList.map((ev, idx) => {
              // 1위, 2위, 3위 뱃지 스타일
              const rank = idx + 1
              let rankBadgeStyle = 'bg-slate-100 text-slate-600'
              if (rank === 1) rankBadgeStyle = 'bg-amber-400 text-amber-950 shadow-xs'
              else if (rank === 2) rankBadgeStyle = 'bg-slate-200 text-slate-800'
              else if (rank === 3) rankBadgeStyle = 'bg-amber-700/80 text-white'

              return (
                <article
                  key={ev.id || idx}
                  onClick={() => {
                    recordEventClick(ev)
                    setSelectedEvent(ev)
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group relative flex gap-3.5 p-3 bg-white rounded-2xl border border-slate-100/90 shadow-2xs hover:shadow-xs hover:border-[#1884F7]/30 transition-all cursor-pointer active:scale-[0.99]"
                >
                  {/* 좌측 썸네일 & 순위 배지 */}
                  <div className="relative size-24 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                    <Image
                      src={ev.imageUrl || ev.poster || '/events/rock-festival.png'}
                      alt={ev.title}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* 순위 숫자 배지 */}
                    <div
                      className={`absolute top-0 left-0 size-6 flex items-center justify-center text-xs font-black rounded-br-lg ${rankBadgeStyle}`}
                    >
                      {rank}
                    </div>
                  </div>

                  {/* 우측 행사 상세 정보 (조회수 뱃지는 표시하지 않음) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold text-[#1884F7] bg-blue-50 px-1.5 py-0.5 rounded-md">
                          {ev.category || '축제/행사'}
                        </span>
                        {rank === 1 && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <Sparkles className="size-2.5" />
                            TOP 1
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-[#1884F7] transition-colors">
                        {ev.title}
                      </h3>
                    </div>

                    <div className="flex flex-col gap-0.5 mt-2">
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <Calendar className="size-3 shrink-0" />
                        <span className="line-clamp-1">{ev.date}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                        <MapPin className="size-3 shrink-0" />
                        <span className="line-clamp-1">{ev.location}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center self-center pr-1 text-slate-300 group-hover:text-slate-600 transition-colors">
                    <ChevronRight className="size-4" />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
