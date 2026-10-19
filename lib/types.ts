import type { PoppleEvent } from './events'

export type DetailedReason = {
  visual_mood: string
  event_feature: string
  match_reason: string
}

export type Recommendation = {
  recommended_event_id: string
  mood_tags: string[]
  mood_headline: string
  mood_summary: string
  detailed_reason: DetailedReason
  event: PoppleEvent
  sub_events?: PoppleEvent[]
  area_notice?: string

  // 하위 호환 필드
  keywords?: string[]
  comment?: string
  reason?: string
}
