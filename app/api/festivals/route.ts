import { MOCK_EVENTS } from '@/lib/events'
import type { PoppleEvent } from '@/lib/events'

export const maxDuration = 30

export interface CalendarFestival extends PoppleEvent {
  startDate: string // YYYYMMDD
  endDate: string // YYYYMMDD
}

function parseMockDate(dateStr: string): { startDate: string; endDate: string } {
  // 예: "2026. 10. 24(토) - 10. 25(일)" or "2026. 05. 24(토) - 05. 25(일)"
  const numbers = dateStr.match(/\d+/g) || []
  if (numbers.length >= 5) {
    const yyyy = numbers[0]
    const mm1 = numbers[1].padStart(2, '0')
    const dd1 = numbers[2].padStart(2, '0')
    const mm2 = numbers[3].padStart(2, '0')
    const dd2 = numbers[4].padStart(2, '0')
    return {
      startDate: `${yyyy}${mm1}${dd1}`,
      endDate: `${yyyy}${mm2}${dd2}`,
    }
  } else if (numbers.length >= 3) {
    const yyyy = numbers[0]
    const mm1 = numbers[1].padStart(2, '0')
    const dd1 = numbers[2].padStart(2, '0')
    return {
      startDate: `${yyyy}${mm1}${dd1}`,
      endDate: `${yyyy}${mm1}${dd1}`,
    }
  }
  return { startDate: '20261001', endDate: '20261031' }
}

function formatFestivalDate(start?: string, end?: string): string {
  const fmt = (d: string) => {
    if (d && d.length === 8) {
      return `${d.slice(0, 4)}. ${d.slice(4, 6)}. ${d.slice(6, 8)}`
    }
    return d || ''
  }
  const s = fmt(start || '')
  const e = fmt(end || '')
  if (s && e && s !== e) return `${s} - ${e}`
  return s || e || '진행 중'
}

interface TourFestivalItem {
  contentid?: string
  contenttypeid?: string | number
  title?: string
  eventstartdate?: string
  eventenddate?: string
  addr1?: string
  addr2?: string
  firstimage?: string
  firstimage2?: string
}

/**
 * 한국 표준시(KST) 기준 오늘 날짜 문자열(YYYYMMDD)을 동적으로 생성
 */
function getTodayDateString(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const yyyy = parts.find((p) => p.type === 'year')?.value || String(now.getFullYear())
  const mm = parts.find((p) => p.type === 'month')?.value || String(now.getMonth() + 1).padStart(2, '0')
  const dd = parts.find((p) => p.type === 'day')?.value || String(now.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const todayStr = getTodayDateString()

  const tourApiKey = process.env.TOUR_API_KEY
  const festivals: CalendarFestival[] = []

  // 1. TourAPI searchFestival2 호출 (오늘 날짜 eventStartDate 전달)
  if (tourApiKey && tourApiKey !== 'your_tour_api_key_here') {
    try {
      const decodedKey = decodeURIComponent(tourApiKey.trim())
      const url = new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2')
      url.searchParams.set('serviceKey', decodedKey)
      url.searchParams.set('MobileOS', 'ETC')
      url.searchParams.set('MobileApp', 'Popple')
      url.searchParams.set('_type', 'json')
      url.searchParams.set('eventStartDate', todayStr) // ★ 1. 오늘 날짜 기준 전달
      url.searchParams.set('arrange', 'A')
      url.searchParams.set('numOfRows', '100')

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const data = await res.json()
        const rawItems: TourFestivalItem[] = data.response?.body?.items?.item || []
        const items = Array.isArray(rawItems) ? rawItems : []

        for (const [idx, item] of items.entries()) {
          const rawImage = (item.firstimage || item.firstimage2 || '').trim()
          const fallbackPoster = MOCK_EVENTS[idx % MOCK_EVENTS.length].imageUrl
          const imageUrl = rawImage.startsWith('http') ? rawImage : fallbackPoster

          const title =
            item.title?.replace(/&amp;/g, '&')?.replace(/&lt;/g, '<')?.replace(/&gt;/g, '>') ||
            '전국 축제'

          const start = (item.eventstartdate || '').trim()
          const end = (item.eventenddate || item.eventstartdate || '').trim()

          if (!start) continue

          // ★ [2. 오늘 날짜 기준 실시간 종료일 필터링]
          // eventenddate < 오늘 날짜: 이미 종료된 행사는 결과 목록에서 완전히 제외
          if (end && end < todayStr) continue
          if (!end && start && start < todayStr) continue

          festivals.push({
            id: `tour_fest_${item.contentid || idx}`,
            title,
            date: formatFestivalDate(start, end),
            startDate: start,
            endDate: end || start,
            location: item.addr1 || item.addr2 || '상세 장소는 주최측 공지 참조',
            price: '무료 관람 (체험비 별도)',
            imageUrl,
            poster: imageUrl,
            tags: ['축제', '문화행사', '나들이'],
            category: '축제/행사',
            description: `${item.addr1 || '현장'}에서 진행되는 "${title}". 다채로운 문화 공연과 체험 행사를 만나보세요.`,
          })
        }
      }
    } catch (err) {
      console.warn('[popple-festivals] TourAPI searchFestival2 error:', err)
    }
  }

  // 진행 중(start <= 오늘 <= end)이거나 앞으로 예정된 행사 정렬
  festivals.sort((a, b) => {
    const isOngoingA = a.startDate <= todayStr && todayStr <= a.endDate
    const isOngoingB = b.startDate <= todayStr && todayStr <= b.endDate

    if (isOngoingA && !isOngoingB) return -1
    if (!isOngoingA && isOngoingB) return 1

    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate)
    }
    return a.endDate.localeCompare(b.endDate)
  })

  // 실제 TourAPI 데이터만 반환 (하드코딩된 가짜 축제 더미 데이터 및 종료된 행사 제외)
  return Response.json({ festivals })
}
