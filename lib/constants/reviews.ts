/**
 * 실시간 방문 후기 포토 피드 데이터 모델 및 공통 단일 저장소 (Unified Review Store)
 * 홈 화면('팝플러의 생생 방문기'), 행사 상세페이지(/events/[id]), 커뮤니티(/community) 세 곳의
 * 후기 데이터를 단일 데이터 소스로 완전 동기화합니다.
 */

import { supabase } from '@/lib/supabaseClient'

export interface Review {
  id: string
  eventId: string
  eventTitle: string
  author: string
  avatar: string
  avatarColor?: string
  rating: number // 1.0 ~ 5.0
  content: string
  imageUrl?: string
  likes: number
  commentsCount: number
  createdAt: string // e.g. "방금 전", "23분 전"
  timestamp: number // unix epoch ms
  tag?: string
  likedByUser?: boolean
}

/**
 * 6대 대표 팝업 & 축제 현장 Seed 후기 데이터 (디올 성수, 경복궁, 잔망루피, 수원화성, 탬버린즈, 하늘공원)
 * 실제 대응하는 행사 ID(eventId) 및 타이틀 100% 매칭
 */
export const REAL_REVIEWS_SEED: Review[] = [
  {
    id: 'rev_01',
    eventId: 'popup_preset_01',
    eventTitle: '디올 성수 2026 어텀/윈터 가든 아카이브 팝업',
    author: '성수동산책러',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-rose-500',
    tag: '#성수팝업',
    rating: 5.0,
    content: '주말 현장 예약 팁 공유해요! 11시 오픈런 추천합니다 📸 정원 포토존 채광이 환상적이에요.',
    imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=600&q=80',
    likes: 142,
    commentsCount: 23,
    createdAt: '방금 전',
    timestamp: 1730000000000 - 1000 * 60 * 5,
  },
  {
    id: 'rev_02',
    eventId: 'fest_preset_01',
    eventTitle: '경복궁 가을 야간특별관람',
    author: '달빛나들이',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-amber-500',
    tag: '#경복궁야경',
    rating: 4.9,
    content: '근정전과 경회루 달빛 조명이 예술입니다. 한복 입고 방문하면 현장 무료입장 꿀팁!',
    imageUrl: 'https://images.unsplash.com/photo-1548115184-bc6544d06a58?auto=format&fit=crop&w=600&q=80',
    likes: 98,
    commentsCount: 17,
    createdAt: '23분 전',
    timestamp: 1730000000000 - 1000 * 60 * 23,
  },
  {
    id: 'rev_03',
    eventId: 'popup_preset_03',
    eventTitle: '잔망루피의 마법 연구소 할로윈 스페셜 팝업',
    author: '루피덕후',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-pink-500',
    tag: '#성수팝업',
    rating: 4.8,
    content: '대기 30분 만에 입장 성공! 마녀 모자 쓴 한정판 봉제인형 실물이 너무 귀여워요 ㅠㅠ',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
    likes: 115,
    commentsCount: 31,
    createdAt: '1시간 전',
    timestamp: 1730000000000 - 1000 * 60 * 60,
  },
  {
    id: 'rev_04',
    eventId: 'fest_preset_06',
    eventTitle: '수원화성 미디어아트 & 가을 문화제',
    author: '수원시민김씨',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-blue-500',
    tag: '#수원야시장',
    rating: 5.0,
    content: '성벽에 쏘는 초대형 레이저 쇼 스케일 미쳤어요! 선선한 가을밤 산책 데이트 코스로 최고.',
    imageUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
    likes: 87,
    commentsCount: 14,
    createdAt: '2시간 전',
    timestamp: 1730000000000 - 1000 * 60 * 120,
  },
  {
    id: 'rev_05',
    eventId: 'popup_preset_04',
    eventTitle: "탬버린즈 '이브닝 글로우' 퍼퓸 아카이브 팝업",
    author: '향수컬렉터',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-purple-500',
    tag: '#성수핫플',
    rating: 4.7,
    content: '신상 향수 시향존 장미향 가득해서 힐링 그 자체.. 조각상 오브제 포토존 맛집 인정합니다.',
    imageUrl: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=600&q=80',
    likes: 76,
    commentsCount: 9,
    createdAt: '3시간 전',
    timestamp: 1730000000000 - 1000 * 60 * 180,
  },
  {
    id: 'rev_06',
    eventId: 'fest_preset_04',
    eventTitle: '서울 하늘공원 은빛 억새 페스티벌',
    author: '억새소풍러',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    avatarColor: 'bg-emerald-500',
    tag: '#하늘공원',
    rating: 4.9,
    content: '노을 질 때 억새밭 인생샷 건졌어요! 맹꽁이차 줄 길어서 걸어 올라갔는데 산책로 예뻐요.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    likes: 134,
    commentsCount: 28,
    createdAt: '5시간 전',
    timestamp: 1730000000000 - 1000 * 60 * 300,
  },
]

export const UNIFIED_REVIEWS_STORAGE_KEY = 'popple_unified_reviews'
export const POPPLE_REVIEWS_UPDATED_EVENT = 'popple_reviews_updated'

/**
 * 단일 공통 저장소에서 전체 리뷰 목록 조회
 * (Seed 데이터와 사용자가 작성한 새 리뷰를 통합하여 최신순 정렬)
 */
export function getUnifiedReviews(): Review[] {
  if (typeof window === 'undefined') return REAL_REVIEWS_SEED

  try {
    const raw = localStorage.getItem(UNIFIED_REVIEWS_STORAGE_KEY)
    let stored: Review[] = []
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        stored = parsed
      }
    }

    const map = new Map<string, Review>()
    // 1. 기본 Seed 후기 추가
    for (const seed of REAL_REVIEWS_SEED) {
      map.set(seed.id, seed)
    }
    // 2. 저장소의 후기(수정, 좋아요, 신규 작성)로 덮어쓰기
    for (const item of stored) {
      if (item && item.id) {
        map.set(item.id, item)
      }
    }

    const merged = Array.from(map.values())
    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return merged
  } catch (err) {
    console.warn('[reviews] getUnifiedReviews error:', err)
    return REAL_REVIEWS_SEED
  }
}

/**
 * 특정 행사의 eventId 또는 행사 제목과 일치하는 후기 목록 필터링
 * 예: 디올 성수 상세페이지 접속 시 '성수동산책러'의 5.0 별점 후기가 반환됨
 */
export function getReviewsForEvent(eventId: string, eventTitle?: string): Review[] {
  const allReviews = getUnifiedReviews()
  const normalizedTitle = (eventTitle || '').trim().toLowerCase()

  return allReviews.filter((r) => {
    // 1. eventId 직접 일치
    if (r.eventId && eventId && (r.eventId === eventId || r.eventId.includes(eventId) || eventId.includes(r.eventId))) {
      return true
    }

    // 2. 행사 제목 키워드 일치
    if (normalizedTitle && r.eventTitle) {
      const rTitle = r.eventTitle.trim().toLowerCase()
      if (rTitle.includes(normalizedTitle) || normalizedTitle.includes(rTitle)) {
        return true
      }
      // 대표 축제/팝업 명칭 매칭
      const keywords = ['디올', '경복궁', '잔망루피', '루피', '수원화성', '탬버린즈', '하늘공원', '억새']
      for (const kw of keywords) {
        if (normalizedTitle.includes(kw) && rTitle.includes(kw)) {
          return true
        }
      }
    }

    return false
  })
}

export interface AddReviewInput {
  eventId: string
  eventTitle: string
  author: string
  avatar?: string
  avatarColor?: string
  rating: number
  content: string
  imageUrl?: string
  tag?: string
}

/**
 * 신규 후기 등록 시 [상세페이지 후기], [커뮤니티 피드], [홈 화면 생생 방문기] 3곳 전역 즉시 반영
 */
export function addUnifiedReview(input: AddReviewInput): Review {
  const allReviews = getUnifiedReviews()
  const now = Date.now()

  const newReview: Review = {
    id: `rev_${now}_${Math.random().toString(36).substring(2, 6)}`,
    eventId: input.eventId,
    eventTitle: input.eventTitle,
    author: input.author.trim() || '익명팝플',
    avatar: input.avatar || '/avatars/cat.png',
    avatarColor: input.avatarColor || 'bg-[#1884F7]',
    rating: input.rating,
    content: input.content.trim(),
    imageUrl: input.imageUrl,
    tag: input.tag || (input.eventTitle.includes('팝업') ? '#성수팝업' : '#축제후기'),
    likes: 0,
    commentsCount: 1,
    createdAt: '방금 전',
    timestamp: now,
    likedByUser: false,
  }

  // 1. 통합 리뷰 저장소에 저장
  const updatedReviews = [newReview, ...allReviews]
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(UNIFIED_REVIEWS_STORAGE_KEY, JSON.stringify(updatedReviews))
    } catch (e) {
      console.warn('[reviews] localStorage write failed:', e)
    }

    // 2. 커뮤니티 피드(popple_community_posts)에도 '축제후기'(photo) 카테고리로 실시간 동기화
    try {
      const rawPosts = localStorage.getItem('popple_community_posts')
      const communityPosts = rawPosts ? JSON.parse(rawPosts) : []
      const newCommunityPost = {
        id: `post_${newReview.id}`,
        category: 'photo',
        author: newReview.author,
        avatarColor: newReview.avatarColor || 'bg-[#1884F7]',
        content: `#[${newReview.eventTitle}]\n★ ${newReview.rating.toFixed(1)}점\n${newReview.content}`,
        imageUrl: newReview.imageUrl,
        createdAt: now,
        likes: 0,
        likedByUser: false,
        eventId: newReview.eventId,
        eventTitle: newReview.eventTitle,
        rating: newReview.rating,
        comments: [
          {
            id: `c_auto_${now}`,
            author: '팝플봇',
            content: `${newReview.author}님의 생생한 ${newReview.eventTitle} 방문 후기 감사합니다! 🎉`,
            createdAt: now,
          },
        ],
      }
      localStorage.setItem(
        'popple_community_posts',
        JSON.stringify([newCommunityPost, ...(Array.isArray(communityPosts) ? communityPosts : [])]),
      )
    } catch (e) {
      console.warn('[reviews] community post sync failed:', e)
    }

    // 3. 전역 실시간 브로드캐스트 이벤트 발송 (HomeScreen, EventDetail, CommunityScreen 즉시 동기화)
    window.dispatchEvent(
      new CustomEvent(POPPLE_REVIEWS_UPDATED_EVENT, { detail: newReview }),
    )
  }

  // 4. Supabase DB reviews 테이블 비동기 추가 시도 (테이블 존재 시 자동 기록)
  try {
    Promise.resolve(
      supabase
        .from('reviews')
        .insert({
          id: newReview.id,
          event_id: newReview.eventId,
          event_title: newReview.eventTitle,
          author: newReview.author,
          rating: newReview.rating,
          content: newReview.content,
          image_url: newReview.imageUrl,
          created_at: new Date(now).toISOString(),
        }),
    )
      .then((res: any) => {
        if (res?.error) {
          // Schema 미구성 시 안전하게 폴백
        }
      })
      .catch(() => {})
  } catch {
    // ignore
  }

  return newReview
}

/**
 * 후기 좋아요 토글 및 전역 동기화
 */
export function toggleLikeUnifiedReview(reviewId: string): { likes: number; likedByUser: boolean } {
  const allReviews = getUnifiedReviews()
  let targetLikes = 0
  let targetLiked = false

  const updated = allReviews.map((r) => {
    if (r.id === reviewId) {
      const nextLiked = !r.likedByUser
      const nextLikes = nextLiked ? (r.likes || 0) + 1 : Math.max(0, (r.likes || 1) - 1)
      targetLikes = nextLikes
      targetLiked = nextLiked
      return {
        ...r,
        likedByUser: nextLiked,
        likes: nextLikes,
      }
    }
    return r
  })

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(UNIFIED_REVIEWS_STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(
        new CustomEvent(POPPLE_REVIEWS_UPDATED_EVENT, {
          detail: { id: reviewId, likes: targetLikes, likedByUser: targetLiked },
        }),
      )
    } catch {
      // ignore
    }
  }

  return { likes: targetLikes, likedByUser: targetLiked }
}

/**
 * 후기 데이터 변경 구독 리스너
 */
export function subscribeToReviews(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    callback()
  }

  window.addEventListener(POPPLE_REVIEWS_UPDATED_EVENT, handler)
  window.addEventListener('storage', (e) => {
    if (e.key === UNIFIED_REVIEWS_STORAGE_KEY || e.key === 'popple_community_posts') {
      handler()
    }
  })

  return () => {
    window.removeEventListener(POPPLE_REVIEWS_UPDATED_EVENT, handler)
  }
}
