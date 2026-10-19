import type { PoppleEvent } from './events'
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

/**
 * 사용자가 행사 상세페이지에 진입할 때 고유 ID와 시각을 로컬스토리지 및 Supabase DB에 기록
 */
export function recordEventClick(event: PoppleEvent): void {
  if (typeof window === 'undefined' || !event) return
  const eventId = getEventIdentifier(event)
  if (!eventId) return
  const title = event.title || ''

  // 1. 로컬 스토리지에 시각 로그 기록 (즉각적인 화면 반응성 보장)
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

  // 2. Supabase DB 전역 조회수 증가 요청 비동기 전송
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
 * [Supabase 실시간 연동] 주간 랭킹(이번 주 가장 핫한 축제) 산출
 * - Supabase의 `festivals` 테이블에서 `view_count`가 가장 높은 순서대로 데이터를 가져와서
 * - TourAPI 데이터 목록(candidatePool)과 id/title 기준으로 매칭하여 1위, 2위, 3위 ... 카드로 바인딩
 */
export async function fetchWeeklyTopFestivals(
  candidatePool: PoppleEvent[] = [],
  limit = 5,
): Promise<PoppleEvent[]> {
  try {
    const { data: topFestivals, error } = await supabase
      .from('festivals')
      .select('*')
      .order('view_count', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[ranking] Supabase top festivals query failed:', error)
      return computeWeeklyRanking(candidatePool, limit)
    }

    const result: PoppleEvent[] = []
    const usedKeys = new Set<string>()

    // 1. Supabase view_count 내림차순 결과를 1위부터 순서대로 매칭
    if (Array.isArray(topFestivals) && topFestivals.length > 0) {
      for (const record of topFestivals) {
        const cleanDbId = extractCleanId(record.id)
        const dbTitle = (record.title || '').trim().toLowerCase()

        // candidatePool(TourAPI)에서 ID 또는 제목으로 매칭
        const matched = candidatePool.find((item) => {
          const cleanItemId = extractCleanId(item.id)
          if (cleanItemId && cleanDbId && cleanItemId === cleanDbId) return true
          if (item.id === record.id) return true
          if (item.title && dbTitle && item.title.trim().toLowerCase() === dbTitle) return true
          return false
        })

        if (matched) {
          const key = matched.id
          if (!usedKeys.has(key)) {
            usedKeys.add(key)
            result.push({
              ...matched,
              viewCount: Number(record.view_count) || 0,
            })
          }
        } else if (record.id) {
          // TourAPI 목록에 아직 로드되지 않은 축제라도 Supabase 레코드 자체로 유효한 카드 구성
          const fallbackEvent: PoppleEvent = {
            id: String(record.id),
            title: record.title || '인기 축제',
            date: record.date || '진행 중',
            location: record.location || '전국',
            price: record.price || '무료',
            imageUrl: record.imageUrl || record.poster || '/events/rock-festival.png',
            poster: record.poster || record.imageUrl || '/events/rock-festival.png',
            tags: ['인기축제', 'HOT', '주간랭킹'],
            category: '축제/행사',
            description: record.description || `${record.title || '인기 축제'} 상세 정보`,
            viewCount: Number(record.view_count) || 0,
          }
          const key = fallbackEvent.id
          if (!usedKeys.has(key)) {
            usedKeys.add(key)
            result.push(fallbackEvent)
          }
        }
      }
    }

    // 2. 5위까지 부족한 슬롯은 실제 TourAPI 데이터(candidatePool)의 축제로 순차 보충 (더미/목업 배제)
    if (result.length < limit && candidatePool.length > 0) {
      for (const item of candidatePool) {
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

    return result.slice(0, limit)
  } catch (err) {
    console.warn('[ranking] fetchWeeklyTopFestivals error:', err)
    return computeWeeklyRanking(candidatePool, limit)
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

  return result.slice(0, limit)
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

  return result.slice(0, limit)
}

