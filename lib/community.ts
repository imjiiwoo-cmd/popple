import { getUnifiedReviews } from '@/lib/constants/reviews'

export type CommunityCategory = 'all' | 'talk' | 'photo' | 'calendar'

export interface CommunityComment {
  id: string
  author: string
  content: string
  createdAt: number // ms timestamp
}

export interface CommunityPost {
  id: string
  category: 'talk' | 'photo' | 'calendar'
  author: string
  avatarColor: string
  content: string
  imageUrl?: string // Base64 or public path
  calendarYear?: number
  calendarMonth?: number
  calendarDiaries?: Record<string, { imageUrl: string; memo?: string }>
  createdAt: number // ms timestamp
  likes: number
  likedByUser?: boolean
  comments: CommunityComment[]
  eventId?: string
  eventTitle?: string
  rating?: number
}

export const CATEGORY_TABS: { id: CommunityCategory; label: string; icon: string }[] = [
  { id: 'all', label: '전체', icon: '✨' },
  { id: 'talk', label: '실시간', icon: '🗣️' },
  { id: 'photo', label: '축제후기', icon: '📷' },
  { id: 'calendar', label: '달력공유', icon: '📅' },
]

export const CATEGORY_BADGES: Record<
  'talk' | 'photo' | 'calendar',
  { label: string; shortLabel: string; badgeClass: string }
> = {
  talk: {
    label: '🗣️ 실시간',
    shortLabel: '실시간',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  photo: {
    label: '📷 축제후기',
    shortLabel: '축제후기',
    badgeClass: 'bg-sky-50 text-[#1884F7] border-sky-200/80',
  },
  calendar: {
    label: '📅 달력공유',
    shortLabel: '달력공유',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
]

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

const STORAGE_KEY = 'popple_community_posts'

export const INITIAL_POSTS: CommunityPost[] = []

/**
 * 상대 시간 포맷터 (방금 전, N분 전, N시간 전, N일 전)
 */
export function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)

  if (diffSec < 60) {
    return '방금 전'
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin}분 전`
  }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return `${diffHour}시간 전`
  }
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) {
    return `${diffDay}일 전`
  }

  const d = new Date(timestamp)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

/**
 * localStorage에서 게시글 목록 조회
 * (통합 리뷰 데이터 소스의 후기들도 자동으로 '축제후기'(photo) 카테고리로 합성)
 */
export function getCommunityPosts(): CommunityPost[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let parsed: CommunityPost[] = []
    if (raw) {
      const json = JSON.parse(raw)
      if (Array.isArray(json)) {
        parsed = json.filter(
          (p: CommunityPost) => p && !p.id?.startsWith('mock_post_'),
        )
      }
    }

    // 통합 리뷰 저장소의 리뷰들도 커뮤니티 피드(photo 카테고리)에 포함
    const unifiedReviews = getUnifiedReviews()
    const existingPostIds = new Set(parsed.map((p) => p.id))

    const convertedReviewPosts: CommunityPost[] = []
    for (const rev of unifiedReviews) {
      const targetPostId = `post_${rev.id}`
      if (!existingPostIds.has(targetPostId) && !existingPostIds.has(rev.id)) {
        convertedReviewPosts.push({
          id: targetPostId,
          category: 'photo',
          author: rev.author,
          avatarColor: rev.avatarColor || 'bg-[#1884F7]',
          content: `#[${rev.eventTitle}]\n★ ${rev.rating.toFixed(1)}점\n${rev.content}`,
          imageUrl: rev.imageUrl,
          createdAt: rev.timestamp || Date.now(),
          likes: rev.likes,
          likedByUser: rev.likedByUser,
          eventId: rev.eventId,
          eventTitle: rev.eventTitle,
          rating: rev.rating,
          comments: [
            {
              id: `c_auto_${rev.id}`,
              author: '팝플봇',
              content: `${rev.author}님의 생생한 ${rev.eventTitle} 방문 후기 감사합니다! 🎉`,
              createdAt: rev.timestamp || Date.now(),
            },
          ],
        })
      }
    }

    const all = [...parsed, ...convertedReviewPosts]
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all
  } catch (err) {
    console.warn('[community] Failed to load posts from localStorage:', err)
    return []
  }
}

/**
 * localStorage에 게시글 목록 저장
 */
export function saveCommunityPosts(posts: CommunityPost[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
  } catch (err) {
    console.warn('[community] Failed to save posts to localStorage:', err)
  }
}

/**
 * 이미지 파일을 localStorage 용량 한도 내에 안전하게 저장할 수 있도록 Canvas 기반으로 압축/리사이즈 (Base64 반환)
 */
export function compressImageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 900
        const maxHeight = 900
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(event.target?.result as string)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        // JPEG 0.75 품질로 압축
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75)
        resolve(compressedBase64)
      }
      img.onerror = () => reject(new Error('이미지를 읽는 중 오류가 발생했습니다.'))
      img.src = event.target?.result as string
    }
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'))
    reader.readAsDataURL(file)
  })
}
