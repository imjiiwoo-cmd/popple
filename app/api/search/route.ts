import type { PoppleEvent } from '@/lib/events'

export const maxDuration = 30

/**
 * 축제 날짜 포맷팅 (YYYYMMDD -> YYYY. MM. DD)
 */
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

interface TourItem {
  contentid?: string
  contenttypeid?: string | number
  title?: string
  eventstartdate?: string
  eventenddate?: string
  addr1?: string
  addr2?: string
  firstimage?: string
  firstimage2?: string
  cat3?: string
}

// 쇼핑 매장, 백화점, 아울렛 등 무관한 시설 제외를 위한 블랙리스트 키워드
const EXCLUDED_TITLE_KEYWORDS = ['백화점', '아울렛', '면세점', '이마트', '홈플러스', '하이마트', '쇼핑몰', '상설매장']

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
  const keyword = (searchParams.get('keyword') || '').trim()

  if (!keyword) {
    return Response.json({ events: [] })
  }

  // 오늘 날짜 (YYYYMMDD)
  const todayStr = getTodayDateString()
  const DEFAULT_TOUR_API_KEY = 'ae2f8c36f6339b67ba8401daf1f1416801cfead2a6fe3b02f72775f7bb7df8d3'
  const tourApiKey = process.env.TOUR_API_KEY || DEFAULT_TOUR_API_KEY
  let tourEvents: PoppleEvent[] = []

  if (tourApiKey && tourApiKey !== 'your_tour_api_key_here') {
    const decodedKey = decodeURIComponent(tourApiKey.trim())

    try {
      // 1) TourAPI searchKeyword2 호출 (행사/공연/축제 contentTypeId=15)
      const keywordUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchKeyword2')
      keywordUrl.searchParams.set('serviceKey', decodedKey)
      keywordUrl.searchParams.set('MobileOS', 'ETC')
      keywordUrl.searchParams.set('MobileApp', 'Popple')
      keywordUrl.searchParams.set('_type', 'json')
      keywordUrl.searchParams.set('keyword', keyword)
      keywordUrl.searchParams.set('contentTypeId', '15') // 행사/공연/축제(15)만 원천 필터링
      keywordUrl.searchParams.set('arrange', 'A')
      keywordUrl.searchParams.set('numOfRows', '50')

      // 2) TourAPI searchFestival2 병행 호출 (오늘 날짜 eventStartDate 전달)
      const festUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2')
      festUrl.searchParams.set('serviceKey', decodedKey)
      festUrl.searchParams.set('MobileOS', 'ETC')
      festUrl.searchParams.set('MobileApp', 'Popple')
      festUrl.searchParams.set('_type', 'json')
      festUrl.searchParams.set('eventStartDate', todayStr) // ★ 1. 오늘 날짜 기준 전달
      festUrl.searchParams.set('arrange', 'A')
      festUrl.searchParams.set('numOfRows', '200') // 풍부한 축제 풀 확보

      const [keywordRes, festRes] = await Promise.allSettled([
        fetch(keywordUrl.toString(), { signal: AbortSignal.timeout(5000) }),
        fetch(festUrl.toString(), { signal: AbortSignal.timeout(5000) }),
      ])

      const rawCandidateItems: TourItem[] = []

      // 1) searchKeyword2 결과 수집
      if (keywordRes.status === 'fulfilled' && keywordRes.value.ok) {
        const data = await keywordRes.value.json().catch(() => ({}))
        const items: TourItem[] = data.response?.body?.items?.item || []
        if (Array.isArray(items)) {
          rawCandidateItems.push(...items)
        }
      }

      // 2) searchFestival2 결과 중 검색어(행사명, 지역명)와 일치하는 축제 수집
      if (festRes.status === 'fulfilled' && festRes.value.ok) {
        const festData = await festRes.value.json().catch(() => ({}))
        const festItems: TourItem[] = festData.response?.body?.items?.item || []
        if (Array.isArray(festItems)) {
          const lowerKw = keyword.toLowerCase()
          const matchedFests = festItems.filter((item) => {
            const titleMatch = (item.title || '').toLowerCase().includes(lowerKw)
            const addrMatch =
              (item.addr1 || '').toLowerCase().includes(lowerKw) ||
              (item.addr2 || '').toLowerCase().includes(lowerKw)
            return titleMatch || addrMatch
          })
          rawCandidateItems.push(...matchedFests)
        }
      }

      // 3) 엄격한 축제/행사 및 오늘 날짜 기준 유효성 필터링
      const filteredTourItems = rawCandidateItems.filter((item) => {
        // contentTypeId가 명시된 경우 15(행사/공연/축제)인지 확인
        if (item.contenttypeid && String(item.contenttypeid) !== '15') {
          return false
        }
        // 쇼핑/매장 키워드 차단
        const title = item.title || ''
        if (EXCLUDED_TITLE_KEYWORDS.some((bad) => title.includes(bad))) {
          return false
        }

        // ★ [2. 오늘 날짜 기준 실시간 종료일 필터링]
        // 각 행사의 종료일(eventenddate) 확인
        const end = (item.eventenddate || item.eventstartdate || '').trim()
        const start = (item.eventstartdate || '').trim()

        // 행사 기간 정보가 없는 항목은 유효 기간 확인 불가로 제외
        if (!end && !start) {
          return false
        }

        // eventenddate < 오늘 날짜(YYYYMMDD): 이미 종료된 행사로 판단하여 결과 목록에서 완전히 제외
        if (end && end < todayStr) {
          return false
        }
        // 종료일이 명시되지 않고 시작일만 있는 경우: 시작일 < 오늘 날짜면 제외
        if (!end && start && start < todayStr) {
          return false
        }

        return true
      })

      // 중복 contentid 제거
      const seenIds = new Set<string>()
      const uniqueItems: TourItem[] = []
      for (const it of filteredTourItems) {
        const idKey = it.contentid || it.title || ''
        if (idKey && !seenIds.has(idKey)) {
          seenIds.add(idKey)
          uniqueItems.push(it)
        }
      }

      // 4) 진행 중(start <= 오늘 <= end)이거나 앞으로 예정된(start > 오늘) 행사 정렬
      // 진행 중인 행사를 우선 노출하고, 시작일순(오름차순)으로 정렬
      uniqueItems.sort((a, b) => {
        const startA = (a.eventstartdate || '').trim() || '99999999'
        const startB = (b.eventstartdate || '').trim() || '99999999'
        const endA = (a.eventenddate || startA).trim()
        const endB = (b.eventenddate || startB).trim()

        const isOngoingA = startA <= todayStr && todayStr <= endA
        const isOngoingB = startB <= todayStr && todayStr <= endB

        // 1) 현재 진행 중인 축제를 예정된 축제보다 우선 배치
        if (isOngoingA && !isOngoingB) return -1
        if (!isOngoingA && isOngoingB) return 1

        // 2) 둘 다 진행 중이거나 둘 다 예정인 경우: 시작일순(오름차순)
        if (startA !== startB) {
          return startA.localeCompare(startB)
        }
        return endA.localeCompare(endB)
      })

      // 5) PoppleEvent 모델로 가공
      tourEvents = uniqueItems.map((item, idx) => {
        const rawImage = (item.firstimage || item.firstimage2 || '').trim()
        const fallbackPoster = '/events/rock-festival.png'
        const imageUrl = rawImage.startsWith('http') ? rawImage : fallbackPoster

        const title =
          item.title?.replace(/&amp;/g, '&')?.replace(/&lt;/g, '<')?.replace(/&gt;/g, '>') ||
          keyword

        const start = (item.eventstartdate || '').trim()
        const end = (item.eventenddate || start).trim()
        const dateStr = formatFestivalDate(start, end)

        return {
          id: `tour_${item.contentid || idx}`,
          title,
          date: dateStr,
          startDate: start,
          endDate: end,
          location: item.addr1 || item.addr2 || '상세 장소는 주최측 공지 참조',
          price: '무료 관람 (체험비 별도)',
          imageUrl,
          poster: imageUrl,
          tags: [keyword, '축제', '문화행사'],
          category: '축제/행사',
          description: `${item.addr1 || '현장'}에서 펼쳐지는 "${title}". 다양한 즐길거리와 볼거리를 만나보세요.`,
        }
      })
    } catch (err) {
      console.warn('[popple-search] TourAPI search error:', err)
    }
  }

  // 실제 TourAPI 기반 검색 결과만 반환 (종료된 행사 완전히 제외)
  return Response.json({ events: tourEvents })
}
