import type { PoppleEvent } from './events'
import { MOCK_EVENTS } from './events'
import { supabase } from './supabaseClient'

export interface ClickLogEntry {
  id: string
  title: string
  timestamp: number // ms
  isoDate: string // ISO 8601 string
}

const STORAGE_KEY = 'popple_event_clicks'

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
      .select('id, view_count')

    if (!error && Array.isArray(data) && data.length > 0) {
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.id) {
          const c = Number(row.view_count) || 0
          counts[String(row.id)] = c
          counts[`tour_fest_${row.id}`] = c
          counts[`festival_${row.id}`] = c
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
 * '이번 주 가장 핫한 축제' 랭킹 산출
 * - Supabase 전역 누적 조회수 및 최근 7일 내 기록된 클릭 횟수 기준 상위 N개 추출
 * - 클릭 기록이 부족할 경우 전체 풀에서 최신순/진행순으로 채움 (안전한 폴백)
 */
export function computeWeeklyRanking(
  candidatePool: PoppleEvent[],
  limit = 5,
  globalCounts?: Record<string, number>,
): PoppleEvent[] {
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : MOCK_EVENTS
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
    }
  }

  // 2. 클릭/조회수가 있는 축제와 없는 축제 분리
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const rawId = ident.replace(/^tour_fest_|^festival_/, '')
    const count =
      counts[ident] ||
      counts[event.id] ||
      counts[rawId] ||
      ((event as unknown as { viewCount?: number }).viewCount ?? 0)

    if (count > 0) {
      clickedFestivals.push({ event, count })
    } else {
      unclickedFestivals.push(event)
    }
  }

  // 조회수 내림차순 정렬
  clickedFestivals.sort((a, b) => b.count - a.count)

  const result: PoppleEvent[] = clickedFestivals.map((c) => c.event)

  // 3. 기록이 부족할 경우 unclickedFestivals로 채움 (진행순/최신순 유지)
  for (const event of unclickedFestivals) {
    if (result.length >= limit) break
    const ident = getEventIdentifier(event)
    if (!result.some((r) => getEventIdentifier(r) === ident)) {
      result.push(event)
    }
  }

  // 4. 그래도 부족한 경우 MOCK_EVENTS에서 보충
  if (result.length < limit) {
    for (const mock of MOCK_EVENTS) {
      if (result.length >= limit) break
      const ident = getEventIdentifier(mock)
      if (!result.some((r) => getEventIdentifier(r) === ident)) {
        result.push(mock)
      }
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
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : MOCK_EVENTS
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
    }
  }

  // 2. 클릭/조회수가 있는 축제 우선 정렬
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const rawId = ident.replace(/^tour_fest_|^festival_/, '')
    const count =
      counts[ident] ||
      counts[event.id] ||
      counts[rawId] ||
      ((event as unknown as { viewCount?: number }).viewCount ?? 0)

    if (count > 0) {
      clickedFestivals.push({ event, count })
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

  if (result.length < limit) {
    for (const mock of MOCK_EVENTS) {
      if (result.length >= limit) break
      const ident = getEventIdentifier(mock)
      if (!result.some((r) => getEventIdentifier(r) === ident)) {
        result.push(mock)
      }
    }
  }

  return result.slice(0, limit)
}
