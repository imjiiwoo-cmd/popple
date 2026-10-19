import type { PoppleEvent } from '@/lib/events'
import { supabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

export interface CalendarFestival extends PoppleEvent {
  startDate: string // YYYYMMDD
  endDate: string // YYYYMMDD
  viewCount?: number
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

  const DEFAULT_TOUR_API_KEY = 'ae2f8c36f6339b67ba8401daf1f1416801cfead2a6fe3b02f72775f7bb7df8d3'
  const tourApiKey = process.env.TOUR_API_KEY || DEFAULT_TOUR_API_KEY
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
      url.searchParams.set('numOfRows', '300') // 전체 축제 풀 확보 (이천펫축제, 문화가 있는 날 등 포함)

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const data = await res.json()
        const rawItems: TourFestivalItem[] = data.response?.body?.items?.item || []
        const items = Array.isArray(rawItems) ? rawItems : []

        for (const [idx, item] of items.entries()) {
          const rawImage = (item.firstimage || item.firstimage2 || '').trim()
          const fallbackPoster = '/events/rock-festival.png'
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

  // 3. Supabase festivals 테이블의 실시간 누적 조회수(view_count) 매핑
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
          viewMap.set(`tour_fest_${numId}`, count)
          viewMap.set(`tour_${numId}`, count)
          viewMap.set(`festival_${numId}`, count)
        }
        if (v.title) {
          viewMap.set(String(v.title).trim().toLowerCase(), count)
        }
      }

      for (const f of festivals) {
        const numId = String(f.id).replace(/\D/g, '')
        const titleKey = String(f.title || '').trim().toLowerCase()
        f.viewCount =
          viewMap.get(f.id) ||
          (numId ? viewMap.get(numId) : undefined) ||
          viewMap.get(titleKey) ||
          0
      }

      // 4. Supabase 상위 랭킹 축제 중 festivals 풀에 누락된 축제가 있다면 TourAPI keyword 검색으로 보완
      if (tourApiKey && tourApiKey !== 'your_tour_api_key_here') {
        const decodedKey = decodeURIComponent(tourApiKey.trim())
        const topViewed = [...viewData]
          .sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
          .slice(0, 10)

        for (const item of topViewed) {
          if (!item.title || item.title === '테스트') continue
          const cleanNumId = String(item.id || '').replace(/\D/g, '')
          const exists = festivals.some(
            (f) =>
              (cleanNumId && String(f.id).replace(/\D/g, '') === cleanNumId) ||
              (f.title && f.title.trim().toLowerCase() === item.title.trim().toLowerCase()),
          )

          if (!exists) {
            try {
              const kwUrl = new URL('https://apis.data.go.kr/B551011/KorService2/searchKeyword2')
              kwUrl.searchParams.set('serviceKey', decodedKey)
              kwUrl.searchParams.set('MobileOS', 'ETC')
              kwUrl.searchParams.set('MobileApp', 'Popple')
              kwUrl.searchParams.set('_type', 'json')
              kwUrl.searchParams.set('keyword', item.title)
              kwUrl.searchParams.set('contentTypeId', '15')
              kwUrl.searchParams.set('arrange', 'A')
              kwUrl.searchParams.set('numOfRows', '5')

              const kwRes = await fetch(kwUrl.toString(), { signal: AbortSignal.timeout(3000) })
              if (kwRes.ok) {
                const kwData = await kwRes.json()
                const kwRaw = kwData.response?.body?.items?.item
                const kwList: TourFestivalItem[] = Array.isArray(kwRaw) ? kwRaw : kwRaw ? [kwRaw] : []
                const matchedKw = kwList.find((it) => {
                  const itNumId = String(it.contentid || '').replace(/\D/g, '')
                  return (
                    (cleanNumId && itNumId === cleanNumId) ||
                    (it.title && it.title.trim() === item.title.trim())
                  )
                }) || kwList[0]

                if (matchedKw) {
                  const rawImage = (matchedKw.firstimage || matchedKw.firstimage2 || '').trim()
                  if (rawImage.startsWith('http')) {
                    const start = (matchedKw.eventstartdate || '').trim()
                    const end = (matchedKw.eventenddate || start).trim()
                    festivals.push({
                      id: `tour_fest_${matchedKw.contentid || cleanNumId}`,
                      title: matchedKw.title || item.title,
                      date: formatFestivalDate(start, end),
                      startDate: start,
                      endDate: end,
                      location: matchedKw.addr1 || matchedKw.addr2 || '상세 장소는 주최측 공지 참조',
                      price: '무료 관람 (체험비 별도)',
                      imageUrl: rawImage,
                      poster: rawImage,
                      tags: ['인기축제', 'HOT', '주간랭킹'],
                      category: '축제/행사',
                      description: `${matchedKw.addr1 || '현장'}에서 진행되는 "${matchedKw.title || item.title}".`,
                      viewCount: Number(item.view_count) || 0,
                    })
                  }
                }
              }
            } catch {
              // ignore single fetch failure
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[popple-festivals] Failed to load view counts from Supabase:', err)
  }

  // 실제 TourAPI 데이터 및 실시간 전역 조회수 반환
  return Response.json({ festivals })
}
