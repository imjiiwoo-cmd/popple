'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { EventImage } from './event-image'
import {
  Search,
  Camera,
  Bell,
  ChevronRight,
  ChevronUp,
  MapPin,
  X,
  Sparkles,
  Calendar,
  Home,
  Users,
  User,
  ArrowRight,
  Heart,
  Flame,
  UtensilsCrossed,
  Music,
  Palette,
  Trees,
  PawPrint,
  Star,
  MessageCircle,
} from 'lucide-react'
import type { PoppleEvent } from '@/lib/events'
import { REAL_REVIEWS_SEED, type Review } from '@/lib/constants/reviews'
import {
  recordEventClick,
  computeWeeklyRanking,
  computeLiveNowRanking,
  fetchGlobalViewCounts,
  fetchWeeklyTopFestivals,
  fetchDailyLiveFestivals,
} from '@/lib/ranking'
import {
  type ThemeDefinition,
  filterEventsByTheme,
} from '@/lib/theme'

interface HomeScreenProps {
  initialSearch?: string
  onOpenLens: () => void
  onSelectEvent: (event: PoppleEvent) => void
  onOpenEvents?: () => void
  onOpenCommunity?: () => void
  onOpenMy?: () => void
  onOpenCoupons?: () => void
  onOpenPopups?: () => void
}

interface QuickCategoryItem {
  id: string
  name: string
  keyword: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  bgClass: string
  borderClass: string
}

const QUICK_CATEGORIES: QuickCategoryItem[] = [
  {
    id: 'date',
    name: '감성 데이트',
    keyword: '데이트',
    icon: Heart,
    iconClass: 'text-rose-500 fill-rose-500/20',
    bgClass: 'bg-rose-50 hover:bg-rose-100/80',
    borderClass: 'border-rose-100',
  },
  {
    id: 'family',
    name: '가족·아이와',
    keyword: '가족',
    icon: Users,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-50 hover:bg-amber-100/80',
    borderClass: 'border-amber-100',
  },
  {
    id: 'popup',
    name: '핫한 팝업',
    keyword: '팝업',
    icon: Flame,
    iconClass: 'text-purple-500 fill-purple-500/20',
    bgClass: 'bg-purple-50 hover:bg-purple-100/80',
    borderClass: 'border-purple-100',
  },
  {
    id: 'food',
    name: '푸드·야시장',
    keyword: '푸드',
    icon: UtensilsCrossed,
    iconClass: 'text-orange-500',
    bgClass: 'bg-orange-50 hover:bg-orange-100/80',
    borderClass: 'border-orange-100',
  },
  {
    id: 'music',
    name: '음악·공연',
    keyword: '음악',
    icon: Music,
    iconClass: 'text-blue-500',
    bgClass: 'bg-blue-50 hover:bg-blue-100/80',
    borderClass: 'border-blue-100',
  },
  {
    id: 'art',
    name: '전시·체험',
    keyword: '체험',
    icon: Palette,
    iconClass: 'text-indigo-500',
    bgClass: 'bg-indigo-50 hover:bg-indigo-100/80',
    borderClass: 'border-indigo-100',
  },
  {
    id: 'nature',
    name: '자연·힐링',
    keyword: '자연',
    icon: Trees,
    iconClass: 'text-emerald-500',
    bgClass: 'bg-emerald-50 hover:bg-emerald-100/80',
    borderClass: 'border-emerald-100',
  },
  {
    id: 'pet',
    name: '반려견 동반',
    keyword: '반려견',
    icon: PawPrint,
    iconClass: 'text-teal-500',
    bgClass: 'bg-teal-50 hover:bg-teal-100/80',
    borderClass: 'border-teal-100',
  },
]

export function HomeScreen({
  initialSearch,
  onOpenLens,
  onSelectEvent,
  onOpenEvents,
  onOpenCommunity,
  onOpenMy,
  onOpenCoupons,
  onOpenPopups,
}: HomeScreenProps) {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PoppleEvent[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchThemeSummary, setSearchThemeSummary] = useState<string | null>(null)
  const [searchThemeName, setSearchThemeName] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'home' | 'events' | 'community' | 'my'>('home')
  const [showScrollTop, setShowScrollTop] = useState(false)

  const [activeTheme, setActiveTheme] = useState<ThemeDefinition | null>(null)
  const [themeEvents, setThemeEvents] = useState<PoppleEvent[]>([])

  // 실시간 방문 후기 포토 피드 상태 (0.05초 정적 Seed 즉각 렌더링 + 반응형 좋아요)
  const [reviewsList] = useState<Review[]>(() => REAL_REVIEWS_SEED)
  const [likedReviews, setLikedReviews] = useState<Record<string, boolean>>({})
  const [reviewLikes, setReviewLikes] = useState<Record<string, number>>({})

  const handleToggleReviewLike = (reviewId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isLiked = !likedReviews[reviewId]
    setLikedReviews((prev) => ({ ...prev, [reviewId]: isLiked }))
    setReviewLikes((prev) => {
      const current = prev[reviewId] ?? (reviewsList.find((r) => r.id === reviewId)?.likes || 0)
      return {
        ...prev,
        [reviewId]: isLiked ? current + 1 : current - 1,
      }
    })
  }

  // 축제 풀 및 랭킹 상태 (Supabase festivals 테이블 view_count 실시간 연동)
  const [allFestivals, setAllFestivals] = useState<PoppleEvent[]>([])
  const [globalCounts, setGlobalCounts] = useState<Record<string, number>>({})
  const [weeklyTopEvents, setWeeklyTopEvents] = useState<PoppleEvent[]>([])
  const [liveTrendingEvents, setLiveTrendingEvents] = useState<PoppleEvent[]>([])

  // 메인 슬라이더 롤링 & 호버 일시정지 상태
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // 1. 실시간 축제 풀(/api/festivals) 로드 및 Supabase 실시간 랭킹 (주간 TOP 5 vs 당일 실시간 인기 분리)
  useEffect(() => {
    let isMounted = true
    async function loadFestivals() {
      try {
        const [res, viewCounts] = await Promise.all([
          fetch('/api/festivals', { cache: 'no-store' }),
          fetchGlobalViewCounts(),
        ])
        if (isMounted && viewCounts) {
          setGlobalCounts(viewCounts)
        }

        let festivalsList: PoppleEvent[] = []
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.festivals) && data.festivals.length > 0) {
            festivalsList = data.festivals
            if (isMounted) {
              setAllFestivals(data.festivals)
            }
          }
        }

        // 주간 TOP 5 (최근 7일간 조회수 누적) 및 오늘 실시간 인기 (당일 조회수) 병렬 조회
        const [topFestivals, liveDailyFestivals] = await Promise.all([
          fetchWeeklyTopFestivals(festivalsList, 5),
          fetchDailyLiveFestivals(festivalsList, 5),
        ])

        if (isMounted) {
          setWeeklyTopEvents(topFestivals)
          setLiveTrendingEvents(liveDailyFestivals)
        }
      } catch (err) {
        console.warn('[HomeScreen] festivals fetch error:', err)
        if (isMounted) {
          const fallbackTop = await fetchWeeklyTopFestivals([], 5)
          const fallbackDaily = await fetchDailyLiveFestivals([], 5)
          setWeeklyTopEvents(fallbackTop)
          setLiveTrendingEvents(fallbackDaily)
        }
      }
    }

    loadFestivals()
    return () => {
      isMounted = false
    }
  }, [])

  // 2. 다른 탭이나 상세에서 클릭 후 복귀 시 최신 Supabase 랭킹 즉시 동기화
  useEffect(() => {
    const syncRanking = async () => {
      try {
        const [counts, topFestivals, liveDailyFestivals] = await Promise.all([
          fetchGlobalViewCounts(),
          fetchWeeklyTopFestivals(allFestivals, 5),
          fetchDailyLiveFestivals(allFestivals, 5),
        ])
        setGlobalCounts(counts)
        setWeeklyTopEvents(topFestivals)
        setLiveTrendingEvents(liveDailyFestivals)
      } catch (err) {
        console.warn('[HomeScreen] syncRanking error:', err)
      }
    }
    window.addEventListener('storage', syncRanking)
    window.addEventListener('focus', syncRanking)
    window.addEventListener('popple-event-clicked', syncRanking)
    return () => {
      window.removeEventListener('storage', syncRanking)
      window.removeEventListener('focus', syncRanking)
      window.removeEventListener('popple-event-clicked', syncRanking)
    }
  }, [allFestivals])

  // 3. [캐러셀 자동 롤링 및 호버 일시정지 (Autoplay with Pause on Hover)]
  // 3.5초 간격으로 자동으로 다음 장(오른쪽)으로 넘어가고 마지막 슬라이드에 도달하면 첫 슬라이드로 Loop
  useEffect(() => {
    if (isPaused || weeklyTopEvents.length <= 1) return

    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % weeklyTopEvents.length)
    }, 3500)

    return () => clearInterval(timer)
  }, [isPaused, weeklyTopEvents.length])

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 180)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 테마 카드 클릭 시 전용 리스트 뷰로 전환 (룰 기반 고속 필터링)
  const handleSelectTheme = (theme: ThemeDefinition) => {
    const matched = filterEventsByTheme(allFestivals, theme)
    setActiveTheme(theme)
    setThemeEvents(matched)
    setIsSearchActive(false)
    setSearchQuery('')
    setKeyword('')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  const handleClearTheme = () => {
    setActiveTheme(null)
    setThemeEvents([])
  }



  // 행사 키워드 검색 핸들러 (한국관광공사 TourAPI 및 로컬 필터링)
  const handleSearch = async (queryToSearch: string) => {
    const trimmed = queryToSearch.trim()
    if (!trimmed) return

    setActiveTheme(null)
    setThemeEvents([])
    setIsSearching(true)
    setIsSearchActive(true)
    setSearchQuery(trimmed)

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(trimmed)}`)
      if (res.ok) {
        const data = await res.json()
        const todayStr = new Intl.DateTimeFormat('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
          .format(new Date())
          .replace(/\D/g, '')

        const activeOnly = (data.events || []).filter((ev: PoppleEvent) => {
          if (ev.endDate && ev.endDate < todayStr) return false
          return true
        })
        setSearchResults(activeOnly)
        setSearchThemeSummary(data.themeSummary || null)
        setSearchThemeName(data.themeName || null)
      } else {
        setSearchResults([])
        setSearchThemeSummary(null)
        setSearchThemeName(null)
      }
    } catch {
      setSearchResults([])
      setSearchThemeSummary(null)
      setSearchThemeName(null)
    } finally {
      setIsSearching(false)
    }
  }

  // initialSearch 변경 또는 URL 라우팅 진입 시 자동 검색 실행
  useEffect(() => {
    if (initialSearch && initialSearch.trim()) {
      handleSearch(initialSearch.trim())
    }
  }, [initialSearch])

  // 퀵 카테고리 아이콘 클릭 핸들러 (의미 기반 검색 실행 + URL 갱신 또는 전용 화면 이동)
  const handleQuickCategoryClick = (catKeyword: string) => {
    if (catKeyword === '팝업') {
      if (onOpenPopups) {
        onOpenPopups()
      } else {
        router.push('/popups')
      }
      return
    }
    handleSearch(catKeyword)
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/search?keyword=${encodeURIComponent(catKeyword)}`)
    }
  }

  const handleClearSearch = () => {
    setKeyword('')
    setSearchQuery('')
    setIsSearchActive(false)
    setSearchResults([])
    setSearchThemeSummary(null)
    setSearchThemeName(null)
    setActiveTheme(null)
    setThemeEvents([])
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/search')) {
      router.push('/')
    }
  }

  return (
    <div className="relative flex flex-col min-h-dvh bg-slate-50 text-slate-900 pb-20">
      {/* 1. 상단 헤더 UI 구성: 로고, 검색창, 카메라 렌즈 버튼, 알림 아이콘 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between gap-2.5">
          {/* 좌측 Popple 로고 */}
          <div
            onClick={handleClearSearch}
            className="shrink-0 cursor-pointer flex items-center"
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

          {/* 중앙 검색창: 돋보기 아이콘 및 사진 검색 지원 플레이스홀더 */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch(keyword)
            }}
            className="relative flex-1 min-w-0 flex items-center bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1884F7]/25 rounded-full px-3 py-1.5 sm:px-3.5 sm:py-2 border border-slate-200/60 transition-all"
          >
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="검색어 또는 사진으로 축제를 찾아보세요"
              className="w-full bg-transparent text-[11px] sm:text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none pr-6 font-medium truncate"
            />
            {keyword ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="검색어 지우기"
                className="absolute right-7 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="행사 검색"
              className="absolute right-2.5 text-[#1884F7] hover:text-[#0F75E8] active:scale-95 transition-transform"
            >
              <Search className="size-4 stroke-[2.2]" />
            </button>
          </form>

          {/* 우측 액션 버튼: [📷 카메라 렌즈 버튼 + AI 렌즈 뱃지] & [🔔 알림 아이콘] */}
          <div className="shrink-0 flex items-center gap-1 sm:gap-1.5">
            {/* 카메라 버튼 (Popple Lens 화면 전환) + AI 렌즈 미니 태그 뱃지 */}
            <div className="relative pt-1">
              <button
                type="button"
                onClick={onOpenLens}
                aria-label="사진 기반 맞춤 행사 추천 (Popple Lens)"
                title="Popple Lens - 사진 기반 맞춤 행사 추천"
                className="group relative flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-sky-50 to-blue-100/70 text-[#1884F7] ring-1.5 ring-[#1884F7]/30 hover:ring-[#1884F7] hover:bg-sky-100 active:scale-95 transition-all shadow-2xs"
              >
                <Camera className="size-5 stroke-[2.2] transition-transform duration-200 group-hover:scale-110" />
                <span className="absolute -top-0.5 -right-0.5 flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1884F7] opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-[#1884F7]" />
                </span>
              </button>

              {/* 상단 미니 태그 뱃지 ("AI 렌즈 ✨") */}
              <span
                onClick={onOpenLens}
                className="cursor-pointer absolute -top-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#1884F7] to-indigo-600 px-1.5 py-0.2 text-[8px] font-black text-white shadow-xs tracking-tight transition-transform hover:scale-105 active:scale-95 select-none animate-pulse"
              >
                AI 렌즈 ✨
              </span>
            </div>

            {/* 알림 아이콘 */}
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
      <main className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-6">
        {/* 테마 큐레이션 전용 리스트 화면 (PICK YOUR MOOD 클릭 시 전환) */}
        {activeTheme ? (
          <section className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#1884F7] tracking-wider uppercase">
                  THEME CURATION
                </span>
                <h2 className="text-lg font-black text-slate-900 line-clamp-1">
                  {activeTheme.title} 테마 축제{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    ({themeEvents.length}건)
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClearTheme}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-lg shrink-0"
              >
                <X className="size-3.5" />
                전체보기
              </button>
            </div>

            {/* 테마 배너 카드 */}
            <div className="relative aspect-[21/9] w-full rounded-2xl overflow-hidden shadow-xs">
              <Image
                src={activeTheme.imageUrl}
                alt={activeTheme.title}
                fill
                unoptimized
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="inline-block bg-[#1884F7] text-white text-[9px] font-black px-2 py-0.5 rounded-full mb-1 uppercase">
                  {activeTheme.type === 'season' ? '계절 맞춤 테마' : '추천 테마'}
                </span>
                <h3 className="text-base font-black leading-snug">{activeTheme.title}</h3>
                <p className="text-[11px] text-slate-200 mt-0.5 font-medium line-clamp-1">
                  {activeTheme.tags.join(' ')} • 주요 키워드: {activeTheme.keywords.slice(0, 4).join(', ')}
                </p>
              </div>
            </div>

            {/* 테마 매칭 축제 목록 */}
            {themeEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 text-center gap-3 shadow-xs">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Sparkles className="size-6 stroke-[1.8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-slate-800">해당 테마의 행사가 준비 중입니다</p>
                  <p className="text-xs text-slate-500 break-keep">
                    다른 테마를 선택하시거나 전체 축제 목록을 둘러보세요.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {themeEvents.map((ev) => (
                  <article
                    key={ev.id}
                    onClick={() => {
                      recordEventClick(ev)
                      onSelectEvent(ev)
                    }}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all hover:border-[#1884F7]/40 hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="relative aspect-[3/4] w-18 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <EventImage
                        src={ev.imageUrl || ev.poster}
                        alt={ev.title}
                        fill
                        className="object-cover"
                      />
                      {ev.category && (
                        <span className="absolute top-1.5 left-1.5 z-10 rounded bg-[#1884F7] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          {ev.category}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 break-keep">
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1 leading-snug">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{ev.date}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 line-clamp-1">
                        <MapPin className="size-3 shrink-0" />
                        <span>{ev.location}</span>
                      </p>
                      {ev.tags && ev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {ev.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-[#1884F7]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : isSearchActive ? (
          <section className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#1884F7] tracking-wider uppercase">
                  {searchThemeName ? `${searchThemeName} 테마 추천` : 'SEARCH RESULT'}
                </span>
                <h2 className="text-lg font-black text-slate-900">
                  &lsquo;{searchQuery}&rsquo; 추천 행사{' '}
                  <span className="text-sm font-semibold text-slate-500">
                    ({searchResults.length}건)
                  </span>
                </h2>
                {searchThemeSummary && (
                  <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-[#1884F7] text-[10px] font-bold border border-sky-100">
                      💡 맞춤 테마
                    </span>
                    <span>{searchThemeSummary}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-lg shrink-0"
              >
                <X className="size-3.5" />
                전체보기
              </button>
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="size-8 rounded-full border-3 border-sky-400 border-t-transparent animate-spin" />
                <p className="text-xs font-medium">실시간 축제 정보를 찾는 중...</p>
              </div>
            ) : searchResults.length === 0 ? (
              /* 검색 결과가 없을 때의 안내 문구 (요건 3) */
              <div className="flex flex-col items-center justify-center py-14 px-4 bg-white rounded-3xl border border-slate-200/80 text-center gap-3 shadow-xs">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="size-6 stroke-[1.8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-base font-bold text-slate-800">검색 결과가 없습니다</p>
                  <p className="text-xs text-slate-500 break-keep">
                    축제명이나 지역명(예: 재즈, 전시, 서울, 부산 등)으로 다시 검색해보세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenLens}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1884F7] to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow-md transition-all active:scale-95"
                >
                  <Camera className="size-4" />
                  <span>내 사진으로 맞춤 행사 찾아보기</span>
                </button>
              </div>
            ) : (
              /* 검색 결과 목록 */
              <div className="flex flex-col gap-3">
                {searchResults.map((ev) => (
                  <article
                    key={ev.id}
                    onClick={() => {
                      recordEventClick(ev)
                      onSelectEvent(ev)
                    }}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition-all hover:border-[#1884F7]/40 hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="relative aspect-[3/4] w-18 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <EventImage
                        src={ev.imageUrl || ev.poster}
                        alt={ev.title}
                        fill
                        className="object-cover"
                      />
                      {ev.category && (
                        <span className="absolute top-1.5 left-1.5 z-10 rounded bg-[#1884F7] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          {ev.category}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 break-keep">
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1 leading-snug">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{ev.date}</p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 line-clamp-1">
                        <MapPin className="size-3 shrink-0" />
                        <span>{ev.location}</span>
                      </p>
                      {ev.tags && ev.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {ev.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-[#1884F7]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* 기존 홈 화면 시안 섹션들 유지 */
          <>
            {/* 0. [Popple Lens AI 사진 맞춤 행사 추천 유도 히어로 미니 배너] */}
            <section
              onClick={onOpenLens}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenLens()
                }
              }}
              aria-label="Popple Lens - 사진 한 장으로 찾는 취향 맞춤 행사"
              className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-[#1884F7] to-indigo-600 p-3.5 sm:p-4 text-white shadow-md shadow-sky-500/15 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/25 hover:scale-[1.01] active:scale-[0.99] border border-white/20"
            >
              {/* 배경 장식 광채 및 그리드/블러 이펙트 */}
              <div className="pointer-events-none absolute -right-6 -bottom-8 size-28 rounded-full bg-white/15 blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:bg-white/25" />
              <div className="pointer-events-none absolute -left-4 -top-6 size-20 rounded-full bg-sky-300/20 blur-xl" />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-2 py-0.5 text-[9.5px] font-black tracking-wider uppercase text-white shadow-2xs">
                      <Sparkles className="size-2.5 fill-amber-300 text-amber-300 animate-pulse" />
                      POPPLE LENS
                    </span>
                    <span className="text-[10px] text-sky-100 font-semibold hidden xs:inline">
                      AI 비전 추천
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black leading-snug tracking-tight text-white flex items-center gap-1.5">
                    <span>📸 사진 한 장으로 찾는 취향 맞춤 행사</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-sky-100 font-medium line-clamp-1 leading-normal">
                    어디 갈지 고민될 때 내 기분·풍경 사진을 올려보세요
                  </p>
                </div>

                {/* 우측 버튼: [AI 추천받기 >] */}
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-white/95 hover:bg-white text-[#1884F7] group-hover:text-[#0F75E8] px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-black shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:translate-x-0.5">
                    <span>AI 추천받기</span>
                    <ChevronRight className="size-3.5 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </section>

            {/* 1번: WEEKLY RANKING 이번 주 가장 핫한 축제 */}
            <section aria-labelledby="section-weekly" className="flex flex-col gap-2.5">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
                    WEEKLY RANKING
                  </span>
                  <h2 id="section-weekly" className="text-xl font-black text-slate-900">
                    이번 주 가장 <span className="text-[#1884F7]">핫한</span> 축제
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/ranking?type=weekly')}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer"
                  title="이번 주 가장 핫한 축제 TOP 5 전체보기"
                >
                  TOP 5 <ChevronRight className="size-3.5" />
                </button>
              </div>

              {/* 1. [캐러셀 자동 롤링 및 호버 일시정지 (Autoplay with Pause on Hover)] */}
              {/* 3.5초 간격으로 자동 롤링, 호버 및 모바일 터치 시 일시정지, 마지막 도달 시 순환(Loop) */}
              {weeklyTopEvents.length === 0 ? (
                <div className="relative aspect-[16/11] w-full rounded-3xl overflow-hidden bg-slate-900/90 animate-pulse flex items-center justify-center border border-slate-800">
                  <div className="flex flex-col items-center gap-2">
                    <span className="size-6 border-2 border-[#1884F7] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-slate-300">실시간 주간 랭킹 로딩 중...</p>
                  </div>
                </div>
              ) : (
                <div
                  className="relative aspect-[16/11] w-full rounded-3xl overflow-hidden shadow-md select-none bg-slate-900"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                >
                  <div
                    className="flex h-full w-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}
                  >
                    {weeklyTopEvents.map((ev, idx) => (
                      <div
                        key={ev.id || idx}
                        onClick={() => {
                          recordEventClick(ev)
                          onSelectEvent(ev)
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative h-full w-full shrink-0 cursor-pointer overflow-hidden transition-transform active:scale-[0.99]"
                      >
                        <EventImage
                          src={ev.imageUrl || ev.poster}
                          alt={ev.title}
                          fill
                          priority={idx === 0}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* 그라디언트 오버레이 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                        {/* 좌측 상단 HOT 배지 */}
                        <div className="absolute top-0 left-0">
                          <span className="inline-block bg-[#1884F7] text-white text-[11px] font-black tracking-widest px-3.5 py-1 rounded-br-2xl uppercase shadow-md">
                            HOT
                          </span>
                        </div>

                        {/* 카드 하단 텍스트 정보 */}
                        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                          <div className="flex items-end gap-3 min-w-0">
                            <span className="text-5xl font-black text-white/95 leading-none tracking-tighter shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0 pb-0.5">
                              <p className="text-xs font-medium text-slate-200 line-clamp-1 mb-1">
                                {ev.location}
                              </p>
                              <h3 className="text-xl font-black text-white leading-tight line-clamp-1">
                                {ev.title}
                              </h3>
                              <div className="mt-2 inline-flex items-center rounded-md bg-slate-900/75 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white border border-white/20">
                                {ev.date}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 캐러셀 인디케이터 점 5개 (클릭 시 해당 슬라이드로 이동) */}
              {weeklyTopEvents.length > 0 && (
                <div className="flex justify-center items-center gap-1.5 pt-1">
                  {weeklyTopEvents.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlideIndex(idx)}
                      aria-label={`${idx + 1}번째 축제로 이동`}
                      className={`transition-all duration-300 rounded-full ${currentSlideIndex === idx
                          ? 'h-1.5 w-6 bg-slate-800'
                          : 'size-1.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 원형 퀵 카테고리 그리드 (쿠팡/배민 스타일 원형 4x2 그리드) */}
            <section aria-label="빠른 테마별 카테고리" className="rounded-2xl bg-white p-3.5 sm:p-4 border border-slate-200/70 shadow-2xs">
              <div className="grid grid-cols-4 gap-y-3.5 gap-x-2">
                {QUICK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleQuickCategoryClick(cat.keyword)}
                    className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                  >
                    <div
                      className={`relative flex size-12 sm:size-13 items-center justify-center rounded-full border transition-all duration-200 group-hover:scale-105 active:scale-90 active:opacity-80 shadow-2xs ${cat.bgClass} ${cat.borderClass}`}
                    >
                      <cat.icon className={`size-5.5 sm:size-6 stroke-[2.2] transition-transform duration-200 ${cat.iconClass}`} />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700 group-hover:text-slate-900 tracking-tight text-center leading-tight">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2번: 블루 혜택 배너 (POPPLE ONLY) */}
            <section
              onClick={() => {
                if (onOpenCoupons) {
                  onOpenCoupons()
                } else if (onOpenMy) {
                  onOpenMy()
                }
              }}
              role="button"
              tabIndex={0}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0088FF] to-[#00A2FF] p-4 text-white shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full border-2 border-white/80 flex items-center justify-center font-black text-xl text-white">
                  %
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold tracking-widest text-sky-200 uppercase">
                    POPPLE ONLY
                  </span>
                  <p className="text-base font-black leading-snug">
                    지역축제 갈 때 혜택도 챙겨요
                  </p>
                  <p className="text-xs text-sky-100 font-medium">
                    웰컴 쿠폰팩 준비중
                  </p>
                </div>
              </div>
              <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                <ChevronRight className="size-5" />
              </div>
            </section>

            {/* 3번: LIVE NOW 실시간 인기 상승 행사 (당일 자정 이후 조회수 랭킹) */}
            <section aria-labelledby="section-live" className="flex flex-col gap-2.5">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
                    LIVE NOW
                  </span>
                  <h2 id="section-live" className="text-xl font-black text-slate-900">
                    실시간 인기 상승 행사
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/ranking?type=daily')}
                  className="size-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="오늘 실시간 인기 행사 전체보기"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* 가로 스크롤 카드 리스트 (당일 자정 이후 클릭 순 5개 랭킹) */}
              <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                {liveTrendingEvents.map((ev, idx) => (
                  <article
                    key={ev.id || idx}
                    onClick={() => {
                      recordEventClick(ev)
                      onSelectEvent(ev)
                    }}
                    role="button"
                    tabIndex={0}
                    className="shrink-0 w-64 rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="relative aspect-[4/3] w-full bg-slate-100">
                      <EventImage
                        src={ev.imageUrl || ev.poster}
                        alt={ev.title}
                        fill
                        className="object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-[#1884F7] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                        급상승 {idx + 1}
                      </span>
                      {idx === 0 && (
                        <span className="absolute bottom-2.5 right-2.5 z-10 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-slate-800 shadow-xs flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          실시간 1위
                        </span>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                        <MapPin className="size-3 shrink-0" />
                        <span className="line-clamp-1">{ev.location}</span>
                      </p>
                      <h3 className="text-base font-bold text-slate-900 line-clamp-1 mt-0.5">
                        {ev.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 font-medium line-clamp-1">
                        {ev.date}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* 스크롤 유도 바 */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                <span className="h-0.5 w-6 rounded-full bg-[#1884F7]" />
                <span>옆으로 밀어 더 보기</span>
              </div>
            </section>

            {/* 4번: REAL REVIEWS 팝플러의 생생 방문기 (실시간 방문 후기 포토 피드) */}
            <section aria-labelledby="section-reviews" className="flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
                    REAL REVIEWS
                  </span>
                  <h2 id="section-reviews" className="text-xl font-black text-slate-900 tracking-tight">
                    팝플러의 생생 방문기
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenCommunity) {
                      onOpenCommunity()
                    } else {
                      router.push('/community')
                    }
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-[#1884F7] flex items-center gap-0.5 transition-colors group"
                  title="커뮤니티 후기 더보기"
                >
                  <span>더보기</span>
                  <ChevronRight className="size-3.5 text-slate-400 group-hover:text-[#1884F7] group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>

              {/* 2열 실시간 포토 피드 그리드 */}
              <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
                {reviewsList.map((review) => {
                  const isLiked = !!likedReviews[review.id]
                  const likesCount = reviewLikes[review.id] ?? review.likes

                  return (
                    <article
                      key={review.id}
                      onClick={() => {
                        const targetEvent = allFestivals.find(
                          (e) => e.id === review.eventId || e.title.includes(review.eventTitle.slice(0, 4)),
                        )
                        if (targetEvent) {
                          onSelectEvent(targetEvent)
                        } else if (onOpenCommunity) {
                          onOpenCommunity()
                        } else {
                          router.push('/community')
                        }
                      }}
                      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col hover:shadow-md transition-all active:scale-[0.99] group cursor-pointer select-none"
                    >
                      {/* 상단: 현장 포토 이미지 + 행사 태그 뱃지 + 별점 뱃지 */}
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 shrink-0">
                        <Image
                          src={review.imageUrl}
                          alt={review.eventTitle}
                          fill
                          sizes="(max-width: 640px) 50vw, 220px"
                          referrerPolicy="no-referrer"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* 좌측 상단 행사 태그 뱃지 */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-xs">
                            {review.tag}
                          </span>
                        </div>

                        {/* 우측 상단 별점 뱃지 */}
                        <div className="absolute top-2 right-2 z-10">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white/95 backdrop-blur-md text-amber-500 shadow-2xs">
                            <Star className="size-2.5 fill-amber-400 text-amber-400" />
                            <span>{review.rating.toFixed(1)}</span>
                          </span>
                        </div>

                        {/* 이미지 하단 행사명 오버레이 */}
                        <div className="absolute bottom-1.5 left-2.5 right-2.5 z-10">
                          <p className="text-[10px] font-bold text-white/95 truncate drop-shadow-xs">
                            {review.eventTitle}
                          </p>
                        </div>
                      </div>

                      {/* 하단: 핵심 리뷰 내용, 작성자 프로필, 좋아요 & 댓글 수 */}
                      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-2">
                        {/* 핵심 한 줄 리뷰 */}
                        <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-[#1884F7] transition-colors">
                          &ldquo;{review.content}&rdquo;
                        </p>

                        {/* 작성자 정보 및 소셜 지표 */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100/90 mt-auto text-[10px]">
                          {/* 작성자 아바타 + 닉네임 + 상대 시간 */}
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <div className="relative size-4.5 rounded-full overflow-hidden bg-slate-200 shrink-0 ring-1 ring-slate-100">
                              <Image
                                src={review.avatar}
                                alt={review.author}
                                fill
                                sizes="18px"
                                referrerPolicy="no-referrer"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-bold text-slate-700 truncate max-w-[60px] sm:max-w-[70px]">
                                {review.author}
                              </span>
                              <span className="text-slate-400 text-[9px] shrink-0">
                                · {review.createdAt}
                              </span>
                            </div>
                          </div>

                          {/* 좋아요 & 댓글 수 */}
                          <div className="flex items-center gap-2 shrink-0 text-slate-400">
                            <button
                              type="button"
                              onClick={(e) => handleToggleReviewLike(review.id, e)}
                              className="flex items-center gap-0.5 hover:text-rose-500 transition-colors"
                              title="좋아요"
                            >
                              <Heart
                                className={`size-3 transition-transform active:scale-125 ${
                                  isLiked
                                    ? 'fill-rose-500 text-rose-500'
                                    : 'stroke-[1.8] text-slate-400'
                                }`}
                              />
                              <span className={`font-mono text-[10px] ${isLiked ? 'text-rose-500 font-bold' : ''}`}>
                                {likesCount}
                              </span>
                            </button>

                            <span className="flex items-center gap-0.5">
                              <MessageCircle className="size-3 stroke-[1.8]" />
                              <span className="font-mono text-[10px]">{review.commentsCount}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      {/* 플로팅 최상단 스크롤 버튼 (^) */}
      <div
        className={`fixed bottom-[74px] left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${showScrollTop
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-75 pointer-events-none'
          }`}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="최상단으로 이동"
          className="flex items-center justify-center size-10 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md text-slate-700 hover:text-[#1884F7] hover:border-sky-300 active:scale-90 transition-all"
        >
          <ChevronUp className="size-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 5. 하단 고정 네비게이션 바: 홈, 행사, 커뮤니티, 마이 (시안 3번 하단) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg">
        <div className="mx-auto max-w-md flex items-center justify-around py-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('home')
              handleClearSearch()
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold transition-colors ${activeTab === 'home' ? 'text-[#1884F7]' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            <Home className="size-5" />
            <span>홈</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('events')
              if (onOpenEvents) {
                onOpenEvents()
              } else {
                onOpenLens()
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold transition-colors ${activeTab === 'events' ? 'text-[#1884F7]' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            <Calendar className="size-5" />
            <span>행사</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('community')
              if (onOpenCommunity) {
                onOpenCommunity()
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold transition-colors ${activeTab === 'community' ? 'text-[#1884F7]' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            <Users className="size-5" />
            <span>커뮤니티</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('my')
              if (onOpenMy) {
                onOpenMy()
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold transition-colors ${activeTab === 'my' ? 'text-[#1884F7]' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            <User className="size-5" />
            <span>마이</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
