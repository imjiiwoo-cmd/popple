import { type PoppleEvent, sortEventsVisualFirst } from './events'
import { supabase } from './supabaseClient'

export interface ClickLogEntry {
  id: string
  title: string
  timestamp: number // ms
  isoDate: string // ISO 8601 string
}

const STORAGE_KEY = 'popple_event_clicks'

/**
 * ID에서 접두사(tour_fest_, festival_, tour_)를 정리하고 순수 식별자/숫자를 추출
 */
export function extractCleanId(id: string | number | undefined | null): string {
  if (!id) return ''
  const s = String(id).trim()
  const m = s.match(/\d+/)
  return m ? m[0] : s.replace(/^tour_fest_|^festival_|^tour_/, '')
}

function getEventIdentifier(event: PoppleEvent): string {
  return String((event as unknown as { contentid?: string }).contentid || event.id || '')
}

/**
 * Supabase DB에 조회수 1 증가 요청 전송 (RPC increment_view_count / API / upsert)
 */
async function syncViewCountToSupabase(eventId: string, title: string): Promise<void> {
  const cleanId = String(eventId).replace(/^tour_fest_|^festival_/, '')
  if (!cleanId) return

  // 1. RPC 함수 increment_view_count 호출 (SECURITY DEFINER로 RLS 우회)
  try {
    const { error: rpcError } = await supabase.rpc('increment_view_count', {
      p_event_id: cleanId,
      p_title: title,
    })

    if (!rpcError) return

    // 파라미터명 별칭 시도
    const { error: aliasError } = await supabase.rpc('increment_view_count', {
      event_id: cleanId,
      event_title: title,
    })
    if (!aliasError) return
  } catch {
    // RPC 실패 시 다음 단계 진행
  }

  // 2. Next.js 서버 API 라우트 (/api/festivals/view) 호출 (서버 사이드 프록시)
  try {
    const apiRes = await fetch('/api/festivals/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: cleanId, title }),
    })
    if (apiRes.ok) return
  } catch {
    // API 라우트 실패 시 다음 단계 진행
  }

  // 3. Supabase 테이블 직접 upsert 시도 (RLS가 허용되어 있는 경우)
  try {
    await supabase.from('festivals').upsert(
      {
        id: cleanId,
        title,
        view_count: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  } catch (tableErr) {
    console.warn('[ranking] Direct table upsert fallback failed:', tableErr)
  }
}

// 축제 마스터 풀 인메모리 캐시 (초기 로딩 및 탭 복귀 시 포스터 보존)
let memoryCandidatePool: PoppleEvent[] = []

/**
 * 축제 포스터 이미지 캐시 저장
 */
export function recordPosterToCache(id: string, title?: string, imageUrl?: string): void {
  if (typeof window === 'undefined' || !imageUrl) return
  if (imageUrl.includes('rock-festival') || imageUrl.includes('jazz-picnic')) return
  try {
    const raw = localStorage.getItem('popple_festival_posters')
    const cache: Record<string, string> = raw ? JSON.parse(raw) : {}
    const cleanId = extractCleanId(id)
    if (cleanId) cache[cleanId] = imageUrl
    if (title) {
      cache[title.trim().toLowerCase()] = imageUrl
      cache[title.replace(/\s+/g, '').toLowerCase()] = imageUrl
    }
    localStorage.setItem('popple_festival_posters', JSON.stringify(cache))
  } catch {
    // ignore
  }
}

/**
 * 축제 포스터 이미지 캐시 조회
 */
export function getCachedPoster(id: string, title?: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('popple_festival_posters')
    if (!raw) return null
    const cache: Record<string, string> = JSON.parse(raw)
    const cleanId = extractCleanId(id)
    if (cleanId && cache[cleanId]) return cache[cleanId]
    if (title) {
      const t1 = title.trim().toLowerCase()
      const t2 = title.replace(/\s+/g, '').toLowerCase()
      if (cache[t1]) return cache[t1]
      if (cache[t2]) return cache[t2]
    }
    return null
  } catch {
    return null
  }
}

/**
 * 축제 마스터 풀(TourAPI)에서 ID 또는 제목으로 매칭 항목 탐색
 */
export function findMatchingEventInPool(
  pool: PoppleEvent[],
  cleanDbId: string,
  dbTitle: string,
  fullId: string,
): PoppleEvent | undefined {
  if (!pool || pool.length === 0) return undefined

  const normDbTitle = dbTitle ? dbTitle.trim().toLowerCase() : ''
  const spaceLessDbTitle = normDbTitle ? normDbTitle.replace(/\s+/g, '') : ''

  return pool.find((ev) => {
    const cleanItemId = extractCleanId(ev.id)
    if (cleanItemId && cleanDbId && cleanItemId === cleanDbId) return true
    if (ev.id === fullId) return true

    if (normDbTitle && ev.title) {
      const normEvTitle = ev.title.trim().toLowerCase()
      const spaceLessEvTitle = normEvTitle.replace(/\s+/g, '')

      if (normEvTitle === normDbTitle) return true
      if (spaceLessEvTitle === spaceLessDbTitle) return true
      if (normEvTitle.includes(normDbTitle) || normDbTitle.includes(normEvTitle)) return true
    }
    return false
  })
}

/**
 * 사용자가 행사 상세페이지에 진입할 때 고유 ID와 시각을 로컬스토리지 및 Supabase DB에 기록
 */
export function recordEventClick(event: PoppleEvent): void {
  if (typeof window === 'undefined' || !event) return
  const eventId = getEventIdentifier(event)
  if (!eventId) return
  const title = event.title || ''
  const imageUrl = event.imageUrl || event.poster || ''

  // 1. 포스터 캐시 기록 (랭킹 카드 포스터 바인딩 보존)
  if (imageUrl) {
    recordPosterToCache(eventId, title, imageUrl)
  }

  // 2. 로컬 스토리지에 시각 로그 기록 (즉각적인 화면 반응성 보장)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list: ClickLogEntry[] = raw ? JSON.parse(raw) : []
    const now = Date.now()

    // 최근 14일 이전의 오래된 로그 정리
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
    const validLogs = Array.isArray(list)
      ? list.filter((item) => typeof item.timestamp === 'number' && item.timestamp >= fourteenDaysAgo)
      : []

    validLogs.push({
      id: String(eventId),
      title,
      timestamp: now,
      isoDate: new Date(now).toISOString(),
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(validLogs))

    // 로컬 랭킹 즉시 갱신을 위한 커스텀 이벤트 발행
    window.dispatchEvent(new Event('popple-event-clicked'))
  } catch (err) {
    console.warn('[ranking] Failed to record event click in localStorage:', err)
  }

  // 3. Supabase DB 전역 조회수 증가 요청 비동기 전송
  syncViewCountToSupabase(eventId, title).catch((err) => {
    console.warn('[ranking] Supabase sync error:', err)
  })
}

/**
 * 저장된 로컬 클릭 로그 목록 반환
 */
export function getEventClickLogs(): ClickLogEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/**
 * Supabase DB에서 모든 축제의 전역 조회수(view_count) 맵을 조회
 */
export async function fetchGlobalViewCounts(): Promise<Record<string, number>> {
  // 1. Supabase에서 festivals 테이블 조회 시도
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, title, view_count')

    if (!error && Array.isArray(data) && data.length > 0) {
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.id) {
          const c = Number(row.view_count) || 0
          const rawId = String(row.id)
          const numId = rawId.replace(/\D/g, '')

          counts[rawId] = c
          if (numId) {
            counts[numId] = c
            counts[`tour_fest_${numId}`] = c
            counts[`tour_${numId}`] = c
            counts[`festival_${numId}`] = c
          }
          if (row.title) {
            counts[String(row.title).trim().toLowerCase()] = c
          }
        }
      }
      return counts
    }
  } catch (err) {
    console.warn('[ranking] Direct Supabase view count query failed:', err)
  }

  // 2. 서버 API 라우트 (/api/festivals/view) 폴백 조회
  try {
    const res = await fetch('/api/festivals/view', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data.counts === 'object') {
        return data.counts
      }
    }
  } catch {
    // ignore
  }

  return {}
}

/**
 * [Supabase 실시간 연동] 주간 랭킹(이번 주 가장 핫한 축제 TOP 5) 산출
 * - 최근 7일간(current_date - 7 days)의 조회수 합계(festival_daily_views 또는 festivals.view_count + 7일 로컬 클릭) 기준
 * - TourAPI 축제 목록과 id/title 기준으로 매칭하여 상위 축제 반환
 */
export async function fetchWeeklyTopFestivals(
  candidatePool: PoppleEvent[] = [],
  limit = 5,
): Promise<PoppleEvent[]> {
  try {
    const now = Date.now()
    const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000
    const sevenDaysAgoStr = new Date(sevenDaysAgoMs).toISOString().split('T')[0]

    // 0. 축제 풀 캐시 동기화
    if (Array.isArray(candidatePool) && candidatePool.length > 0) {
      memoryCandidatePool = candidatePool
      for (const ev of candidatePool) {
        if (ev.imageUrl && !ev.imageUrl.includes('rock-festival') && !ev.imageUrl.includes('jazz-picnic')) {
          recordPosterToCache(ev.id, ev.title, ev.imageUrl)
        }
      }
    }
    const pool = candidatePool.length > 0 ? candidatePool : memoryCandidatePool

    // 1. festival_daily_views 테이블에서 최근 7일간 데이터 조회
    const { data: dailyRows } = await supabase
      .from('festival_daily_views')
      .select('festival_id, view_count, view_date')
      .gte('view_date', sevenDaysAgoStr)

    // 2. festivals 테이블에서 전체 view_count 조회
    const { data: topFestivals, error: festivalsError } = await supabase
      .from('festivals')
      .select('*')
      .order('view_count', { ascending: false })

    if (festivalsError) {
      console.warn('[ranking] Supabase top festivals query failed:', festivalsError)
    }

    // 3. 로컬 7일 클릭 로그
    const logs = getEventClickLogs().filter((l) => l.timestamp >= sevenDaysAgoMs)

    // 4. 축제별 7일간 통합 조회수 집계
    const countsMap = new Map<string, { count: number; record?: Record<string, unknown> }>()

    // (1) festival_daily_views 합산
    if (Array.isArray(dailyRows)) {
      for (const row of dailyRows) {
        if (!row.festival_id) continue
        const fid = String(row.festival_id)
        if (fid.startsWith('test_')) continue
        const current = countsMap.get(fid) || { count: 0 }
        current.count += Number(row.view_count) || 0
        countsMap.set(fid, current)
      }
    }

    // (2) festivals 테이블의 view_count 반영 (daily_views가 없는 경우 festivals.view_count 활용)
    if (Array.isArray(topFestivals)) {
      for (const row of topFestivals) {
        if (!row.id || String(row.id).startsWith('test_') || row.title === '테스트') continue
        const fid = String(row.id)
        const current = countsMap.get(fid) || { count: 0, record: row }
        current.record = row
        // dailyRows에 기록이 없거나 적을 경우 festivals.view_count를 기본값으로 활용
        if (current.count < (Number(row.view_count) || 0)) {
          current.count = Number(row.view_count) || 0
        }
        countsMap.set(fid, current)
      }
    }

    // (3) 로컬 7일 클릭 추가 가중
    for (const log of logs) {
      const fid = String(log.id)
      const current = countsMap.get(fid) || { count: 0 }
      current.count += 1
      countsMap.set(fid, current)
    }

    // 집계 결과를 배열로 변환 후 정렬
    const sortedDbItems = Array.from(countsMap.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count)

    const result: PoppleEvent[] = []
    const usedKeys = new Set<string>()

    // TourAPI 데이터 목록(pool)과 id 및 제목 기준으로 매칭하여 실제 포스터 바인딩
    for (const item of sortedDbItems) {
      const cleanDbId = extractCleanId(item.id)
      const dbTitle = item.record && typeof item.record.title === 'string'
        ? item.record.title.trim().toLowerCase()
        : ''

      const matched = findMatchingEventInPool(pool, cleanDbId, dbTitle, item.id)

      if (matched) {
        const key = matched.id
        if (!usedKeys.has(key)) {
          usedKeys.add(key)
          if (matched.imageUrl) {
            recordPosterToCache(matched.id, matched.title, matched.imageUrl)
          }
          result.push({
            ...matched,
            viewCount: item.count,
          })
        }
      } else if (item.record) {
        const cachedPoster = getCachedPoster(item.id, dbTitle)
        const rawPoster =
          cachedPoster ||
          (item.record.imageUrl as string) ||
          (item.record.poster as string) ||
          ''
        const realPoster =
          rawPoster && !rawPoster.includes('rock-festival') && !rawPoster.includes('jazz-picnic')
            ? rawPoster
            : ''

        const fallbackEvent: PoppleEvent = {
          id: String(item.id),
          title: (item.record.title as string) || '인기 축제',
          date: (item.record.date as string) || '진행 중',
          location: (item.record.location as string) || '전국',
          price: (item.record.price as string) || '무료',
          imageUrl: realPoster,
          poster: realPoster,
          tags: ['인기축제', 'HOT', '주간랭킹'],
          category: '축제/행사',
          description: (item.record.description as string) || `${item.record.title || '인기 축제'} 상세 정보`,
          viewCount: item.count,
        }
        const key = fallbackEvent.id
        if (!usedKeys.has(key)) {
          usedKeys.add(key)
          result.push(fallbackEvent)
        }
      }
    }

    // limit까지 부족한 슬롯은 실제 TourAPI 데이터(pool)의 축제로 순차 보충
    if (result.length < limit && pool.length > 0) {
      for (const item of pool) {
        if (result.length >= limit) break
        const cleanItemId = extractCleanId(item.id)
        const isAlreadyAdded = result.some(
          (r) =>
            r.id === item.id ||
            (cleanItemId && extractCleanId(r.id) === cleanItemId) ||
            (r.title && item.title && r.title.trim().toLowerCase() === item.title.trim().toLowerCase()),
        )
        if (!isAlreadyAdded) {
          result.push(item)
        }
      }
    }

    return sortEventsVisualFirst(result).slice(0, limit)
  } catch (err) {
    console.warn('[ranking] fetchWeeklyTopFestivals error:', err)
    return computeWeeklyRanking(candidatePool, limit)
  }
}

/**
 * [Supabase 실시간 연동] '오늘 실시간 인기 행사 (급상승)' 산출
 * - 오늘 날짜(view_date = current_date)의 조회수가 가장 높은 순으로 정렬
 * - 오늘 데이터가 적을 경우 최근 데이터/자정 이후 클릭 로그 기준 보완
 */
export async function fetchDailyLiveFestivals(
  candidatePool: PoppleEvent[] = [],
  limit = 5,
): Promise<PoppleEvent[]> {
  try {
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const todayIsoDate = now.toISOString().split('T')[0] // YYYY-MM-DD

    // 0. 축제 풀 캐시 동기화
    if (Array.isArray(candidatePool) && candidatePool.length > 0) {
      memoryCandidatePool = candidatePool
      for (const ev of candidatePool) {
        if (ev.imageUrl && !ev.imageUrl.includes('rock-festival') && !ev.imageUrl.includes('jazz-picnic')) {
          recordPosterToCache(ev.id, ev.title, ev.imageUrl)
        }
      }
    }
    const pool = candidatePool.length > 0 ? candidatePool : memoryCandidatePool

    // 1. festival_daily_views 테이블에서 오늘 날짜 데이터 조회
    const { data: todayDailyRows } = await supabase
      .from('festival_daily_views')
      .select('festival_id, view_count, view_date')
      .eq('view_date', todayIsoDate)

    // 2. 오늘 자정 이후 로컬 클릭 로그
    const todayLogs = getEventClickLogs().filter((l) => l.timestamp >= todayMidnight)

    // 3. festivals 테이블에서 최근 수정/조회된 축제 조회
    const { data: recentFestivals } = await supabase
      .from('festivals')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10)

    // 4. 오늘 조회수 집계
    const countsMap = new Map<string, { count: number; record?: Record<string, unknown> }>()

    if (Array.isArray(todayDailyRows) && todayDailyRows.length > 0) {
      for (const row of todayDailyRows) {
        if (!row.festival_id) continue
        const fid = String(row.festival_id)
        if (fid.startsWith('test_')) continue
        const current = countsMap.get(fid) || { count: 0 }
        current.count += Number(row.view_count) || 0
        countsMap.set(fid, current)
      }
    }

    // 오늘 로컬 클릭 가산
    for (const log of todayLogs) {
      const fid = String(log.id)
      const current = countsMap.get(fid) || { count: 0 }
      current.count += 1
      countsMap.set(fid, current)
    }

    // 오늘 데이터가 부족할 경우: 오늘 업데이트되었거나 가장 활발한 축제로 보완
    if (Array.isArray(recentFestivals)) {
      for (const row of recentFestivals) {
        if (!row.id || String(row.id).startsWith('test_') || row.title === '테스트') continue
        const fid = String(row.id)
        const current = countsMap.get(fid) || { count: 0, record: row }
        current.record = row

        // 오늘 수정된 레코드면 오늘 활동 가중치 부여
        const rowUpdatedTime = row.updated_at ? new Date(row.updated_at).getTime() : 0
        if (rowUpdatedTime >= todayMidnight) {
          current.count = Math.max(current.count, 1)
        }
        countsMap.set(fid, current)
      }
    }

    const sortedDbItems = Array.from(countsMap.entries())
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count)

    const result: PoppleEvent[] = []
    const usedKeys = new Set<string>()

    for (const item of sortedDbItems) {
      const cleanDbId = extractCleanId(item.id)
      const dbTitle = item.record && typeof item.record.title === 'string'
        ? item.record.title.trim().toLowerCase()
        : ''

      const matched = findMatchingEventInPool(pool, cleanDbId, dbTitle, item.id)

      if (matched) {
        const key = matched.id
        if (!usedKeys.has(key)) {
          usedKeys.add(key)
          if (matched.imageUrl) {
            recordPosterToCache(matched.id, matched.title, matched.imageUrl)
          }
          result.push({
            ...matched,
            viewCount: item.count,
          })
        }
      } else if (item.record) {
        const cachedPoster = getCachedPoster(item.id, dbTitle)
        const rawPoster =
          cachedPoster ||
          (item.record.imageUrl as string) ||
          (item.record.poster as string) ||
          ''
        const realPoster =
          rawPoster && !rawPoster.includes('jazz-picnic') && !rawPoster.includes('rock-festival')
            ? rawPoster
            : ''

        const fallbackEvent: PoppleEvent = {
          id: String(item.id),
          title: (item.record.title as string) || '인기 축제',
          date: (item.record.date as string) || '진행 중',
          location: (item.record.location as string) || '전국',
          price: (item.record.price as string) || '무료',
          imageUrl: realPoster,
          poster: realPoster,
          tags: ['실시간인기', '급상승'],
          category: '축제/행사',
          description: (item.record.description as string) || `${item.record.title || '인기 축제'} 상세 정보`,
          viewCount: item.count,
        }
        const key = fallbackEvent.id
        if (!usedKeys.has(key)) {
          usedKeys.add(key)
          result.push(fallbackEvent)
        }
      }
    }

    // 부족한 경우 pool(실제 TourAPI)의 축제로 보완
    if (result.length < limit && pool.length > 0) {
      for (const item of pool) {
        if (result.length >= limit) break
        const cleanItemId = extractCleanId(item.id)
        const isAlreadyAdded = result.some(
          (r) =>
            r.id === item.id ||
            (cleanItemId && extractCleanId(r.id) === cleanItemId) ||
            (r.title && item.title && r.title.trim().toLowerCase() === item.title.trim().toLowerCase()),
        )
        if (!isAlreadyAdded) {
          result.push(item)
        }
      }
    }

    return sortEventsVisualFirst(result).slice(0, limit)
  } catch (err) {
    console.warn('[ranking] fetchDailyLiveFestivals error:', err)
    return computeLiveNowRanking(candidatePool, limit)
  }
}

/**
 * '이번 주 가장 핫한 축제' 랭킹 산출 (동기 연산/로컬 클릭 가중치 폴백)
 */
export function computeWeeklyRanking(
  candidatePool: PoppleEvent[],
  limit = 5,
  globalCounts?: Record<string, number>,
): PoppleEvent[] {
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : []
  const logs = getEventClickLogs()
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  // 1. 조회수 집계 (Supabase 전역 조회수 + 최근 7일 로컬 클릭 통합)
  const counts: Record<string, number> = {}

  if (globalCounts) {
    for (const [id, count] of Object.entries(globalCounts)) {
      counts[id] = (counts[id] || 0) + count
    }
  }

  for (const log of logs) {
    if (log.timestamp >= sevenDaysAgo) {
      counts[log.id] = (counts[log.id] || 0) + 1
      const numId = String(log.id).replace(/\D/g, '')
      if (numId) counts[numId] = (counts[numId] || 0) + 1
    }
  }

  // 2. 클릭/조회수가 있는 축제와 없는 축제 분리
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const rawId = ident.replace(/^tour_fest_|^festival_|^tour_/, '')
    const numId = ident.replace(/\D/g, '')
    const titleKey = (event.title || '').trim().toLowerCase()
    const count =
      counts[ident] ||
      counts[event.id] ||
      counts[rawId] ||
      (numId ? counts[numId] : 0) ||
      counts[titleKey] ||
      ((event as unknown as { viewCount?: number }).viewCount ?? 0)

    if (count > 0) {
      clickedFestivals.push({ event: { ...event, viewCount: count }, count })
    } else {
      unclickedFestivals.push(event)
    }
  }

  // 조회수 내림차순 정렬
  clickedFestivals.sort((a, b) => b.count - a.count)

  const result: PoppleEvent[] = clickedFestivals.map((c) => c.event)

  // 3. 기록이 부족할 경우 unclickedFestivals로 채움
  for (const event of unclickedFestivals) {
    if (result.length >= limit) break
    const ident = getEventIdentifier(event)
    if (!result.some((r) => getEventIdentifier(r) === ident)) {
      result.push(event)
    }
  }

  return sortEventsVisualFirst(result).slice(0, limit)
}

/**
 * '실시간 인기 상승 행사' (당일 자정 이후 클릭 수 및 전역 가중치 기준)
 */
export function computeLiveNowRanking(
  candidatePool: PoppleEvent[],
  limit = 5,
  globalCounts?: Record<string, number>,
): PoppleEvent[] {
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : []
  const logs = getEventClickLogs()

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // 1. 오늘 00시 이후 클릭 횟수 및 전역 랭킹 집계
  const counts: Record<string, number> = {}

  if (globalCounts) {
    for (const [id, count] of Object.entries(globalCounts)) {
      counts[id] = (counts[id] || 0) + count
    }
  }

  for (const log of logs) {
    if (log.timestamp >= todayMidnight) {
      counts[log.id] = (counts[log.id] || 0) + 1
      const numId = String(log.id).replace(/\D/g, '')
      if (numId) counts[numId] = (counts[numId] || 0) + 1
    }
  }

  // 2. 클릭/조회수가 있는 축제 우선 정렬
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const rawId = ident.replace(/^tour_fest_|^festival_|^tour_/, '')
    const numId = ident.replace(/\D/g, '')
    const titleKey = (event.title || '').trim().toLowerCase()
    const count =
      counts[ident] ||
      counts[event.id] ||
      counts[rawId] ||
      (numId ? counts[numId] : 0) ||
      counts[titleKey] ||
      ((event as unknown as { viewCount?: number }).viewCount ?? 0)

    if (count > 0) {
      clickedFestivals.push({ event: { ...event, viewCount: count }, count })
    } else {
      unclickedFestivals.push(event)
    }
  }

  clickedFestivals.sort((a, b) => b.count - a.count)

  const result: PoppleEvent[] = clickedFestivals.map((c) => c.event)

  for (const event of unclickedFestivals) {
    if (result.length >= limit) break
    const ident = getEventIdentifier(event)
    if (!result.some((r) => getEventIdentifier(r) === ident)) {
      result.push(event)
    }
  }

  return sortEventsVisualFirst(result).slice(0, limit)
}

