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

const NOW = Date.now()

/**
 * 첫 진입 시 화면이 비어있지 않도록 제공하는 생생한 축제 현장 분위기의 초기 게시글
 */
export const INITIAL_POSTS: CommunityPost[] = [
  {
    id: 'mock_post_1',
    category: 'photo',
    author: '불꽃덕후',
    avatarColor: 'bg-rose-500',
    content:
      '오늘 여의도 불꽃축제 명당 자리 공유해요! 마포대교 남단 쪽 지금 돗자리 자리 아직 여유 있습니다 🎆\n\n저녁 7시부터 드론 라이트쇼 시작한다니까 강바람 대비해서 돗자리랑 핫팩, 담요 꼭 챙겨오세요!',
    imageUrl: '/events/fireworks.png',
    createdAt: NOW - 35 * 60 * 1000, // 35분 전
    likes: 38,
    likedByUser: false,
    comments: [
      {
        id: 'c_1',
        author: '팝플러12',
        content: '지금 여의나루역 내렸는데 자리 팁 감사해요!',
        createdAt: NOW - 20 * 60 * 1000,
      },
      {
        id: 'c_2',
        author: '피크닉조아',
        content: '강바람 많이 부나요? 패딩 필수일까요?',
        createdAt: NOW - 10 * 60 * 1000,
      },
    ],
  },
  {
    id: 'mock_post_2',
    category: 'talk',
    author: '성수동주민',
    avatarColor: 'bg-indigo-500',
    content:
      '라라라 페스티벌 지금 대기 줄 긴가요? 맥주존 푸드트럭 대기 시간 아시는 분 실시간 제보 부탁드립니다 ㅠㅠ 줄 길면 밖에서 먹고 들어가려구요!',
    createdAt: NOW - 2 * 60 * 60 * 1000, // 2시간 전
    likes: 15,
    likedByUser: false,
    comments: [
      {
        id: 'c_3',
        author: '맥주요정',
        content: '방금 맥주존 샀는데 10분 정도 걸렸어요! 회전율 빨라요 ㅎㅎ',
        createdAt: NOW - 50 * 60 * 1000,
      },
    ],
  },
  {
    id: 'mock_post_3',
    category: 'calendar',
    author: '단풍요정',
    avatarColor: 'bg-emerald-500',
    content:
      '이번 주말에 갈 축제 달력에 저장해뒀는데 동선 어떤가요? 낮에 선선한 가을산책 축제 갔다가 저녁에 재즈 피크닉 들를 예정입니다 🍂 억새 포토존 추천 스팟 있으시면 알려주세요!',
    imageUrl: '/events/autumn-walk.jpg',
    calendarYear: 2026,
    calendarMonth: 10,
    calendarDiaries: {
      '2026-10-04': { imageUrl: '/events/autumn-walk.jpg', memo: '하늘공원 억새축제 산책' },
      '2026-10-10': { imageUrl: '/events/fireworks.png', memo: '여의도 불꽃축제 인생샷' },
      '2026-10-18': { imageUrl: '/events/lalala.png', memo: '성수 라라라 비어 페스티벌' },
    },
    createdAt: NOW - 4 * 60 * 60 * 1000, // 4시간 전
    likes: 27,
    likedByUser: true,
    comments: [
      {
        id: 'c_4',
        author: '축제마니아',
        content: '동선 아주 좋아요! 낮 3시쯤 억새밭 햇살 들어올 때가 인생샷 스팟입니다',
        createdAt: NOW - 1 * 60 * 60 * 1000,
      },
    ],
  },
]

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
 */
export function getCommunityPosts(): CommunityPost[] {
  if (typeof window === 'undefined') return INITIAL_POSTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_POSTS))
      return INITIAL_POSTS
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_POSTS

    // 과거 저장된 데이터 중 category === 'calendar'인데 calendarDiaries가 없는 경우 보완
    const patched = parsed.map((p: CommunityPost) => {
      if (p.category === 'calendar' && (!p.calendarDiaries || Object.keys(p.calendarDiaries).length === 0)) {
        return {
          ...p,
          calendarYear: p.calendarYear ?? 2026,
          calendarMonth: p.calendarMonth ?? 10,
          calendarDiaries: {
            '2026-10-04': { imageUrl: '/events/autumn-walk.jpg', memo: '하늘공원 억새축제 산책' },
            '2026-10-10': { imageUrl: '/events/fireworks.png', memo: '여의도 불꽃축제 인생샷' },
            '2026-10-18': { imageUrl: '/events/lalala.png', memo: '성수 라라라 비어 페스티벌' },
          },
        }
      }
      return p
    })

    return patched
  } catch (err) {
    console.warn('[community] Failed to load posts from localStorage:', err)
    return INITIAL_POSTS
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
