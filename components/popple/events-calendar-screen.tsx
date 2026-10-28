'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  MapPin,
  Star,
  Home,
  Users,
  User,
  Check,
  ImageIcon,
} from 'lucide-react'
import {
  type PoppleEvent,
  sortPopupsVisualFirst,
  parseEventDateRange,
  isEventActiveOnDate,
  isEventOperatingInRange,
  isEventOpeningOrClosingOnDate,
} from '@/lib/events'
import { PRESET_FESTIVALS, PRESET_POPUPS } from '@/lib/constants/events'
import type { CalendarFestival } from '@/app/api/festivals/route'
import { cn } from '@/lib/utils'
import { EventImage } from './event-image'

interface EventsCalendarScreenProps {
  onOpenHome: () => void
  onOpenLens: () => void
  onSelectEvent: (event: PoppleEvent) => void
  onOpenCommunity?: () => void
  onOpenMy?: () => void
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const REGIONS = [
  '전체 지역',
  '서울',
  '경기',
  '인천',
  '강원',
  '충청',
  '경상',
  '전라',
  '제주',
]

// 3. '팝업' 표기를 '팝업스토어'로 변경
const EVENT_TYPES = ['전체 행사', '팝업스토어', '지역축제']

/**
 * 특정 날짜가 속한 주의 월요일 구하기 (월요일 시작 기준)
 */
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay() // 0: 일, 1: 월 ... 6: 토
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * 월요일부터 7일간의 날짜 배열 생성
 */
function getWeekDates(monday: Date): Date[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + offset)
    return d
  })
}

/**
 * YYYYMMDD 형식 문자열 변환
 */
function toDateString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getDayLabel(d: Date): string {
  const day = d.getDay()
  const map = ['일', '월', '화', '수', '목', '금', '토']
  return map[day]
}

/**
 * N월 N째 주 라벨 계산 (주의 목요일 기준)
 */
function getWeekOfMonthText(monday: Date): string {
  const thursday = new Date(monday)
  thursday.setDate(thursday.getDate() + 3)
  const month = thursday.getMonth() + 1

  const firstDay = new Date(thursday.getFullYear(), thursday.getMonth(), 1)
  const firstMonday = getMondayOfWeek(firstDay)

  const diffDays = Math.round((thursday.getTime() - firstMonday.getTime()) / 86400000)
  const weekNum = Math.floor(diffDays / 7) + 1

  const weekLabels = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째']
  const label = weekLabels[Math.min(Math.max(weekNum - 1, 0), weekLabels.length - 1)] || `${weekNum}째`
  return `${month}월 ${label} 주`
}

/**
 * 주간 시작일(월요일)로부터 주간 범위(월~일 YYYYMMDD) 및 캐시 키 생성
 */
function getWeekRangeStrings(monday: Date): { startDate: string; endDate: string; key: string } {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const startDate = toDateString(monday)
  const endDate = toDateString(sunday)
  return {
    startDate,
    endDate,
    key: `${startDate}_${endDate}`,
  }
}

/**
 * 데이터 로딩 중 부드럽게 깜빡이는 행사 카드 스켈레톤 플레이스홀더
 */
function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-3 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex gap-3.5 animate-pulse">
      {/* 좌측 썸네일 스켈레톤 */}
      <div className="w-[112px] min-w-[112px] h-[190px] rounded-2xl bg-slate-200/70 shrink-0" />
      {/* 우측 텍스트 상세 스켈레톤 */}
      <div className="flex flex-col justify-between flex-1 py-1 min-w-0">
        <div className="space-y-2.5">
          <div className="h-5 bg-slate-200/80 rounded-md w-3/4" />
          <div className="h-4 bg-slate-200/60 rounded-md w-1/2" />
          <div className="space-y-2 pt-2">
            <div className="h-3.5 bg-slate-200/50 rounded w-2/3" />
            <div className="h-3.5 bg-slate-200/50 rounded w-1/2" />
            <div className="h-3.5 bg-slate-200/50 rounded w-4/5" />
          </div>
        </div>
        <div className="h-9 bg-slate-100 rounded-xl w-full mt-3" />
      </div>
    </div>
  )
}

/**
 * 카드용 날짜 포맷 (10.01 — 10.19)
 */
function formatCardDate(startStr?: string, endStr?: string, fallbackDate?: string): string {
  if (startStr && startStr.length === 8) {
    const s = `${startStr.slice(4, 6)}.${startStr.slice(6, 8)}`
    if (endStr && endStr.length === 8 && endStr !== startStr) {
      const e = `${endStr.slice(4, 6)}.${endStr.slice(6, 8)}`
      return `${s} — ${e}`
    }
    return s
  }
  if (fallbackDate) {
    const match = fallbackDate.match(/(\d{2})\.\s*(\d{2}).*?(\d{2})\.\s*(\d{2})/)
    if (match) {
      return `${match[1]}.${match[2]} — ${match[3]}.${match[4]}`
    }
  }
  return fallbackDate || '일정 확인 필요'
}

/**
 * 카드용 입장료 텍스트 정리
 */
function formatPrice(priceStr?: string): string {
  if (!priceStr) return '무료'
  if (priceStr.includes('무료')) return '무료'
  const match = priceStr.match(/\d+([,.]\d+)*원/)
  if (match) return match[0]
  return priceStr.slice(0, 15)
}

/**
 * 지역명 매칭 유틸리티 (도/시/광역시/특별자치시 포함)
 */
function matchesRegion(location: string, title: string, region: string): boolean {
  if (region === '전체 지역') return true
  const target = `${location} ${title}`
  if (region === '서울') return target.includes('서울')
  if (region === '경기') return target.includes('경기')
  if (region === '인천') return target.includes('인천')
  if (region === '강원') return target.includes('강원')
  if (region === '충청') return target.includes('충청') || target.includes('대전') || target.includes('세종')
  if (region === '경상') return target.includes('경상') || target.includes('부산') || target.includes('대구') || target.includes('울산')
  if (region === '전라') return target.includes('전라') || target.includes('광주') || target.includes('전북') || target.includes('전남')
  if (region === '제주') return target.includes('제주')
  return target.includes(region)
}

export function EventsCalendarScreen({
  onOpenHome,
  onOpenLens,
  onSelectEvent,
  onOpenCommunity,
  onOpenMy,
}: EventsCalendarScreenProps) {
  // 오늘 날짜 (2026년 기준)
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateString(today), [today])
  const currentYear = today.getFullYear()
  const currentActualMonth = today.getMonth() + 1

  // 1. 상태 관리: 주간 시작일(월요일), 선택된 날짜, 선택된 월
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMondayOfWeek(today))
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1)
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false)

  // 2. 필터 상태 (팝업스토어 반영)
  const [selectedRegion, setSelectedRegion] = useState<string>('전체 지역')
  const [selectedEventType, setSelectedEventType] = useState<string>('전체 행사')
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false)
  const [isEventTypeDropdownOpen, setIsEventTypeDropdownOpen] = useState(false)

  // 3. 북마크 상태 캐시 및 뷰 모드 (선택일 vs 주간 전체)
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({})
  const [viewAllWeek, setViewAllWeek] = useState(false)

  // 4. 축제 및 팝업스토어 목록 데이터 및 주간 캐시 (정적 프리셋 기본 내장으로 0.05초 즉각 렌더링)
  const [festivals, setFestivals] = useState<CalendarFestival[]>(() => PRESET_FESTIVALS)
  const [popups, setPopups] = useState<PoppleEvent[]>(() => PRESET_POPUPS)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [popupImageFailedMap, setPopupImageFailedMap] = useState<Record<string, boolean>>({})

  // 주간 단위 인메모리 캐시 (key: 'YYYYMMDD_YYYYMMDD' -> { festivals, popups })
  const weekCacheRef = useRef<Map<string, { festivals: CalendarFestival[]; popups: PoppleEvent[] }>>(new Map())
  const activeAbortRef = useRef<AbortController | null>(null)

  // 5. 플로팅 최상단 스크롤 버튼 표시 상태
  const [showScrollTop, setShowScrollTop] = useState(false)

  const monthDropdownRef = useRef<HTMLDivElement>(null)
  const regionDropdownRef = useRef<HTMLDivElement>(null)
  const eventTypeDropdownRef = useRef<HTMLDivElement>(null)

  // 스크롤 위치 감지 (window.scrollY > 180 시 버튼 노출)
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 180)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(target)) {
        setIsMonthDropdownOpen(false)
      }
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(target)) {
        setIsRegionDropdownOpen(false)
      }
      if (eventTypeDropdownRef.current && !eventTypeDropdownRef.current.contains(target)) {
        setIsEventTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * 고유 ID 기반 목록 병합 (프리셋을 기본 안전망으로 유지하면서 최신 API 데이터 병합)
   */
  const mergeById = <T extends { id: string }>(presetList: T[], apiList: T[]): T[] => {
    const map = new Map<string, T>()
    for (const item of presetList) {
      if (item && item.id) map.set(item.id, item)
    }
    for (const item of apiList) {
      if (item && item.id) map.set(item.id, item)
    }
    return Array.from(map.values())
  }

  // 주간 데이터 비동기 요청 함수 (캐시 우선 확인 및 프리셋 안전망 병합)
  const fetchWeekData = async (
    monday: Date,
    signal?: AbortSignal,
  ): Promise<{ festivals: CalendarFestival[]; popups: PoppleEvent[] }> => {
    const { startDate, endDate, key } = getWeekRangeStrings(monday)
    const cached = weekCacheRef.current.get(key)
    if (cached) {
      return cached
    }

    try {
      const [festRes, popRes] = await Promise.all([
        fetch(`/api/festivals?startDate=${startDate}&endDate=${endDate}`, { signal }),
        fetch(`/api/popups?startDate=${startDate}&endDate=${endDate}`, { signal }),
      ])
      const [festData, popData] = await Promise.all([
        festRes.ok ? festRes.json() : { festivals: [] },
        popRes.ok ? popRes.json() : { popups: [] },
      ])

      const fetchedFestivals = (festData.festivals || []) as CalendarFestival[]
      const fetchedPopups = (popData.popups || []) as PoppleEvent[]

      // 프리셋과 최신 API 결과 병합 (12h ISR 캐시 및 백그라운드 재검증 지원)
      const mergedFestivals = mergeById(PRESET_FESTIVALS, fetchedFestivals)
      const mergedPopups = mergeById(PRESET_POPUPS, fetchedPopups)

      const result = {
        festivals: mergedFestivals,
        popups: mergedPopups,
      }

      weekCacheRef.current.set(key, result)
      return result
    } catch {
      return {
        festivals: PRESET_FESTIVALS,
        popups: PRESET_POPUPS,
      }
    }
  }

  // 주간 단위 점진적 로딩 (Weekly Lazy Fetching) & 프리페칭 (Prefetching)
  useEffect(() => {
    let isMounted = true

    // 이전 주차 요청 취소
    if (activeAbortRef.current) {
      activeAbortRef.current.abort()
    }
    const controller = new AbortController()
    activeAbortRef.current = controller

    const { key, startDate, endDate } = getWeekRangeStrings(currentMonday)
    const cached = weekCacheRef.current.get(key)

    if (cached) {
      // 1순위: 캐시가 이미 존재하면 즉각 렌더링 (0ms 무지연)
      setFestivals(cached.festivals)
      setPopups(cached.popups)
      setIsLoading(false)
    } else {
      // 주차 내 프리셋 이벤트 보유 여부 확인 (프리셋이 있으면 로딩 스피너로 화면을 막지 않음)
      const hasPresetEventsInWeek =
        PRESET_FESTIVALS.some((f) => isEventOperatingInRange(f, startDate, endDate)) ||
        PRESET_POPUPS.some((p) => isEventOperatingInRange(p, startDate, endDate))

      if (!hasPresetEventsInWeek) {
        setIsLoading(true)
      }

      fetchWeekData(currentMonday, controller.signal)
        .then((data) => {
          if (isMounted) {
            setFestivals(data.festivals)
            setPopups(data.popups)
            setIsLoading(false)
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError' && isMounted) {
            setIsLoading(false)
          }
        })
    }

    // 앞뒤 1주차 데이터 백그라운드 프리페치 (Prefetching)
    const prefetchTimer = setTimeout(() => {
      if (!isMounted) return

      const prevMonday = new Date(currentMonday)
      prevMonday.setDate(prevMonday.getDate() - 7)
      const nextMonday = new Date(currentMonday)
      nextMonday.setDate(nextMonday.getDate() + 7)

      const prevKey = getWeekRangeStrings(prevMonday).key
      const nextKey = getWeekRangeStrings(nextMonday).key

      if (!weekCacheRef.current.has(nextKey)) {
        fetchWeekData(nextMonday).catch(() => {})
      }
      if (!weekCacheRef.current.has(prevKey)) {
        fetchWeekData(prevMonday).catch(() => {})
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(prefetchTimer)
      controller.abort()
    }
  }, [currentMonday])

  // 로컬스토리지에서 북마크 불러오기
  useEffect(() => {
    const map: Record<string, boolean> = {}
    try {
      for (const ev of [...festivals, ...popups]) {
        if (localStorage.getItem(`popple_bookmark_${ev.id}`) === 'true') {
          map[ev.id] = true
        }
      }
      setBookmarkedMap(map)
    } catch {
      // 무시
    }
  }, [festivals, popups])

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

  // 월 선택 드롭다운 핸들러
  const handleSelectMonth = (month: number) => {
    setSelectedMonth(month)
    setIsMonthDropdownOpen(false)

    if (month === currentActualMonth) {
      const thisMonday = getMondayOfWeek(today)
      setCurrentMonday(thisMonday)
      setSelectedDate(today)
    } else {
      const firstDayOfMonth = new Date(currentYear, month - 1, 1)
      const targetMonday = getMondayOfWeek(firstDayOfMonth)
      setCurrentMonday(targetMonday)
      setSelectedDate(firstDayOfMonth)
    }
  }

  // 주간 이동 (<, > 화살표 버튼)
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday)
    prev.setDate(prev.getDate() - 7)
    setCurrentMonday(prev)

    const nextSel = new Date(selectedDate)
    nextSel.setDate(nextSel.getDate() - 7)
    setSelectedDate(nextSel)
    setSelectedMonth(nextSel.getMonth() + 1)
  }

  const handleNextWeek = () => {
    const next = new Date(currentMonday)
    next.setDate(next.getDate() + 7)
    setCurrentMonday(next)

    const nextSel = new Date(selectedDate)
    nextSel.setDate(nextSel.getDate() + 7)
    setSelectedDate(nextSel)
    setSelectedMonth(nextSel.getMonth() + 1)
  }

  // 현재 보고 있는 주간의 7일 (월요일 ~ 일요일)
  const weekDays = useMemo(() => getWeekDates(currentMonday), [currentMonday])

  // 필터(지역/행사종류)가 적용된 특정 날짜의 축제 목록 (엄격한 날짜 필터링)
  const getFilteredFestivalsOnDate = (dateObj: Date): CalendarFestival[] => {
    // 3. '팝업스토어'를 선택했을 때는 가짜 데이터를 임의로 노출하지 않고 리스트를 비워둠
    if (selectedEventType === '팝업스토어') {
      return []
    }

    return festivals.filter((f) => {
      // 지역 필터링 (현재 선택된 지역 필터와 완전 동기화)
      if (!matchesRegion(f.location || '', f.title || '', selectedRegion)) {
        return false
      }

      // 행사 종류 필터링 (지역축제)
      if (selectedEventType === '지역축제') {
        const isPopup =
          f.category?.includes('팝업') ||
          f.tags?.some((t) => t.includes('팝업')) ||
          f.title?.includes('팝업')
        if (isPopup) return false
      }

      // 엄격한 날짜 필터링: [startDate, endDate] 기간 내 포함 여부 및 오늘 기준 지난 행사 제외
      return isEventActiveOnDate(f, dateObj, todayStr)
    })
  }

  // 필터(지역/행사종류)가 적용된 특정 날짜의 팝업스토어 목록 (엄격한 날짜 필터링)
  const getFilteredPopupsOnDate = (dateObj: Date): PoppleEvent[] => {
    if (selectedEventType === '지역축제') {
      return []
    }

    return popups.filter((p) => {
      // 지역 필터링
      if (!matchesRegion(p.location || '', p.title || '', selectedRegion)) {
        return false
      }

      // 엄격한 날짜 필터링: [startDate, endDate] 기간 내 포함 여부 및 오늘 기준 지난 행사 제외
      return isEventActiveOnDate(p, dateObj, todayStr)
    })
  }

  // 신규 오픈(startDate == 날짜) 또는 종료(endDate == 날짜) 지역축제 목록 (인디케이터 점 기준)
  const getOpenCloseFestivalsOnDate = (dateObj: Date): CalendarFestival[] => {
    if (selectedEventType === '팝업스토어') {
      return []
    }

    return festivals.filter((f) => {
      if (!matchesRegion(f.location || '', f.title || '', selectedRegion)) {
        return false
      }

      if (selectedEventType === '지역축제') {
        const isPopup =
          f.category?.includes('팝업') ||
          f.tags?.some((t) => t.includes('팝업')) ||
          f.title?.includes('팝업')
        if (isPopup) return false
      }

      return isEventOpeningOrClosingOnDate(f, dateObj)
    })
  }

  // 신규 오픈(startDate == 날짜) 또는 종료(endDate == 날짜) 팝업스토어 목록 (인디케이터 점 기준)
  const getOpenClosePopupsOnDate = (dateObj: Date): PoppleEvent[] => {
    if (selectedEventType === '지역축제') {
      return []
    }

    return popups.filter((p) => {
      if (!matchesRegion(p.location || '', p.title || '', selectedRegion)) {
        return false
      }

      return isEventOpeningOrClosingOnDate(p, dateObj)
    })
  }

  // 특정 날짜에 현재 선택된 필터(지역/행사종류)가 적용된 진행 중 축제 데이터 여부 판정
  const hasFestivalOnDate = (dateObj: Date): boolean => {
    return getFilteredFestivalsOnDate(dateObj).length > 0 || getFilteredPopupsOnDate(dateObj).length > 0
  }

  // 날짜 칩 클릭 시 해당 날짜로 선택 (엄격한 일자 필터링 즉각 반응)
  const handleSelectDateChip = (dateObj: Date) => {
    setSelectedDate(dateObj)
    if (viewAllWeek) {
      const dateKey = toDateString(dateObj)
      const targetElement = document.getElementById(`date-section-${dateKey}`)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // 이번 주 날짜별 행사 그룹 (날짜 오름차순, 각 일자별 엄격한 날짜 검증 적용)
  const weekFestivalGroups = useMemo(() => {
    if (selectedEventType === '팝업스토어') return []
    return weekDays.map((d) => {
      const fEvents = getFilteredFestivalsOnDate(d)
      const pEvents = selectedEventType === '전체 행사' ? getFilteredPopupsOnDate(d) : []
      const events: (CalendarFestival | PoppleEvent)[] = [
        ...fEvents,
        ...pEvents.map((p) => {
          const range = parseEventDateRange(p.date, p.startDate, p.endDate)
          return {
            ...p,
            startDate: range.startDate,
            endDate: range.endDate,
            category: '팝업스토어',
          }
        }),
      ]
      return {
        date: d,
        dateKey: toDateString(d),
        monthDayStr: `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        dayLabel: `${getDayLabel(d)}요일`,
        events,
        isSelected: isSameDate(d, selectedDate),
      }
    })
  }, [weekDays, festivals, popups, selectedRegion, selectedEventType, selectedDate, todayStr])

  // 특정 일자 선택 시: 선택된 날짜에 실제로 운영 중인 행사만 노출 (또는 주간 전체 보기 모드)
  const visibleGroups = useMemo(() => {
    if (selectedEventType === '팝업스토어') return []
    if (viewAllWeek) {
      const withEvents = weekFestivalGroups.filter((g) => g.events.length > 0)
      return withEvents.length > 0 ? withEvents : weekFestivalGroups
    }
    // 기본 모드: 선택된 날짜에 실제로 운영 중인 행사 그룹만 필터링하여 노출
    return weekFestivalGroups.filter((g) => g.isSelected)
  }, [weekFestivalGroups, selectedEventType, viewAllWeek])

  // 팝업스토어 필터링 및 시각적 우선 정렬 (선택된 날짜 기준 엄격 필터링)
  const filteredPopups = useMemo(() => {
    if (selectedEventType !== '팝업스토어') return []
    let list: PoppleEvent[]
    if (viewAllWeek) {
      const { startDate, endDate } = getWeekRangeStrings(currentMonday)
      list = popups.filter((p) => {
        if (!matchesRegion(p.location || '', p.title || '', selectedRegion)) return false
        return isEventOperatingInRange(p, startDate, endDate) && isEventActiveOnDate(p, p.endDate || endDate, todayStr)
      })
    } else {
      // 선택된 날짜에 실제로 운영 중인 팝업스토어만 정밀 필터링
      list = getFilteredPopupsOnDate(selectedDate)
    }
    return sortPopupsVisualFirst(list, popupImageFailedMap)
  }, [popups, selectedRegion, selectedEventType, selectedDate, currentMonday, viewAllWeek, popupImageFailedMap, todayStr])

  // 이번 주 총 행사 개수 (중복 제거)
  const totalEventsInWeek = useMemo(() => {
    const idSet = new Set<string>()
    for (const d of weekDays) {
      for (const ev of getFilteredFestivalsOnDate(d)) {
        idSet.add(ev.id)
      }
      for (const ev of getFilteredPopupsOnDate(d)) {
        idSet.add(ev.id)
      }
    }
    return idSet.size
  }, [weekDays, festivals, popups, selectedRegion, selectedEventType, todayStr])

  // 선택된 특정 날짜에 운영 중인 행사 건수
  const selectedDateEventsCount = useMemo(() => {
    if (selectedEventType === '팝업스토어') {
      return getFilteredPopupsOnDate(selectedDate).length
    }
    const currentGroup = weekFestivalGroups.find((g) => g.isSelected)
    return currentGroup ? currentGroup.events.length : 0
  }, [weekFestivalGroups, selectedDate, selectedEventType, popups, selectedRegion, todayStr])

  return (
    <div className="relative flex flex-col min-h-dvh bg-[#F8FAFC] text-slate-900 pb-28">
      {/* 1. 상단 타이틀 및 월 선택 드롭다운 영역 */}
      <header className="px-5 pt-7 pb-4">
        <div className="mx-auto max-w-md flex items-start justify-between">
          <div>
            <span className="text-[12px] font-black tracking-wider text-[#1884F7] uppercase">
              EVENT CALENDAR
            </span>
            <h1 className="text-[23px] font-black text-slate-900 tracking-tight mt-0.5">
              이번 주, 어디로 갈까요?
            </h1>
          </div>

          {/* 상단 우측 월 선택 드롭다운 버튼 (예: [📅 10월 ∨]) */}
          <div className="relative" ref={monthDropdownRef}>
            <button
              type="button"
              onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
              aria-expanded={isMonthDropdownOpen}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/90 hover:border-slate-300 text-[#1884F7] font-black text-sm rounded-2xl shadow-xs transition-all active:scale-95"
            >
              <CalendarIcon className="size-4 stroke-[2.2]" />
              <span>{selectedMonth}월</span>
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  isMonthDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 월 선택 드롭다운 팝오버 */}
            {isMonthDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-3 gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                {MONTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMonth(m)}
                    className={`py-2 text-xs font-bold rounded-xl transition-colors ${
                      m === selectedMonth
                        ? 'bg-[#1884F7] text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. 주간 캘린더 날짜 칩 및 인디케이터 박스 (피그마 시안 둥근 카드) */}
      <section className="px-5">
        <div className="mx-auto max-w-md rounded-3xl bg-white border border-slate-100 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          {/* 상단: 주차 타이틀 및 우측 범례(지역축제 빨간 점) */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[15px] font-black text-slate-800">
              {getWeekOfMonthText(currentMonday)}
            </span>

            {/* 축제 및 팝업 오픈/마감 범례 */}
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-500 inline-block" />
                <span>오픈/마감 축제</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-500 inline-block" />
                <span>오픈/마감 팝업</span>
              </div>
            </div>
          </div>

          {/* [2. 달력 좌우 화살표 위치 조정]: [< 화살표] [월~일 날짜 영역] [> 화살표] 수평(Flex) 정렬 */}
          <div className="flex items-center gap-1 -mx-1">
            {/* 좌측 이전 주 이동 화살표 (<) */}
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="이전 주"
              className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 transition-all shrink-0"
            >
              <ChevronLeft className="size-5 stroke-[2.5]" />
            </button>

            {/* 주간 7일 날짜 칩 영역 */}
            <div className="flex-1 flex items-center justify-between gap-0.5 sm:gap-1 min-w-0">
              {weekDays.map((dateObj, idx) => {
                const isSelected = isSameDate(dateObj, selectedDate)
                const openCloseFests = getOpenCloseFestivalsOnDate(dateObj)
                const openClosePopups = getOpenClosePopupsOnDate(dateObj)
                const festCount = openCloseFests.length
                const popupCount = openClosePopups.length
                const totalCount = festCount + popupCount
                const dayLabel = DAY_LABELS[idx] // 월 ~ 일

                return (
                  <button
                    key={toDateString(dateObj)}
                    type="button"
                    onClick={() => handleSelectDateChip(dateObj)}
                    className={cn(
                      'flex flex-col items-center justify-between py-2 px-0.5 rounded-2xl flex-1 transition-all cursor-pointer min-w-0 h-[78px]',
                      isSelected
                        ? 'bg-[#1884F7] text-white shadow-md shadow-sky-500/25 ring-2 ring-[#1884F7]/40 ring-offset-1'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {/* 요일 */}
                    <span
                      className={cn(
                        'text-[11px] sm:text-[12px] font-medium leading-none',
                        isSelected ? 'text-white/90 font-bold' : 'text-slate-400',
                      )}
                    >
                      {dayLabel}
                    </span>

                    {/* 날짜 숫자 */}
                    <span
                      className={cn(
                        'text-[16px] sm:text-[17px] font-black leading-none my-0.5',
                        isSelected ? 'text-white' : 'text-slate-800',
                      )}
                    >
                      {dateObj.getDate()}
                    </span>

                    {/* 신규 오픈/종료 행사 기준 점 인디케이터 (상시 평일은 완전 미노출) */}
                    <div className="h-4 flex items-center justify-center">
                      {totalCount > 0 ? (
                        <div className="flex items-center justify-center gap-1 leading-none">
                          {festCount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5"
                              title={`오픈/마감 축제 ${festCount}건`}
                            >
                              <span
                                className={cn(
                                  'size-1.5 rounded-full shrink-0',
                                  isSelected ? 'bg-rose-300 ring-1 ring-white/50' : 'bg-rose-500',
                                )}
                              />
                              <span
                                className={cn(
                                  'text-[10px] font-mono font-bold leading-none',
                                  isSelected ? 'text-white' : 'text-slate-600',
                                )}
                              >
                                {festCount}
                              </span>
                            </span>
                          )}
                          {popupCount > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5"
                              title={`오픈/마감 팝업 ${popupCount}건`}
                            >
                              <span
                                className={cn(
                                  'size-1.5 rounded-full shrink-0',
                                  isSelected ? 'bg-white' : 'bg-blue-500',
                                )}
                              />
                              <span
                                className={cn(
                                  'text-[10px] font-mono font-bold leading-none',
                                  isSelected ? 'text-white' : 'text-slate-600',
                                )}
                              >
                                {popupCount}
                              </span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="size-1.5 opacity-0" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 우측 다음 주 이동 화살표 (>) */}
            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="다음 주"
              className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 transition-all shrink-0"
            >
              <ChevronRight className="size-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. 전체 지역 / 전체 행사 필터 칩 바 */}
      <section className="px-5 mt-3">
        <div className="mx-auto max-w-md flex items-center gap-3">
          {/* 전체 지역 드롭다운 */}
          <div className="relative flex-1" ref={regionDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsRegionDropdownOpen((prev) => !prev)
                setIsEventTypeDropdownOpen(false)
              }}
              aria-expanded={isRegionDropdownOpen}
              className="w-full flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-white border border-slate-200/90 text-slate-700 font-bold text-sm shadow-2xs hover:border-slate-300 transition-colors active:scale-[0.98]"
            >
              <MapPin className="size-4 text-slate-400 stroke-[2.2]" />
              <span>{selectedRegion}</span>
              <ChevronDown
                className={`size-3.5 text-slate-400 transition-transform ${
                  isRegionDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isRegionDropdownOpen && (
              <div className="absolute left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 grid grid-cols-2 gap-1">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedRegion(r)
                      setIsRegionDropdownOpen(false)
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-between transition-colors ${
                      r === selectedRegion
                        ? 'bg-sky-50 text-[#1884F7]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{r}</span>
                    {r === selectedRegion && <Check className="size-3.5 stroke-[2.5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 전체 행사 드롭다운 (옵션: 전체 행사 / 팝업스토어 / 지역축제) */}
          <div className="relative flex-1" ref={eventTypeDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsEventTypeDropdownOpen((prev) => !prev)
                setIsRegionDropdownOpen(false)
              }}
              aria-expanded={isEventTypeDropdownOpen}
              className="w-full flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-white border border-slate-200/90 text-slate-700 font-bold text-sm shadow-2xs hover:border-slate-300 transition-colors active:scale-[0.98]"
            >
              <CalendarIcon className="size-4 text-slate-400 stroke-[2.2]" />
              <span>{selectedEventType}</span>
              <ChevronDown
                className={`size-3.5 text-slate-400 transition-transform ${
                  isEventTypeDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isEventTypeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedEventType(t)
                      setIsEventTypeDropdownOpen(false)
                    }}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-between transition-colors ${
                      t === selectedEventType
                        ? 'bg-sky-50 text-[#1884F7]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{t}</span>
                    {t === selectedEventType && <Check className="size-3.5 stroke-[2.5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. 해당 주/선택일 진행 행사 리스트 렌더링 */}
      <main className="px-5 mt-6 flex flex-col">
        <div className="mx-auto w-full max-w-md">
          {/* 타이틀 헤더 및 보기 방식 토글 (선택일 vs 주간 전체) */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-black tracking-wider text-[#1884F7] uppercase">
                {viewAllWeek ? 'THIS WEEK' : 'SELECTED DATE'}
              </span>
              {/* 보기 방식 토글 (선택일 / 주간 전체) */}
              <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewAllWeek(false)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all',
                    !viewAllWeek
                      ? 'bg-white text-[#1884F7] shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  선택 일자
                </button>
                <button
                  type="button"
                  onClick={() => setViewAllWeek(true)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-all',
                    viewAllWeek
                      ? 'bg-white text-[#1884F7] shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  이번 주 전체
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <h2 className="text-[21px] font-black text-slate-900 tracking-tight">
                {viewAllWeek
                  ? '이번 주 진행 중인 행사'
                  : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 (${getDayLabel(selectedDate)}) 행사`}
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {viewAllWeek ? `${totalEventsInWeek}개의 행사` : `${selectedDateEventsCount}개의 행사`}
              </span>
            </div>
          </div>

          {/* [행사 리스트 렌더링: 로딩 중 스켈레톤 노출 / 팝업스토어 / 날짜별 축제 목록] */}
          {isLoading ? (
            /* 스켈레톤 UI: 주간 데이터 로딩 시 깜빡이는 플레이스홀더 노출 */
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-2 mb-0.5 px-1">
                <span className="size-2 rounded-full bg-[#1884F7] animate-ping inline-block" />
                <span className="text-xs font-bold text-slate-400">
                  {selectedEventType === '팝업스토어' ? '팝업스토어' : '주간 행사'} 일정을 불러오는 중입니다...
                </span>
              </div>
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          ) : selectedEventType === '팝업스토어' ? (
            filteredPopups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-100 text-center gap-2.5 shadow-xs">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <CalendarIcon className="size-6 stroke-[1.8]" />
                </div>
                <p className="text-base font-bold text-slate-800">
                  {viewAllWeek
                    ? '해당 조건에 진행 중인 팝업스토어가 없어요'
                    : '선택하신 날짜에 진행 중인 팝업스토어가 없어요'}
                </p>
                <p className="text-xs text-slate-500 break-keep">
                  {viewAllWeek
                    ? '지역 필터를 ‘전체 지역’ 또는 다른 지역으로 변경해보세요!'
                    : '다른 날짜를 선택하거나 상단에서 ‘이번 주 전체’를 확인해보세요!'}
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
                      {/* 좌측: 둥근 모서리의 세로형 포스터 썸네일 이미지 또는 깔끔한 중립 Fallback UI */}
                      <div className="relative w-[112px] min-w-[112px] h-[190px] rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100/80">
                        <span className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-xs bg-[#1884F7]">
                          팝업
                        </span>

                        <EventImage
                          src={ev.imageUrl || ev.poster}
                          alt={ev.title}
                          fill
                          sizes="112px"
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
                          <div className="flex flex-col gap-1 mt-2.5 text-xs">
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
                              <span className="font-bold text-slate-700">
                                {ev.price || '무료'}
                              </span>
                            </div>
                            <div className="flex items-center text-slate-500 font-medium mt-0.5">
                              <MapPin className="size-3 text-slate-400 shrink-0 mr-1" />
                              <span className="truncate">{ev.location}</span>
                            </div>
                          </div>
                        </div>

                        {/* 하단: '상세 안내 >' 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent(ev)
                          }}
                          className="bg-[#F0F7FF] hover:bg-[#E2F0FE] active:scale-[0.98] text-[#1884F7] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-black transition-colors w-full mt-3"
                        >
                          <span>상세 안내</span>
                          <span className="flex items-center gap-0.5 font-bold text-slate-500">
                            <span>방문 정보</span>
                            <ChevronRight className="size-3.5 text-[#1884F7] stroke-[2.5]" />
                          </span>
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )
          ) : visibleGroups.every((g) => g.events.length === 0) ? (
            /* 행사가 없는 경우 */
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-100 text-center gap-2.5 shadow-xs">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <CalendarIcon className="size-6 stroke-[1.8]" />
              </div>
              <p className="text-base font-bold text-slate-800">
                {viewAllWeek
                  ? '해당 조건에 진행 중인 행사가 없어요'
                  : '선택하신 날짜에 진행 중인 행사가 없어요'}
              </p>
              <p className="text-xs text-slate-500 break-keep">
                {viewAllWeek
                  ? '지역 필터를 변경하거나 다른 주차로 이동해보세요!'
                  : '다른 날짜를 선택하거나 상단에서 ‘이번 주 전체’를 확인해보세요!'}
              </p>
            </div>
          ) : (
            /* 날짜별 오름차순 그룹 및 카드 리스트 */
            <div className="flex flex-col gap-6">
              {visibleGroups.map((group) => {
                if (group.events.length === 0 && !group.isSelected) {
                  return null
                }

                return (
                  <section
                    key={group.dateKey}
                    id={`date-section-${group.dateKey}`}
                    className="flex flex-col scroll-mt-24"
                  >
                    {/* 날짜 오름차순 헤더 (예: 10.07 화요일 [선택한 날짜]) */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[23px] font-black text-slate-900 tracking-tight">
                          {group.monthDayStr}
                        </span>
                        <span className="text-sm font-semibold text-slate-400">
                          {group.dayLabel}
                        </span>
                      </div>

                      {group.isSelected && (
                        <span className="bg-[#EAF3FF] text-[#1884F7] text-xs font-bold px-2.5 py-0.5 rounded-full">
                          선택한 날짜
                        </span>
                      )}
                    </div>

                    {/* 해당 일자의 행사 카드 리스트 */}
                    {group.events.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center text-xs text-slate-400">
                        이 날짜에는 진행 중인 행사가 없어요
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3.5">
                        {group.events.map((ev) => {
                          const isBookmarked = !!bookmarkedMap[ev.id]
                          const isPopup =
                            ev.category?.includes('팝업') ||
                            ev.tags?.some((t) => t.includes('팝업')) ||
                            ev.title?.includes('팝업')
                          const badgeText = isPopup ? '팝업' : '지역축제'
                          const badgeColor = isPopup ? 'bg-[#1884F7]' : 'bg-[#F43F5E]'

                          return (
                            <article
                              key={`${group.dateKey}_${ev.id}`}
                              onClick={() => onSelectEvent(ev)}
                              className="group relative bg-white rounded-3xl p-3 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex gap-3.5 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                            >
                              {/* 좌측: 둥근 모서리의 세로형 포스터 썸네일 이미지 */}
                              <div className="relative w-[112px] min-w-[112px] h-[190px] rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                                <span
                                  className={`absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-xs ${badgeColor}`}
                                >
                                  {badgeText}
                                </span>

                                <EventImage
                                  src={ev.imageUrl || ev.poster}
                                  alt={ev.title}
                                  fill
                                  sizes="112px"
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
                                  <div className="flex flex-col gap-1 mt-2.5 text-xs">
                                    <div className="flex items-center">
                                      <span className="w-11 text-slate-400 font-medium shrink-0">
                                        기간
                                      </span>
                                      <span className="font-bold text-slate-700">
                                        {formatCardDate(ev.startDate, ev.endDate, ev.date)}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      <span className="w-11 text-slate-400 font-medium shrink-0">
                                        입장료
                                      </span>
                                      <span className="font-bold text-slate-700">
                                        {formatPrice(ev.price)}
                                      </span>
                                    </div>
                                    <div className="flex items-center text-slate-500 font-medium mt-0.5">
                                      <MapPin className="size-3 text-slate-400 shrink-0 mr-1" />
                                      <span className="truncate">{ev.location}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 하단: '후기 보기 / 평점 4.8 >' 버튼 */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onSelectEvent(ev)
                                  }}
                                  className="bg-[#F0F7FF] hover:bg-[#E2F0FE] active:scale-[0.98] text-[#1884F7] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-black transition-colors w-full mt-3"
                                >
                                  <span>후기 보기</span>
                                  <span className="flex items-center gap-0.5 font-bold text-slate-500">
                                    <span>평점 4.8</span>
                                    <ChevronRight className="size-3.5 text-[#1884F7] stroke-[2.5]" />
                                  </span>
                                </button>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* [4. 하단 중앙 최상단 스크롤 버튼 (^)] */}
      <div
        className={`fixed bottom-[74px] left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          showScrollTop
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

      {/* 6. 하단 탭바: 홈, 행사(활성), 커뮤니티, 마이 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg">
        <div className="mx-auto max-w-md flex items-center justify-around py-2">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Home className="size-5" />
            <span>홈</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-[#1884F7] transition-colors"
          >
            <CalendarIcon className="size-5 stroke-[2.2]" />
            <span>행사</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenCommunity) {
                onOpenCommunity()
              } else {
                onOpenLens()
              }
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Users className="size-5" />
            <span>커뮤니티</span>
          </button>

          <button
            type="button"
            onClick={onOpenMy}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <User className="size-5" />
            <span>마이</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
