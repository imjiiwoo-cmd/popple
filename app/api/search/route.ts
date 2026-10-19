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

// 주요 테마 및 방문 목적/동행자 연관 검색어 매핑 (요건 1)
const RELATED_THEME_KEYWORDS: Record<string, string[]> = {
  // [1] 데이트 / 커플 / 연인
  데이트: [
    '야간',
    '야경',
    '달빛',
    '음악',
    '재즈',
    '빛',
    '와인',
    '감성',
    '로맨틱',
    '피크닉',
    '산책',
    '마켓',
    '커플',
    '연인',
  ],
  커플: [
    '야간',
    '야경',
    '달빛',
    '음악',
    '재즈',
    '빛',
    '와인',
    '감성',
    '로맨틱',
    '피크닉',
    '산책',
    '마켓',
    '데이트',
    '연인',
  ],
  연인: [
    '야간',
    '야경',
    '달빛',
    '음악',
    '재즈',
    '빛',
    '와인',
    '감성',
    '로맨틱',
    '피크닉',
    '산책',
    '마켓',
    '데이트',
    '커플',
  ],

  // [2] 가족 / 아이 / 어린이
  가족: [
    '어린이',
    '키즈',
    '체험',
    '자연',
    '공원',
    '놀이',
    '생태',
    '가족',
    '동물',
    '인형극',
    '만들기',
    '아이',
  ],
  아이: [
    '어린이',
    '키즈',
    '체험',
    '자연',
    '공원',
    '놀이',
    '생태',
    '가족',
    '동물',
    '인형극',
    '만들기',
  ],
  어린이: [
    '어린이',
    '키즈',
    '체험',
    '자연',
    '공원',
    '놀이',
    '생태',
    '가족',
    '동물',
    '인형극',
    '만들기',
    '아이',
  ],
  키즈: [
    '어린이',
    '키즈',
    '체험',
    '자연',
    '공원',
    '놀이',
    '생태',
    '가족',
    '동물',
    '인형극',
    '만들기',
    '아이',
  ],

  // [3] 친구 / 모임
  친구: [
    '페스티벌',
    '파티',
    '버스킹',
    '야시장',
    '푸드',
    '맥주',
    '콘서트',
    '팝업',
    '모임',
  ],
  모임: [
    '페스티벌',
    '파티',
    '버스킹',
    '야시장',
    '푸드',
    '맥주',
    '콘서트',
    '팝업',
    '친구',
  ],

  // [4] 바다 / 자연 테마
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

  // [5] 음식 / 페스타 테마
  음식: ['푸드', '먹거리', '야시장', '디저트', '맥주', '맛', '요리', '미식', '막걸리', '전통주', '와인', '치킨'],
  푸드: ['음식', '먹거리', '야시장', '디저트', '맥주', '요리'],
  먹거리: ['음식', '푸드', '야시장', '디저트', '맥주'],
  야시장: ['음식', '푸드', '먹거리', '시장', '야간'],
  디저트: ['음식', '푸드', '카페', '베이커리', '빵', '커피'],
  맥주: ['음식', '푸드', '먹거리', '주류', '수제맥주', '비어'],

  // [6] 음악 / 공연 테마
  음악: ['뮤직', '재즈', '밴드', '콘서트', '페스티벌', '록', '어쿠스틱', '클래식', '공연', '버스킹', '라이브'],
  공연: ['음악', '뮤직', '콘서트', '페스티벌', '버스킹', '연극', '뮤지컬'],

  // [7] 팝업스토어 / 트렌드
  팝업: ['팝업스토어', '플래그십', '마켓', '전시', '체험', '굿즈', '트렌드', '플리마켓'],
  마켓: ['팝업', '플리마켓', '야시장', '장터', '쇼룸'],

  // [8] 전시 / 체험 테마
  체험: ['만들기', '공예', '체험학습', '전시', '키즈', '생태', '문화체험', '투어'],
  전시: ['미술', '아트', '갤러리', '디자인', '미디어아트', '체험', '박람회'],

  // [9] 자연 / 힐링 테마
  자연: ['생태', '공원', '숲', '수목원', '정원', '힐링', '산', '갈대', '억새', '단풍', '호수', '산책'],
  힐링: ['자연', '생태', '공원', '숲', '수목원', '정원', '산책', '휴식'],

  // [10] 반려견 / 반려동물 테마
  반려견: ['반려동물', '펫', '강아지', '애견', '댕댕', '동물', '펫페어', '펫축제'],
  반려동물: ['반려견', '펫', '강아지', '애견', '동물'],
  펫: ['반려견', '반려동물', '강아지', '애견'],
  애견: ['반려견', '반려동물', '펫', '강아지'],

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

export interface ThemeMeta {
  themeKey: string
  displayName: string
  summary: string
  tags: string[]
}

const THEME_METADATA_CONFIG: {
  triggers: string[]
  key: string
  displayName: string
  summary: string
  tags: string[]
}[] = [
  {
    triggers: ['데이트', '커플', '연인', '로맨틱'],
    key: '데이트',
    displayName: '감성 데이트',
    summary: '로맨틱 야경, 달빛 산책, 음악 페스티벌 등 데이트 맞춤 추천 행사가 포함되었습니다.',
    tags: ['데이트', '로맨틱', '야경', '달빛산책', '피크닉'],
  },
  {
    triggers: ['가족', '아이', '어린이', '키즈'],
    key: '가족',
    displayName: '가족·아이와',
    summary: '키즈 체험, 자연 생태 공원, 어린이 놀이 등 온 가족 맞춤 추천 행사가 포함되었습니다.',
    tags: ['가족', '키즈체험', '자연생태', '어린이', '놀이공원'],
  },
  {
    triggers: ['팝업', '플래그십', '굿즈'],
    key: '팝업',
    displayName: '핫한 팝업',
    summary: '감각적인 브랜드 팝업스토어, 플리마켓, 트렌드 전시 추천 행사입니다.',
    tags: ['팝업', '핫플', '플리마켓', '트렌드'],
  },
  {
    triggers: ['음식', '푸드', '먹거리', '야시장', '맥주', '디저트'],
    key: '푸드',
    displayName: '푸드·야시장',
    summary: '다채로운 먹거리 야시장, 수제맥주, 푸드 페스티벌 등 미식 추천 행사가 포함되었습니다.',
    tags: ['푸드', '야시장', '맥주', '먹거리'],
  },
  {
    triggers: ['음악', '뮤직', '재즈', '콘서트', '버스킹', '밴드', '공연'],
    key: '음악',
    displayName: '음악·공연',
    summary: '감미로운 재즈, 열정적인 밴드 라이브, 버스킹 등 음악 공연 추천 행사입니다.',
    tags: ['음악', '콘서트', '재즈', '버스킹', '라이브'],
  },
  {
    triggers: ['체험', '전시', '미술', '아트', '갤러리', '공예'],
    key: '체험',
    displayName: '전시·체험',
    summary: '다채로운 오감 체험, 예술 전시, 미디어아트 등 감각 충전 추천 행사입니다.',
    tags: ['전시', '체험', '미술관', '문화체험', '아트'],
  },
  {
    triggers: ['자연', '힐링', '산책', '생태', '숲', '공원', '수목원'],
    key: '자연',
    displayName: '자연·힐링',
    summary: '가을 억새, 푸른 수목원과 생태 공원 등 몸과 마음을 채우는 힐링 추천 행사입니다.',
    tags: ['자연', '힐링', '생태공원', '숲속산책', '단풍'],
  },
  {
    triggers: ['반려견', '반려동물', '펫', '애견', '강아지'],
    key: '반려견',
    displayName: '반려견 동반',
    summary: '사랑하는 반려견과 함께 뛰놀고 추억을 쌓는 펫 맞춤 추천 행사입니다.',
    tags: ['반려견', '펫축제', '댕댕이', '애견동반', '반려동물'],
  },
  {
    triggers: ['친구', '모임', '파티'],
    key: '친구',
    displayName: '친구·모임',
    summary: '페스티벌, 버스킹 콘서트, 야시장 푸드 등 친구·모임 맞춤 추천 행사가 포함되었습니다.',
    tags: ['친구', '페스티벌', '버스킹', '야시장', '맥주'],
  },
  {
    triggers: ['바다', '해양', '해변', '오션'],
    key: '바다',
    displayName: '바다·해변',
    summary: '시원한 해변, 바다 포구, 해양 축제 등 바다 테마 추천 행사가 포함되었습니다.',
    tags: ['바다', '해변', '해양축제'],
  },
]

function detectTheme(query: string): ThemeMeta | null {
  const trimmed = query.trim().toLowerCase()
  for (const meta of THEME_METADATA_CONFIG) {
    if (meta.triggers.some((trigger) => trimmed.includes(trigger.toLowerCase()))) {
      return {
        themeKey: meta.key,
        displayName: meta.displayName,
        summary: meta.summary,
        tags: meta.tags,
      }
    }
  }
  return null
}

/**
 * 검색어로부터 연관 검색어 목록(자신 포함) 추출
 */
function getExpandedSearchTerms(query: string): string[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const terms = new Set<string>([trimmed])

  for (const [key, synonyms] of Object.entries(RELATED_THEME_KEYWORDS)) {
    const lowerKey = key.toLowerCase()
    if (trimmed.includes(lowerKey) || (trimmed.length >= 2 && lowerKey.includes(trimmed))) {
      for (const syn of synonyms) {
        terms.add(syn.toLowerCase())
      }
    }
  }

  return Array.from(terms)
}

/**
 * 텍스트 내 특정 키워드 포함 여부 검사 (물 오탐 방지 필터 적용)
 */
function checkTextContains(text: string, term: string): boolean {
  if (!text || !term) return false
  if (term === '물') {
    let sanitized = text
    for (const bad of FALSE_WATER_WORDS) {
      sanitized = sanitized.replaceAll(bad, '')
    }
    return sanitized.includes('물')
  }
  return text.includes(term)
}

interface ScoredTourItem {
  item: TourItem
  score: number
  matchedTerms: string[]
  isDirectTitleMatch: boolean
}

/**
 * 행사의 제목(title), 개요/설명(overview, description), 장소/주소(addr1, addr2), 등록된 해시태그(tags) 전체를 대상으로
 * 가중치 점수를 산출 (요건 2)
 *
 * - 검색어가 제목에 직접 포함된 결과: +1000점 (상단 최우선 배치)
 * - 검색어가 태그에 직접 포함: +500점
 * - 검색어가 개요/설명에 직접 포함: +300점
 * - 검색어가 주소/장소에 직접 포함: +100점
 * - 연관 키워드 매칭:
 *   * 제목 내 포함: +120점 (키워드당)
 *   * 태그 내 포함: +60점
 *   * 개요/설명 내 포함: +40점
 *   * 주소/장소 내 포함: +20점
 *   * 카테고리 내 포함: +30점
 */
function calculateRelevanceScore(
  item: TourItem,
  query: string,
  expandedTerms: string[],
): ScoredTourItem {
  const qLower = query.trim().toLowerCase()
  const title = (item.title || '').toLowerCase()
  const overview = `${item.overview || ''} ${item.description || ''}`.toLowerCase()
  const addr = `${item.addr1 || ''} ${item.addr2 || ''}`.toLowerCase()
  const cat = `${item.cat1 || ''} ${item.cat2 || ''} ${item.cat3 || ''} ${item.category || ''}`.toLowerCase()
  const tags = (item.tags || []).map((t) => t.toLowerCase())

  let score = 0
  const matchedTermsSet = new Set<string>()
  let isDirectTitleMatch = false

  // 1) 직접 검색어 일치 가중치
  if (checkTextContains(title, qLower)) {
    score += 1000
    isDirectTitleMatch = true
    matchedTermsSet.add(qLower)
  }
  if (tags.some((t) => checkTextContains(t, qLower))) {
    score += 500
    matchedTermsSet.add(qLower)
  }
  if (checkTextContains(overview, qLower)) {
    score += 300
    matchedTermsSet.add(qLower)
  }
  if (checkTextContains(addr, qLower)) {
    score += 100
    matchedTermsSet.add(qLower)
  }
  if (checkTextContains(cat, qLower)) {
    score += 50
    matchedTermsSet.add(qLower)
  }

  // 2) 연관 키워드(동의어/테마 확장) 일치 가중치
  const relatedTerms = expandedTerms.filter((t) => t !== qLower)
  for (const term of relatedTerms) {
    let termMatched = false

    if (checkTextContains(title, term)) {
      score += 120
      termMatched = true
    }
    if (tags.some((t) => checkTextContains(t, term))) {
      score += 60
      termMatched = true
    }
    if (checkTextContains(overview, term)) {
      score += 40
      termMatched = true
    }
    if (checkTextContains(addr, term)) {
      score += 20
      termMatched = true
    }
    if (checkTextContains(cat, term)) {
      score += 30
      termMatched = true
    }

    if (termMatched) {
      matchedTermsSet.add(term)
    }
  }

  return {
    item,
    score,
    matchedTerms: Array.from(matchedTermsSet),
    isDirectTitleMatch,
  }
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
    return Response.json({ events: [], theme: null, themeSummary: null, themeName: null })
  }

  // 오늘 날짜 (YYYYMMDD)
  const todayStr = getTodayDateString()
  const DEFAULT_TOUR_API_KEY = 'ae2f8c36f6339b67ba8401daf1f1416801cfead2a6fe3b02f72775f7bb7df8d3'
  const tourApiKey = process.env.TOUR_API_KEY || DEFAULT_TOUR_API_KEY
  let tourEvents: PoppleEvent[] = []

  const expandedTerms = getExpandedSearchTerms(keyword)
  const detectedTheme = detectTheme(keyword)

  if (tourApiKey && tourApiKey !== 'your_tour_api_key_here') {
    const decodedKey = decodeURIComponent(tourApiKey.trim())

    try {
      // 1) TourAPI searchKeyword2 호출 (사용자 입력 키워드 기준)
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

      // 3) 핵심 연관 검색어가 있는 경우 최대 3건 추가 병행 검색 (예: 데이트 -> 야경, 달빛, 산책)
      const secondaryKeywords = expandedTerms
        .filter((t) => t !== keyword.toLowerCase() && t.length >= 2 && t !== '물')
        .slice(0, 3)

      const secondaryPromises = secondaryKeywords.map((secKw) => {
        const secUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchKeyword2')
        secUrl.searchParams.set('serviceKey', decodedKey)
        secUrl.searchParams.set('MobileOS', 'ETC')
        secUrl.searchParams.set('MobileApp', 'Popple')
        secUrl.searchParams.set('_type', 'json')
        secUrl.searchParams.set('keyword', secKw)
        secUrl.searchParams.set('contentTypeId', '15')
        secUrl.searchParams.set('arrange', 'A')
        secUrl.searchParams.set('numOfRows', '50')
        return fetch(secUrl.toString(), { signal: AbortSignal.timeout(5000) })
      })

      const [keywordRes, festRes, ...secResponses] = await Promise.allSettled([
        fetch(keywordUrl.toString(), { signal: AbortSignal.timeout(5000) }),
        fetch(festUrl.toString(), { signal: AbortSignal.timeout(5000) }),
        ...secondaryPromises,
      ])

      const rawCandidateItems: TourItem[] = []

      // 1) searchKeyword2 기본 키워드 결과 수집
      if (keywordRes.status === 'fulfilled' && keywordRes.value?.ok) {
        const data = await keywordRes.value.json().catch(() => ({}))
        const items: TourItem[] = data.response?.body?.items?.item || []
        if (Array.isArray(items)) {
          rawCandidateItems.push(...items)
        }
      }

      // 2) secondary keyword 결과 수집
      for (const sRes of secResponses) {
        if (sRes.status === 'fulfilled' && sRes.value?.ok) {
          const data = await sRes.value.json().catch(() => ({}))
          const items: TourItem[] = data.response?.body?.items?.item || []
          if (Array.isArray(items)) {
            rawCandidateItems.push(...items)
          }
        }
      }

      // 3) searchFestival2 전체 축제 풀 수집
      if (festRes.status === 'fulfilled' && festRes.value?.ok) {
        const festData = await festRes.value.json().catch(() => ({}))
        const festItems: TourItem[] = festData.response?.body?.items?.item || []
        if (Array.isArray(festItems)) {
          rawCandidateItems.push(...festItems)
        }
      }

      // 4) 엄격한 축제/행사 및 오늘 날짜 기준 유효성 필터링 + 중복 제거
      const seenIds = new Set<string>()
      const candidateItems: TourItem[] = []

      for (const item of rawCandidateItems) {
        // contentTypeId가 명시된 경우 15(행사/공연/축제)인지 확인
        if (item.contenttypeid && String(item.contenttypeid) !== '15') {
          continue
        }
        // 쇼핑/매장 키워드 차단
        const title = item.title || ''
        if (EXCLUDED_TITLE_KEYWORDS.some((bad) => title.includes(bad))) {
          continue
        }

        // 오늘 날짜 기준 실시간 종료일 필터링 (종료된 행사 완전 제외)
        const end = (item.eventenddate || item.eventstartdate || '').trim()
        const start = (item.eventstartdate || '').trim()

        if (!end && !start) {
          continue
        }
        if (end && end < todayStr) {
          continue
        }
        if (!end && start && start < todayStr) {
          continue
        }

        const idKey = item.contentid || item.title || ''
        if (idKey && !seenIds.has(idKey)) {
          seenIds.add(idKey)
          candidateItems.push(item)
        }
      }

      // 5) 가중치 점수 산출 및 필터링 (score > 0인 연관 항목만 선별)
      const scoredItems: ScoredTourItem[] = []
      for (const item of candidateItems) {
        const scored = calculateRelevanceScore(item, keyword, expandedTerms)
        if (scored.score > 0) {
          scoredItems.push(scored)
        }
      }

      // 6) 정렬: 검색어가 제목에 직접 포함된 결과 우선(score 1000+), 연관 키워드 매칭 순, 진행 중 우선, 시작일순
      scoredItems.sort((a, b) => {
        // 1순위: 가중치 점수 내림차순 (제목 직접 포함 1000점 우선 > 연관 키워드 매칭)
        if (b.score !== a.score) {
          return b.score - a.score
        }

        // 2순위: 진행 중인 행사 우선
        const startA = (a.item.eventstartdate || '').trim() || '99999999'
        const startB = (b.item.eventstartdate || '').trim() || '99999999'
        const endA = (a.item.eventenddate || startA).trim()
        const endB = (b.item.eventenddate || startB).trim()

        const isOngoingA = startA <= todayStr && todayStr <= endA
        const isOngoingB = startB <= todayStr && todayStr <= endB

        if (isOngoingA && !isOngoingB) return -1
        if (!isOngoingA && isOngoingB) return 1

        // 3순위: 시작일 오름차순
        if (startA !== startB) {
          return startA.localeCompare(startB)
        }
        return endA.localeCompare(endB)
      })

      // 7) PoppleEvent 모델로 가공
      tourEvents = scoredItems.map((scored, idx) => {
        const item = scored.item
        const rawImage = (item.firstimage || item.firstimage2 || '').trim()
        const fallbackPoster = '/events/rock-festival.png'
        const imageUrl = rawImage.startsWith('http') ? rawImage : fallbackPoster

        const title =
          item.title?.replace(/&amp;/g, '&')?.replace(/&lt;/g, '<')?.replace(/&gt;/g, '>') ||
          keyword

        const start = (item.eventstartdate || '').trim()
        const end = (item.eventenddate || start).trim()
        const dateStr = formatFestivalDate(start, end)

        // 매칭된 의미 키워드를 태그에 반영하여 연관성 시각적 강조
        const matchedKeywords = scored.matchedTerms
          .filter((t) => t !== keyword.toLowerCase() && t !== '물')
          .slice(0, 2)
        const eventTags = Array.from(
          new Set([keyword, ...matchedKeywords, '축제']),
        ).slice(0, 3)

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
          tags: eventTags,
          category: '축제/행사',
          description:
            item.overview ||
            item.description ||
            `${item.addr1 || '현장'}에서 펼쳐지는 "${title}". 다양한 즐길거리와 볼거리를 만나보세요.`,
        }
      })

      // 8) Supabase festivals 테이블의 실시간 누적 조회수 매핑
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

  // 실제 TourAPI 기반 검색 결과 및 테마 메타데이터 반환 (종료된 행사 완전히 제외)
  return Response.json({
    events: tourEvents,
    theme: detectedTheme,
    themeSummary: detectedTheme?.summary || null,
    themeName: detectedTheme?.displayName || null,
  })
}

