import type { PoppleEvent } from './events'
import { MOCK_EVENTS } from './events'

export interface ClickLogEntry {
  id: string
  title: string
  timestamp: number // ms
  isoDate: string // ISO 8601 string
}

const STORAGE_KEY = 'popple_event_clicks'

/**
 * 사용자가 행사 상세페이지에 진입할 때 고유 ID와 시각(ISO/timestamp)을 기록
 */
export function recordEventClick(event: PoppleEvent): void {
  if (typeof window === 'undefined' || !event) return
  const eventId = (event as unknown as { contentid?: string }).contentid || event.id
  if (!eventId) return

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list: ClickLogEntry[] = raw ? JSON.parse(raw) : []
    const now = Date.now()

    // 최근 14일 이전의 오래된 로그 정리 (스토리지 절약)
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000
    const validLogs = Array.isArray(list)
      ? list.filter((item) => typeof item.timestamp === 'number' && item.timestamp >= fourteenDaysAgo)
      : []

    validLogs.push({
      id: String(eventId),
      title: event.title || '',
      timestamp: now,
      isoDate: new Date(now).toISOString(),
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(validLogs))
  } catch (err) {
    console.warn('[ranking] Failed to record event click:', err)
  }
}

/**
 * 저장된 클릭 로그 목록 반환
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

function getEventIdentifier(event: PoppleEvent): string {
  return String((event as unknown as { contentid?: string }).contentid || event.id)
}

/**
 * '이번 주 가장 핫한 축제' 랭킹 산출
 * - 최근 7일 동안 기록된 클릭 횟수 기준 상위 N개 추출
 * - 클릭 기록이 부족할 경우 전체 풀에서 최신순/진행순으로 채움 (안전한 폴백)
 */
export function computeWeeklyRanking(
  candidatePool: PoppleEvent[],
  limit = 5,
): PoppleEvent[] {
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : MOCK_EVENTS
  const logs = getEventClickLogs()
  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  // 1. 최근 7일 내 클릭 횟수 집계
  const counts: Record<string, number> = {}
  for (const log of logs) {
    if (log.timestamp >= sevenDaysAgo) {
      counts[log.id] = (counts[log.id] || 0) + 1
    }
  }

  // 2. 클릭이 있는 축제와 없는 축제 분리
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const count = counts[ident] || counts[event.id] || 0
    if (count > 0) {
      clickedFestivals.push({ event, count })
    } else {
      unclickedFestivals.push(event)
    }
  }

  // 클릭 수 내림차순 정렬
  clickedFestivals.sort((a, b) => b.count - a.count)

  const result: PoppleEvent[] = clickedFestivals.map((c) => c.event)

  // 3. 기록이 부족할 경우 unclickedFestivals로 채움 (안전한 폴백: 최신/진행순)
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
 * '실시간 인기 상승 행사' (당일 자정 이후 클릭 수 기준)
 * - 오늘 00:00 이후 클릭 수 기준 정렬
 * - 기록이 부족할 경우 안전한 폴백 적용
 */
export function computeLiveNowRanking(
  candidatePool: PoppleEvent[],
  limit = 5,
): PoppleEvent[] {
  const pool = candidatePool && candidatePool.length > 0 ? candidatePool : MOCK_EVENTS
  const logs = getEventClickLogs()

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // 1. 오늘 00시 이후 클릭 횟수 집계
  const counts: Record<string, number> = {}
  for (const log of logs) {
    if (log.timestamp >= todayMidnight) {
      counts[log.id] = (counts[log.id] || 0) + 1
    }
  }

  // 2. 클릭이 있는 축제 우선 정렬
  const clickedFestivals: { event: PoppleEvent; count: number }[] = []
  const unclickedFestivals: PoppleEvent[] = []

  for (const event of pool) {
    const ident = getEventIdentifier(event)
    const count = counts[ident] || counts[event.id] || 0
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
