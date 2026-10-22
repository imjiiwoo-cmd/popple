import type { PoppleEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1시간 캐싱 적용 (일일 API 호출 한도 관리)

function cleanText(text?: string): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseLocation(title: string, desc: string): { location: string; regionTag: string } {
  const combined = `${title} ${desc}`.toLowerCase()
  if (combined.includes('더현대') || combined.includes('여의도')) {
    return {
      location: '[여의도] 서울 영등포구 여의대로 108 (더현대 서울)',
      regionTag: '더현대',
    }
  }
  if (combined.includes('성수') || combined.includes('뚝섬') || combined.includes('서울숲')) {
    return {
      location: '[성수] 서울 성동구 성수동 팝업거리',
      regionTag: '성수',
    }
  }
  if (combined.includes('홍대') || combined.includes('연남') || combined.includes('마포') || combined.includes('합정')) {
    return {
      location: '[홍대] 서울 마포구 양화로 인근',
      regionTag: '홍대',
    }
  }
  if (combined.includes('강남') || combined.includes('신논현') || combined.includes('압구정') || combined.includes('청담') || combined.includes('신사')) {
    return {
      location: '[강남] 서울 강남구 강남대로 팝업존',
      regionTag: '강남',
    }
  }
  if (combined.includes('잠실') || combined.includes('롯데월드') || combined.includes('송파')) {
    return {
      location: '[잠실] 서울 송파구 올림픽로 300 (잠실 롯데월드몰)',
      regionTag: '잠실',
    }
  }
  return {
    location: '[서울] 서울 도심 트렌디 팝업스토어',
    regionTag: '서울',
  }
}

function getPopupPosterImage(regionTag: string, index: number): string {
  const posters = [
    '/events/media-art.png',
    '/events/rock-festival.png',
    '/events/night-market.png',
    '/events/jazz-picnic.png',
    '/events/flower-festival.png',
  ]
  if (regionTag === '성수') return '/events/media-art.png'
  if (regionTag === '더현대') return '/events/rock-festival.png'
  if (regionTag === '홍대') return '/events/night-market.png'
  if (regionTag === '강남') return '/events/jazz-picnic.png'
  return posters[index % posters.length]
}

function formatDateString(rawDate?: string): { dateStr: string; startDate: string; endDate: string } {
  if (rawDate && /^\d{8}$/.test(rawDate)) {
    const yyyy = rawDate.slice(0, 4)
    const mm = rawDate.slice(4, 6)
    const dd = rawDate.slice(6, 8)
    return {
      dateStr: `${yyyy}. ${mm}. ${dd} - 진행 중 (공지 참조)`,
      startDate: rawDate,
      endDate: '20261231',
    }
  }
  return {
    dateStr: '2026. 10. 20 - 진행 중 (방문안내 참조)',
    startDate: '20261020',
    endDate: '20261231',
  }
}

// 환경변수 부재 시 로컬/프리뷰 빌드가 깨지지 않도록 보장하는 안전한 트렌디 팝업 목업 풀 (요건 3)
const FALLBACK_POPUPS: PoppleEvent[] = [
  {
    id: 'popup_fallback_01',
    title: '디올 성수 2026 가을 익스클루시브 팝업',
    date: '2026. 10. 15 - 11. 30 (진행 중)',
    location: '[성수] 서울 성동구 연무장5길 7 (디올 성수)',
    price: '무료 관람 (사전예약/현장대기)',
    imageUrl: '/events/media-art.png',
    poster: '/events/media-art.png',
    tags: ['팝업', '성수', '핫플레이스', '명품팝업'],
    category: '팝업스토어',
    description: '가을의 정취를 담은 디올 성수의 새로운 아카이브 전시 및 포토존 체험 공간.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=디올+성수+팝업스토어',
  },
  {
    id: 'popup_fallback_02',
    title: '더현대 서울 아이코닉 캐릭터 & 아트 팝업',
    date: '2026. 10. 18 - 11. 10 (진행 중)',
    location: '[더현대] 서울 영등포구 여의대로 108 (더현대 서울 지하 1층 대행사장)',
    price: '무료 관람 (현장 대기 등록)',
    imageUrl: '/events/rock-festival.png',
    poster: '/events/rock-festival.png',
    tags: ['팝업', '더현대', '여의도', '캐릭터굿즈'],
    category: '팝업스토어',
    description: 'MZ세대가 열광하는 글로벌 인기 캐릭터 굿즈와 인터랙티브 미디어 전시.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=더현대+서울+팝업스토어',
  },
  {
    id: 'popup_fallback_03',
    title: '무신사 스탠다드 성수 플래그십 리미티드 팝업',
    date: '2026. 10. 10 - 11. 15 (진행 중)',
    location: '[성수] 서울 성동구 아차산로 82',
    price: '무료 관람',
    imageUrl: '/events/media-art.png',
    poster: '/events/media-art.png',
    tags: ['팝업', '성수', '패션', '성수핫플'],
    category: '팝업스토어',
    description: '트렌디한 FW 시즌 신규 라인업 런칭 및 브랜드 체험 부스 운영.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=무신사+성수+팝업스토어',
  },
  {
    id: 'popup_fallback_04',
    title: '홍대 카카오프렌즈 & 일러스트 크리에이터 팝업스퀘어',
    date: '2026. 10. 12 - 11. 08 (진행 중)',
    location: '[홍대] 서울 마포구 양화로 162',
    price: '무료 입장',
    imageUrl: '/events/night-market.png',
    poster: '/events/night-market.png',
    tags: ['팝업', '홍대', '일러스트', '굿즈샵'],
    category: '팝업스토어',
    description: '신진 크리에이터와 함께하는 한정판 아트 굿즈 및 라이브 드로잉 체험존.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=홍대+팝업스토어',
  },
  {
    id: 'popup_fallback_05',
    title: '강남 넷플릭스 오리지널 인터랙티브 체험 팝업존',
    date: '2026. 10. 20 - 11. 25 (진행 중)',
    location: '[강남] 서울 강남구 강남대로 420',
    price: '무료 관람 (사전 예약 권장)',
    imageUrl: '/events/jazz-picnic.png',
    poster: '/events/jazz-picnic.png',
    tags: ['팝업', '강남', '넷플릭스', '체험존'],
    category: '팝업스토어',
    description: '화제의 시리즈 세계관을 직접 체험할 수 있는 몰입형 세트장 및 미션 이벤트.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=강남+팝업스토어',
  },
  {
    id: 'popup_fallback_06',
    title: '탬버린즈 성수 프래그런스 인스톨레이션 팝업',
    date: '2026. 10. 16 - 12. 05 (진행 중)',
    location: '[성수] 서울 성동구 연무장길 84',
    price: '무료 관람',
    imageUrl: '/events/flower-festival.png',
    poster: '/events/flower-festival.png',
    tags: ['팝업', '성수', '향수', '감성전시'],
    category: '팝업스토어',
    description: '향과 조각 예술이 어우러진 감각적인 힐링 전시 및 시향 프로그램.',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=탬버린즈+성수+팝업',
  },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const queryParam = searchParams.get('query') || searchParams.get('q') || ''
  const regionParam = searchParams.get('region') || ''

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  // 환경변수가 없거나 유효하지 않은 경우 안전하게 fallback 데이터 반환 (요건 3)
  if (!clientId || !clientSecret) {
    let filtered = FALLBACK_POPUPS
    if (regionParam && regionParam !== '전체') {
      filtered = filtered.filter((p) => p.location.includes(regionParam) || p.tags.includes(regionParam))
    }
    return Response.json({
      popups: filtered,
      total: filtered.length,
      source: 'fallback',
    })
  }

  // 타겟 쿼리: "성수 팝업스토어", "더현대 팝업스토어", "홍대 팝업", "강남 팝업스토어" (요건 1)
  const targetQueries = queryParam
    ? [queryParam.includes('팝업') ? queryParam : `${queryParam} 팝업스토어`]
    : ['성수 팝업스토어', '더현대 팝업스토어', '홍대 팝업', '강남 팝업스토어']

  const collectedEvents: PoppleEvent[] = []
  const seenLinks = new Set<string>()

  try {
    const fetchPromises: Promise<Response>[] = []

    for (const q of targetQueries) {
      // 1) 네이버 블로그 검색 API (생생한 방문 후기, 일정, 사전예약 팁)
      const blogUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(q)}&display=10&sort=date`
      fetchPromises.push(
        fetch(blogUrl, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
          next: { revalidate: 3600 }, // 1시간 캐싱
          signal: AbortSignal.timeout(5000),
        }),
      )

      // 2) 네이버 뉴스 검색 API (공식 브랜드 오픈 보도자료)
      const newsUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(q)}&display=5&sort=date`
      fetchPromises.push(
        fetch(newsUrl, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(5000),
        }),
      )
    }

    const responses = await Promise.allSettled(fetchPromises)

    for (const res of responses) {
      if (res.status !== 'fulfilled' || !res.value.ok) continue

      const data = await res.value.json().catch(() => ({}))
      const items = Array.isArray(data.items) ? data.items : []

      for (const item of items) {
        const rawLink = item.link || item.originallink || ''
        if (!rawLink || seenLinks.has(rawLink)) continue
        seenLinks.add(rawLink)

        const title = cleanText(item.title)
        const desc = cleanText(item.description)

        // 광고성/무관한 글 필터링
        if (!title.includes('팝업') && !desc.includes('팝업')) continue

        const { location, regionTag } = parseLocation(title, desc)
        const { dateStr, startDate, endDate } = formatDateString(item.postdate)

        const idx = collectedEvents.length
        const imageUrl = getPopupPosterImage(regionTag, idx)

        collectedEvents.push({
          id: `popup_naver_${idx}_${item.postdate || Date.now()}`,
          title,
          date: dateStr,
          startDate,
          endDate,
          location,
          price: '무료 관람 (사전예약/현장대기)',
          imageUrl,
          poster: imageUrl,
          tags: ['팝업', regionTag, '핫플레이스', '전시체험'],
          category: '팝업스토어',
          description: desc || `${regionTag}에서 열리는 화제의 팝업스토어 "${title}". 현장 이벤트와 한정판 굿즈를 만나보세요.`,
          websiteUrl: rawLink,
        })
      }
    }
  } catch (err) {
    console.warn('[popple-popups] Naver search API error:', err)
  }

  // 수집 결과가 부족하거나 실패한 경우 fallback과 병합하여 안정적인 풀 확보
  const finalPopups = collectedEvents.length > 0 ? collectedEvents : FALLBACK_POPUPS

  // 지역 필터가 있을 경우 필터링
  let result = finalPopups
  if (regionParam && regionParam !== '전체') {
    result = result.filter(
      (p) => p.location.includes(regionParam) || p.tags.includes(regionParam),
    )
  }

  return Response.json({
    popups: result,
    total: result.length,
    source: collectedEvents.length > 0 ? 'naver' : 'fallback',
  })
}
