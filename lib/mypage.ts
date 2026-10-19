import type { PoppleEvent } from './events'
import { MOCK_EVENTS } from './events'

export interface UserProfile {
  nickname: string
  avatarUrl: string
  avatarType: 'character' | 'custom'
  bio?: string
  email?: string
  userId?: string
}

export interface DefaultAvatarItem {
  id: string
  name: string
  imageUrl: string
  bgColor: string
}

export const DEFAULT_AVATARS: DefaultAvatarItem[] = [
  { id: 'cat', name: '치즈냥이', imageUrl: '/avatars/cat.png', bgColor: 'bg-[#EBDDFF]' },
  { id: 'rabbit', name: '달토끼', imageUrl: '/avatars/rabbit.png', bgColor: 'bg-[#D6EEFF]' },
  { id: 'bear', name: '곰돌이', imageUrl: '/avatars/bear.png', bgColor: 'bg-[#FFE2D1]' },
  { id: 'dog', name: '댕댕이', imageUrl: '/avatars/dog.png', bgColor: 'bg-[#D6F5E8]' },
  { id: 'frog', name: '개구리', imageUrl: '/avatars/frog.png', bgColor: 'bg-[#FFDDEB]' },
]

const USER_PROFILE_KEY = 'user_profile'
const PHOTO_DIARY_KEY = 'popple_photo_diaries'
const BOOKMARKS_KEY = 'popple_bookmarks_list'

export const INITIAL_USER_PROFILE: UserProfile = {
  nickname: '팝플러',
  avatarUrl: '/avatars/cat.png',
  avatarType: 'character',
  bio: '축제와 팝업스토어를 사랑하는 프로 나들이러 ✨',
}

/**
 * 사용자 프로필 로드
 */
export function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') return INITIAL_USER_PROFILE
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY)
    if (!raw) {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(INITIAL_USER_PROFILE))
      return INITIAL_USER_PROFILE
    }
    const parsed = JSON.parse(raw)
    return {
      nickname: parsed.nickname || '팝플러',
      avatarUrl: parsed.avatarUrl || '/avatars/cat.png',
      avatarType: parsed.avatarType || 'character',
      bio: parsed.bio || INITIAL_USER_PROFILE.bio,
      email: parsed.email,
      userId: parsed.userId,
    }
  } catch {
    return INITIAL_USER_PROFILE
  }
}

/**
 * 사용자 프로필 저장
 */
export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile))
  } catch (err) {
    console.warn('[mypage] Failed to save user profile:', err)
  }
}

export interface PhotoDiaryEntry {
  dateKey: string // 'YYYY-MM-DD'
  imageUrl: string // Base64 or image path
  memo: string
  festivalTitle?: string
  createdAt: number
}

// 2026년 10월 기본 데모 다이어리 (첫 진입 시 포토 캘린더 효과 확인용)
const INITIAL_PHOTO_DIARIES: Record<string, PhotoDiaryEntry> = {
  '2026-10-03': {
    dateKey: '2026-10-03',
    imageUrl: '/events/autumn-walk.jpg',
    memo: '하늘공원 억새 축제 산책로 인생샷 건짐 🌾',
    festivalTitle: '가을 억새 축제',
    createdAt: new Date('2026-10-03T15:00:00').getTime(),
  },
  '2026-10-10': {
    dateKey: '2026-10-10',
    imageUrl: '/events/fireworks.png',
    memo: '여의도 불꽃축제 한강 돗자리 명당 성공! 🎆',
    festivalTitle: '서울세계불꽃축제',
    createdAt: new Date('2026-10-10T20:00:00').getTime(),
  },
}

/**
 * 포토 캘린더 다이어리 목록 로드
 */
export function getPhotoDiaries(): Record<string, PhotoDiaryEntry> {
  if (typeof window === 'undefined') return INITIAL_PHOTO_DIARIES
  try {
    const raw = localStorage.getItem(PHOTO_DIARY_KEY)
    if (!raw) {
      localStorage.setItem(PHOTO_DIARY_KEY, JSON.stringify(INITIAL_PHOTO_DIARIES))
      return INITIAL_PHOTO_DIARIES
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : INITIAL_PHOTO_DIARIES
  } catch {
    return INITIAL_PHOTO_DIARIES
  }
}

/**
 * 포토 캘린더 다이어리 저장
 */
export function savePhotoDiary(entry: PhotoDiaryEntry): Record<string, PhotoDiaryEntry> {
  const current = getPhotoDiaries()
  const updated = {
    ...current,
    [entry.dateKey]: entry,
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PHOTO_DIARY_KEY, JSON.stringify(updated))
    } catch (err) {
      console.warn('[mypage] Failed to save photo diary:', err)
    }
  }
  return updated
}

/**
 * 포토 캘린더 다이어리 삭제
 */
export function deletePhotoDiary(dateKey: string): Record<string, PhotoDiaryEntry> {
  const current = getPhotoDiaries()
  const updated = { ...current }
  delete updated[dateKey]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PHOTO_DIARY_KEY, JSON.stringify(updated))
    } catch (err) {
      console.warn('[mypage] Failed to delete photo diary:', err)
    }
  }
  return updated
}

/**
 * 찜한 축제 (북마크) 목록 조회
 */
export function getBookmarkedEvents(candidatePool: PoppleEvent[] = []): PoppleEvent[] {
  if (typeof window === 'undefined') return []
  try {
    // 1. 개별 북마크 키 스캔 (캘린더 화면 호환)
    const bookmarkedIds = new Set<string>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('popple_bookmark_')) {
        const val = localStorage.getItem(key)
        if (val === 'true') {
          bookmarkedIds.add(key.replace('popple_bookmark_', ''))
        }
      }
    }

    // 2. 리스트 키 스캔
    const rawList = localStorage.getItem(BOOKMARKS_KEY)
    if (rawList) {
      try {
        const parsed = JSON.parse(rawList)
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => bookmarkedIds.add(id))
        }
      } catch {
        // 무시
      }
    }

    if (bookmarkedIds.size === 0) {
      return []
    }

    const pool = candidatePool.length > 0 ? candidatePool : MOCK_EVENTS
    return pool.filter((ev) => bookmarkedIds.has(ev.id))
  } catch {
    return []
  }
}
