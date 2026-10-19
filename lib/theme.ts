import type { PoppleEvent } from './events'

export interface ThemeDefinition {
  id: string
  title: string
  tagline: string
  tags: string[]
  imageUrl: string
  keywords: string[]
  type: 'season' | 'regular'
  season?: 'spring' | 'summer' | 'autumn' | 'winter'
}

/**
 * 1) 계절 테마 풀 (현재 접속 월 기준 자동 1종 선택)
 * - 봄 (3~5월): '🌸 살랑살랑 봄바람 꽃나들이'
 * - 여름 (6~8월): '🌊 무더위 날릴 시원한 물놀이'
 * - 가을 (9~11월): '🌾 선선한 바람맞이 가을산책'
 * - 겨울 (12~2월): '♨️ 몸을 데워줄 따뜻한 온기'
 */
export const SEASON_THEMES: Record<'spring' | 'summer' | 'autumn' | 'winter', ThemeDefinition> = {
  spring: {
    id: 'season-spring',
    title: '🌸 살랑살랑 봄바람 꽃나들이',
    tagline: '햇살 충전',
    tags: ['#봄꽃', '#피크닉', '#벚꽃'],
    imageUrl: '/events/flower-festival.png',
    keywords: ['벚꽃', '매화', '산수유', '튤립', '봄꽃', '유채', '피크닉', '봄'],
    type: 'season',
    season: 'spring',
  },
  summer: {
    id: 'season-summer',
    title: '🌊 무더위 날릴 시원한 물놀이',
    tagline: '청량 충전',
    tags: ['#여름바다', '#물놀이', '#워터밤'],
    imageUrl: '/events/summer-water.jpg',
    keywords: ['물총', '머드', '바다', '해변', '워터', '수국', '야간', '수영'],
    type: 'season',
    season: 'summer',
  },
  autumn: {
    id: 'season-autumn',
    title: '🌾 선선한 바람맞이 가을산책',
    tagline: '가을 정취',
    tags: ['#억새', '#단풍', '#가을산책'],
    imageUrl: '/events/autumn-walk.jpg',
    keywords: ['억새', '국화', '단풍', '갈대', '가을', '산책', '숲', '걷기'],
    type: 'season',
    season: 'autumn',
  },
  winter: {
    id: 'season-winter',
    title: '♨️ 몸을 데워줄 따뜻한 온기',
    tagline: '겨울 감성',
    tags: ['#빛축제', '#온천', '#겨울여행'],
    imageUrl: '/events/winter-warm.jpg',
    keywords: ['온천', '빛축제', '불빛', '군밤', '겨울', '눈꽃', '얼음', '스파', '국물'],
    type: 'season',
    season: 'winter',
  },
}

/**
 * 2) 상시 테마 풀 (랜덤 셔플 대상 4개)
 * - 테마 A: '🍻 시원한 술 한 잔 생각날 때'
 * - 테마 B: '🎎 고즈넉한 전통문화 즐기기'
 * - 테마 C: '🎈 아이와 함께 신나는 나들이'
 * - 테마 D: '🎨 감각적인 영감 충전'
 */
export const REGULAR_THEMES: ThemeDefinition[] = [
  {
    id: 'regular-drinks',
    title: '🍻 시원한 술 한 잔 생각날 때',
    tagline: '달콤한 휴식',
    tags: ['#맥주', '#야시장', '#푸드페스타'],
    imageUrl: '/themes/drink.jpg',
    keywords: ['맥주', '와인', '주류', '야시장', '푸드', '먹거리', '포차', '페스타'],
    type: 'regular',
  },
  {
    id: 'regular-traditional',
    title: '🎎 고즈넉한 전통문화 즐기기',
    tagline: '시간 여행',
    tags: ['#전통문화', '#고궁', '#한복'],
    imageUrl: '/events/traditional-palace.jpg',
    keywords: ['전통', '민속', '고궁', '한복', '도자기', '역사', '문화재', '등불'],
    type: 'regular',
  },
  {
    id: 'regular-kids',
    title: '🎈 아이와 함께 신나는 나들이',
    tagline: '가족 나들이',
    tags: ['#가족체험', '#어린이', '#키즈존'],
    imageUrl: '/themes/kids.jpg',
    keywords: ['어린이', '가족', '체험', '키즈', '생태', '공룡', '비눗방울'],
    type: 'regular',
  },
  {
    id: 'regular-art',
    title: '🎨 감각적인 영감 충전',
    tagline: '취향 발견',
    tags: ['#실내데이트', '#아트', '#전시'],
    imageUrl: '/events/media-art.png',
    keywords: ['전시', '미술', '아트', '갤러리', '디자인', '미디어아트'],
    type: 'regular',
  },
]

/**
 * 현재 접속 월(KST 기준)에 따른 계절 테마 1종 반환
 */
export function getCurrentSeasonTheme(): ThemeDefinition {
  const now = new Date()
  let month = now.getMonth() + 1
  try {
    const kstMonthStr = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
    }).format(now)
    const parsed = parseInt(kstMonthStr.replace(/\D/g, ''), 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      month = parsed
    }
  } catch {
    // fallback to local month
  }

  if (month >= 3 && month <= 5) {
    return SEASON_THEMES.spring
  } else if (month >= 6 && month <= 8) {
    return SEASON_THEMES.summer
  } else if (month >= 9 && month <= 11) {
    return SEASON_THEMES.autumn
  } else {
    return SEASON_THEMES.winter
  }
}

/**
 * 상시 테마 4개 중 랜덤으로 1종 반환
 */
export function getRandomRegularTheme(excludeId?: string): ThemeDefinition {
  const candidates = excludeId
    ? REGULAR_THEMES.filter((t) => t.id !== excludeId)
    : REGULAR_THEMES
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index] || REGULAR_THEMES[0]
}

/**
 * 홈 화면 노출용 테마 2종 반환:
 * [현재 월 기준 계절 테마 1개] + [상시 테마 4개 중 랜덤 1개]
 */
export function getHomeThemes(): [ThemeDefinition, ThemeDefinition] {
  const seasonTheme = getCurrentSeasonTheme()
  const regularTheme = getRandomRegularTheme()
  return [seasonTheme, regularTheme]
}

/**
 * 테마 키워드 기반 행사 필터링 (룰 기반 고속 매핑)
 * - 제목(5점), 개요(2점), 태그(3점), 장소(1점) 매칭
 * - 매칭 결과가 적을 경우 전체 풀에서 중복 없이 보충하는 안전한 폴백 제공
 */
export function filterEventsByTheme(
  events: PoppleEvent[],
  theme: ThemeDefinition,
): PoppleEvent[] {
  if (!events || events.length === 0) return []

  const keywords = theme.keywords.map((k) => k.toLowerCase())

  const scored = events.map((event) => {
    let score = 0
    const title = (event.title || '').toLowerCase()
    const desc = (event.description || '').toLowerCase()
    const loc = (event.location || '').toLowerCase()
    const tags = (event.tags || []).join(' ').toLowerCase()

    for (const kw of keywords) {
      if (title.includes(kw)) score += 5
      if (desc.includes(kw)) score += 2
      if (tags.includes(kw)) score += 3
      if (loc.includes(kw)) score += 1
    }

    return { event, score }
  })

  // 매칭된 행사 우선 정렬
  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.event)

  // 매칭 결과가 4개 미만인 경우 전체 풀에서 보충 (안전한 폴백)
  if (matched.length < 4) {
    for (const ev of events) {
      if (matched.length >= 8) break
      if (!matched.some((m) => m.id === ev.id)) {
        matched.push(ev)
      }
    }
  }

  return matched
}
