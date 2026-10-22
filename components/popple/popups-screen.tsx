'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MapPin,
  Star,
  ExternalLink,
  Flame,
  Calendar as CalendarIcon,
  Home,
  Users,
  User,
  Camera,
  Bell,
  RefreshCw,
} from 'lucide-react'
import type { PoppleEvent } from '@/lib/events'

interface PopupsScreenProps {
  onBack: () => void
  onSelectEvent: (event: PoppleEvent) => void
  onOpenHome: () => void
  onOpenEvents: () => void
  onOpenLens: () => void
  onOpenCommunity: () => void
  onOpenMy: () => void
}

const REGION_CHIPS = ['전체', '성수', '더현대', '홍대', '강남', '잠실']

export function PopupsScreen({
  onBack,
  onSelectEvent,
  onOpenHome,
  onOpenEvents,
  onOpenLens,
  onOpenCommunity,
  onOpenMy,
}: PopupsScreenProps) {
  const [popups, setPopups] = useState<PoppleEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('전체')
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({})
  const [showScrollTop, setShowScrollTop] = useState(false)

  // 1. 팝업스토어 데이터 로드 (/api/popups)
  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetch('/api/popups')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setPopups(data.popups || [])
        }
      })
      .catch((err) => {
        console.warn('Failed to load popups:', err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 2. 북마크 상태 로드
  useEffect(() => {
    const map: Record<string, boolean> = {}
    try {
      for (const ev of popups) {
        if (localStorage.getItem(`popple_bookmark_${ev.id}`) === 'true') {
          map[ev.id] = true
        }
      }
      setBookmarkedMap(map)
    } catch {
      // 무시
    }
  }, [popups])

  const toggleBookmark = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !bookmarkedMap[eventId]
    setBookmarkedMap((prev) => ({ ...prev, [eventId]: next }))
    try {
      localStorage.setItem(`popple_bookmark_${eventId}`, String(next))
    } catch {
      // 무시
    }
  }

  // 3. 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 4. 지역 필터링 (정확한 지역 매칭 및 태그/주소 연동)
  const filteredPopups = useMemo(() => {
    if (selectedRegion === '전체') return popups
    return popups.filter((p) => {
      if ((p as any).region === selectedRegion) return true
      const text = `${p.title} ${p.location} ${(p.tags || []).join(' ')}`.toLowerCase()
      if (selectedRegion === '더현대') {
        return text.includes('더현대') || text.includes('여의도')
      }
      return text.includes(selectedRegion.toLowerCase())
    })
  }, [popups, selectedRegion])

  return (
    <div className="relative flex flex-col min-h-dvh bg-[#F8FAFC] text-slate-900 pb-28">
      {/* 1. 상단 고정 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between gap-2.5">
          {/* 뒤로가기 버튼 + 로고 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로가기"
              className="size-9 -ml-1 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-90 transition-all"
            >
              <ChevronLeft className="size-6 stroke-[2.2]" />
            </button>
            <div
              onClick={onOpenHome}
              className="cursor-pointer flex items-center"
              title="홈으로 가기"
            >
              <Image
                src="/images/popple-logo.png"
                alt="Popple"
                width={100}
                height={36}
                priority
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>

          {/* 우측 액션 버튼: 카메라 렌즈 & 알림 */}
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="relative pt-1">
              <button
                type="button"
                onClick={onOpenLens}
                aria-label="AI 사진 맞춤 추천"
                title="AI 사진 맞춤 추천"
                className="group relative flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-sky-50 to-blue-100/70 text-[#1884F7] ring-1.5 ring-[#1884F7]/30 hover:ring-[#1884F7] active:scale-95 transition-all shadow-2xs"
              >
                <Camera className="size-5 stroke-[2.2]" />
              </button>
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#1884F7] to-indigo-600 px-1.5 py-0.2 text-[8px] font-black text-white shadow-xs tracking-tight">
                AI 렌즈 ✨
              </span>
            </div>

            <button
              type="button"
              aria-label="알림"
              className="relative p-2 rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Bell className="size-5.5 stroke-[2]" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="px-5 pt-5 flex flex-col">
        <div className="mx-auto w-full max-w-md">
          {/* 타이틀 헤더 */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-black tracking-wider text-[#1884F7] uppercase bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                <Flame className="size-3 fill-rose-500 text-rose-500" />
                POPUP STORE · 실시간 트렌드
              </span>
            </div>
            <h1 className="text-[23px] font-black text-slate-900 tracking-tight mt-1.5">
              지금 가장 핫한 팝업스토어 🔥
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              성수 · 더현대 · 홍대 · 강남 최신 팝업과 사전예약 정보
            </p>
          </div>

          {/* 3. 지역 필터 칩 리스트 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none -mx-1 px-1">
            {REGION_CHIPS.map((region) => {
              const isSelected = selectedRegion === region
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#1884F7] text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {region}
                </button>
              )
            })}
          </div>

          {/* 목록 개수 및 안내 헤더 */}
          <div className="flex items-baseline justify-between mt-3 mb-3.5">
            <span className="text-xs font-bold text-slate-500">
              {selectedRegion === '전체' ? '전체 지역' : `${selectedRegion} 지역`} 팝업
            </span>
            <span className="text-xs font-semibold text-slate-400">
              총 {filteredPopups.length}개의 팝업스토어
            </span>
          </div>

          {/* 4. 팝업스토어 카드 리스트 (기존 축제 카드 규격과 100% 동일한 UI) */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <div className="size-8 rounded-full border-3 border-sky-400 border-t-transparent animate-spin" />
              <p className="text-xs font-medium">실시간 팝업스토어 정보를 불러오는 중...</p>
            </div>
          ) : filteredPopups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-100 text-center gap-2.5 shadow-xs">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Flame className="size-6 stroke-[1.8]" />
              </div>
              <p className="text-base font-bold text-slate-800">
                해당 지역에 등록된 팝업스토어가 없어요
              </p>
              <p className="text-xs text-slate-500 break-keep">
                다른 지역 필터를 선택하거나 전체 목록을 둘러보세요!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {filteredPopups.map((ev) => {
                const isBookmarked = !!bookmarkedMap[ev.id]

                return (
                  <article
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className="group relative bg-white rounded-3xl p-3 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex gap-3.5 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                  >
                    {/* 좌측: 둥근 모서리의 세로형 포스터 썸네일 이미지 */}
                    <div className="relative w-[112px] min-w-[112px] h-[190px] rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                      <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-xs bg-[#1884F7]">
                        팝업
                      </span>

                      <Image
                        src={ev.imageUrl || ev.poster || '/events/media-art.png'}
                        alt={ev.title}
                        fill
                        sizes="112px"
                        unoptimized
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement
                          target.src = '/events/media-art.png'
                        }}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* 우측: 행사명, 기간, 입장료, 장소 텍스트 및 액션 버튼 */}
                    <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
                      <div>
                        {/* 상단: 행사명 볼드 타이틀 + 우측 상단 북마크(별) 버튼 */}
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="text-[16px] font-black text-slate-900 leading-snug line-clamp-2 pr-1">
                            {ev.title}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => toggleBookmark(ev.id, e)}
                            aria-label={isBookmarked ? '북마크 취소' : '북마크 추가'}
                            className="size-8 flex items-center justify-center -mr-1 -mt-1 text-slate-300 hover:text-amber-400 transition-colors shrink-0"
                          >
                            <Star
                              className={`size-5 transition-transform active:scale-125 ${
                                isBookmarked
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 stroke-[1.8]'
                              }`}
                            />
                          </button>
                        </div>

                        {/* 상세 정보: 기간, 입장료, 장소 */}
                        <div className="flex flex-col gap-1 mt-2 text-xs">
                          <div className="flex items-center">
                            <span className="w-11 text-slate-400 font-medium shrink-0">
                              기간
                            </span>
                            <span className="font-bold text-slate-700 truncate">
                              {ev.date}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-11 text-slate-400 font-medium shrink-0">
                              입장료
                            </span>
                            <span className="font-bold text-slate-700 truncate">
                              {(ev as any).fee || ev.price || '무료'}
                            </span>
                          </div>
                          <div className="flex items-center text-slate-500 font-medium mt-0.5">
                            <MapPin className="size-3 text-slate-400 shrink-0 mr-1" />
                            <span className="truncate">{ev.location}</span>
                          </div>

                          {/* 해시태그 뱃지 */}
                          {ev.tags && ev.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 pt-0.5">
                              {ev.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-[#1884F7]"
                                >
                                  {tag.startsWith('#') ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 하단: '상세 안내 >' 및 원문/예약 링크 버튼 */}
                      <div className="flex items-center gap-1.5 mt-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent(ev)
                          }}
                          className="bg-[#F0F7FF] hover:bg-[#E2F0FE] active:scale-[0.98] text-[#1884F7] rounded-xl px-3 py-2 flex-1 flex items-center justify-between text-xs font-black transition-colors"
                        >
                          <span>상세 안내</span>
                          <ChevronRight className="size-3.5 text-[#1884F7] stroke-[2.5]" />
                        </button>

                        {((ev as any).reservationUrl || ev.websiteUrl) && (
                          <a
                            href={(ev as any).reservationUrl || ev.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl px-2.5 py-2 flex items-center gap-1 text-xs font-bold transition-colors shrink-0"
                            title="네이버 예약 / 공식 안내 원문 새 창 열기"
                          >
                            <ExternalLink className="size-3.5" />
                            <span>예약/원문</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* 5. 플로팅 상단 이동 버튼 (^) */}
      <div
        className={`fixed bottom-[74px] left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          showScrollTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="화면 최상단으로 이동"
          className="size-11 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white shadow-lg flex items-center justify-center transition-transform active:scale-90"
        >
          <ChevronUp className="size-6 stroke-[2.5]" />
        </button>
      </div>

      {/* 6. 하단 네비게이션 바 */}
      <nav
        aria-label="하단 네비게이션"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2"
      >
        <div className="mx-auto max-w-md flex items-center justify-around">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Home className="size-5 stroke-[2]" />
            <span className="text-[10px] font-bold">홈</span>
          </button>

          <button
            type="button"
            onClick={onOpenEvents}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <CalendarIcon className="size-5 stroke-[2]" />
            <span className="text-[10px] font-bold">캘린더</span>
          </button>

          <button
            type="button"
            onClick={onOpenLens}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Camera className="size-5 stroke-[2]" />
            <span className="text-[10px] font-bold">렌즈</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommunity}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Users className="size-5 stroke-[2]" />
            <span className="text-[10px] font-bold">커뮤니티</span>
          </button>

          <button
            type="button"
            onClick={onOpenMy}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <User className="size-5 stroke-[2]" />
            <span className="text-[10px] font-bold">마이</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
