import type { PoppleEvent } from '@/lib/events'
import { supabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
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
  cat1?: string
  cat2?: string
  cat3?: string
  overview?: string
  description?: string
  category?: string
  tags?: string[]
}

// 쇼핑 매장, 백화점, 아울렛 등 무관한 시설 제외를 위한 블랙리스트 키워드
const EXCLUDED_TITLE_KEYWORDS = [
  '백화점',
  '아울렛',
  '면세점',
  '이마트',
  '홈플러스',
  '하이마트',
  '쇼핑몰',
  '상설매장',
]

// 주요 테마 연관 검색어 매핑 (요건 3: 바다, 물, 음식 등)
const RELATED_THEME_KEYWORDS: Record<string, string[]> = {
  바다: ['해양', '해변', '해수욕장', '포구', '섬', '물', '오션', '해안', '마린', '비치', '항구'],
  해양: ['바다', '해변', '해수욕장', '포구', '섬', '물'],
  해변: ['바다', '해양', '해수욕장', '포구', '섬', '물'],
  해수욕장: ['바다', '해변', '해양', '물놀이'],
  포구: ['바다', '항구', '해안'],
  섬: ['바다', '해양', '도서'],
  물: ['워터', '물놀이', '수영', '강', '바다', '하천', '호수'],
  워터: ['물', '물놀이', '수영', '강', '바다'],
  물놀이: ['물', '워터', '수영', '강', '바다'],
  수영: ['물', '워터', '물놀이', '수영장'],
  강: ['물', '수변', '하천', '호수'],
  음식: ['푸드', '먹거리', '야시장', '디저트', '맥주', '맛', '요리', '미식', '막걸리', '전통주', '와인', '치킨'],
  푸드: ['음식', '먹거리', '야시장', '디저트', '맥주', '요리'],
  먹거리: ['음식', '푸드', '야시장', '디저트', '맥주'],
  야시장: ['음식', '푸드', '먹거리', '시장', '야간'],
  디저트: ['음식', '푸드', '카페', '베이커리', '빵', '커피'],
  맥주: ['음식', '푸드', '먹거리', '주류', '수제맥주', '비어'],
  음악: ['뮤직', '재즈', '밴드', '콘서트', '페스티벌', '록', '어쿠스틱', '클래식'],
  꽃: ['플라워', '단풍', '국화', '억새', '정원', '가을꽃', '봄꽃', '튤립', '장미'],
}

// '물' 검색 시 무관한 복합어(보물, 식물 등) 오탐 방지 단어 목록
const FALSE_WATER_WORDS = [
  '보물',
  '식물',
  '인물',
  '건물',
  '괴물',
  '선물',
  '작물',
  '동물',
  '곡물',
  '유물',
  '폐기물',
  '사물',
  '화물',
]

/**
 * 검색어로부터 연관 검색어 목록(자신 포함) 추출
 */
function getExpandedSearchTerms(query: string): string[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const terms = new Set<string>([trimmed])

  for (const [key, synonyms] of Object.entries(RELATED_THEME_KEYWORDS)) {
    const lowerKey = key.toLowerCase()
    if (trimmed.includes(lowerKey) || lowerKey.includes(trimmed)) {
      for (const syn of synonyms) {
        terms.add(syn.toLowerCase())
      }
    }
  }

  return Array.from(terms)
}

/**
 * 행사 항목의 다중 컬럼(title, addr1, addr2, description, overview, cat3, tags, category) OR 매칭 검사
 */
function matchesSearchTerms(
  item: {
    title?: string
    addr1?: string
    addr2?: string
    cat1?: string
    cat2?: string
    cat3?: string
    description?: string
    overview?: string
    tags?: string[]
    category?: string
  },
  searchTerms: string[],
): boolean {
  if (!searchTerms || searchTerms.length === 0) return true

  // 모든 컬럼 텍스트 취합 (제목, 주소, 상세설명, 카테고리, 태그 등)
  const targetText = [
    item.title || '',
    item.addr1 || '',
    item.addr2 || '',
    item.description || '',
    item.overview || '',
    item.cat1 || '',
    item.cat2 || '',
    item.cat3 || '',
    item.category || '',
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const term of searchTerms) {
    if (term === '물') {
      let sanitized = targetText
      for (const bad of FALSE_WATER_WORDS) {
        sanitized = sanitized.replaceAll(bad, '')
      }
      if (sanitized.includes('물')) return true
    } else {
      if (targetText.includes(term)) {
        return true
      }
    }
  }

  return false
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
  const keyword = (searchParams.get('keyword') || '').trim()

  if (!keyword) {
    return Response.json({ events: [] })
  }

  // 오늘 날짜 (YYYYMMDD)
  const todayStr = getTodayDateString()
  const DEFAULT_TOUR_API_KEY = 'ae2f8c36f6339b67ba8401daf1f1416801cfead2a6fe3b02f72775f7bb7df8d3'
  const tourApiKey = process.env.TOUR_API_KEY || DEFAULT_TOUR_API_KEY
  let tourEvents: PoppleEvent[] = []

  const expandedTerms = getExpandedSearchTerms(keyword)

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
      keywordUrl.searchParams.set('contentTypeId', '15')
      keywordUrl.searchParams.set('arrange', 'A')
      keywordUrl.searchParams.set('numOfRows', '50')

      // 2) TourAPI searchFestival2 병행 호출 (오늘 날짜 eventStartDate 전달, 200건 풍부한 풀 확보)
      const festUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2')
      festUrl.searchParams.set('serviceKey', decodedKey)
      festUrl.searchParams.set('MobileOS', 'ETC')
      festUrl.searchParams.set('MobileApp', 'Popple')
      festUrl.searchParams.set('_type', 'json')
      festUrl.searchParams.set('eventStartDate', todayStr)
      festUrl.searchParams.set('arrange', 'A')
      festUrl.searchParams.set('numOfRows', '200')

      // 3) 핵심 연관 검색어가 있는 경우 1건 추가 병행 검색 (예: 바다 -> 해변)
      const secondaryKeyword = expandedTerms.find(
        (t) => t !== keyword.toLowerCase() && t.length >= 2 && t !== '물',
      )
      const secondaryPromise = secondaryKeyword
        ? (() => {
            const secUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchKeyword2')
            secUrl.searchParams.set('serviceKey', decodedKey)
            secUrl.searchParams.set('MobileOS', 'ETC')
            secUrl.searchParams.set('MobileApp', 'Popple')
            secUrl.searchParams.set('_type', 'json')
            secUrl.searchParams.set('keyword', secondaryKeyword)
            secUrl.searchParams.set('contentTypeId', '15')
            secUrl.searchParams.set('arrange', 'A')
            secUrl.searchParams.set('numOfRows', '50')
            return fetch(secUrl.toString(), { signal: AbortSignal.timeout(5000) })
          })()
        : Promise.resolve(null)

      const [keywordRes, festRes, secRes] = await Promise.allSettled([
        fetch(keywordUrl.toString(), { signal: AbortSignal.timeout(5000) }),
        fetch(festUrl.toString(), { signal: AbortSignal.timeout(5000) }),
        secondaryPromise,
      ])

      const rawCandidateItems: TourItem[] = []

      // 1) searchKeyword2 결과 수집
      if (keywordRes.status === 'fulfilled' && keywordRes.value?.ok) {
        const data = await keywordRes.value.json().catch(() => ({}))
        const items: TourItem[] = data.response?.body?.items?.item || []
        if (Array.isArray(items)) {
          rawCandidateItems.push(...items)
        }
      }

      // 2) secondary keyword 결과 수집
      if (
        secRes.status === 'fulfilled' &&
        secRes.value &&
        'ok' in secRes.value &&
        secRes.value.ok
      ) {
        const data = await secRes.value.json().catch(() => ({}))
        const items: TourItem[] = data.response?.body?.items?.item || []
        if (Array.isArray(items)) {
          rawCandidateItems.push(...items)
        }
      }

      // 3) searchFestival2 결과 중 연관 검색어(제목, 주소, 상세설명, 태그 등) OR 매칭 축제 수집
      if (festRes.status === 'fulfilled' && festRes.value?.ok) {
        const festData = await festRes.value.json().catch(() => ({}))
        const festItems: TourItem[] = festData.response?.body?.items?.item || []
        if (Array.isArray(festItems)) {
          const matchedFests = festItems.filter((item) =>
            matchesSearchTerms(item, expandedTerms),
          )
          rawCandidateItems.push(...matchedFests)
        }
      }

      // 4) 엄격한 축제/행사 및 오늘 날짜 기준 유효성 필터링
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

        // 오늘 날짜 기준 실시간 종료일 필터링 (종료된 행사 완전 제외)
        const end = (item.eventenddate || item.eventstartdate || '').trim()
        const start = (item.eventstartdate || '').trim()

        if (!end && !start) {
          return false
        }
        if (end && end < todayStr) {
          return false
        }
        if (!end && start && start < todayStr) {
          return false
        }

        // 연관 키워드 다중 컬럼 매칭 확인
        return matchesSearchTerms(item, expandedTerms)
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

      // 5) 진행 중인 행사를 우선 노출하고, 시작일순(오름차순)으로 정렬
      uniqueItems.sort((a, b) => {
        const startA = (a.eventstartdate || '').trim() || '99999999'
        const startB = (b.eventstartdate || '').trim() || '99999999'
        const endA = (a.eventenddate || startA).trim()
        const endB = (b.eventenddate || startB).trim()

        const isOngoingA = startA <= todayStr && todayStr <= endA
        const isOngoingB = startB <= todayStr && todayStr <= endB

        if (isOngoingA && !isOngoingB) return -1
        if (!isOngoingA && isOngoingB) return 1

        if (startA !== startB) {
          return startA.localeCompare(startB)
        }
        return endA.localeCompare(endB)
      })

      // 6) PoppleEvent 모델로 가공
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

      // 7) Supabase festivals 테이블의 실시간 누적 조회수 매핑
      try {
        const { data: viewData } = await supabase
          .from('festivals')
          .select('id, title, view_count')

        if (Array.isArray(viewData) && viewData.length > 0) {
          const viewMap = new Map<string, number>()
          for (const v of viewData) {
            const count = Number(v.view_count) || 0
            const idStr = String(v.id || '')
            const numId = idStr.replace(/\D/g, '')

            viewMap.set(idStr, count)
            if (numId) {
              viewMap.set(numId, count)
              viewMap.set(`tour_${numId}`, count)
            }
            if (v.title) {
              viewMap.set(String(v.title).trim().toLowerCase(), count)
            }
          }

          for (const ev of tourEvents) {
            const numId = String(ev.id).replace(/\D/g, '')
            const titleKey = String(ev.title || '').trim().toLowerCase()
            ev.viewCount =
              viewMap.get(ev.id) ||
              (numId ? viewMap.get(numId) : undefined) ||
              viewMap.get(titleKey) ||
              0
          }
        }
      } catch {
        // Supabase 조회수 바인딩 실패 시에도 검색 결과 정상 제공
      }
    } catch (err) {
      console.warn('[popple-search] TourAPI search error:', err)
    }
  }

  // 실제 TourAPI 기반 검색 결과만 반환 (종료된 행사 완전히 제외)
  return Response.json({ events: tourEvents })
}
