'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  Share2,
  Star,
  Calendar,
  Clock,
  CircleDollarSign,
  MapPin,
  ExternalLink,
  Check,
  Send,
  Sparkles,
  Info,
  ChevronRight,
  Camera,
  X,
} from 'lucide-react'
import type { PoppleEvent } from '@/lib/events'
import { getUserProfile } from '@/lib/mypage'
import { supabase } from '@/lib/supabaseClient'
import {
  getCommunityPosts,
  saveCommunityPosts,
  compressImageFileToBase64,
  type CommunityPost,
} from '@/lib/community'

interface EventDetailProps {
  event: PoppleEvent
  onBack: () => void
}

interface ReviewItem {
  id: string
  nickname: string
  date: string
  rating: number
  content: string
  imageUrl?: string
}



export function EventDetail({ event, onBack }: EventDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 상세정보 화면 열릴 때 스크롤 항상 최상단(top: 0)으로 초기화
  useEffect(() => {
    // 1) 브라우저 전체 스크롤 리셋
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // 2) 내부 스크롤 컨테이너(ref) scrollTop 리셋
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }

    // 렌더링 프레임 지연으로 인한 스크롤 복원 방지
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [event.id])

  // 리뷰 및 방명록 상태
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [newNickname, setNewNickname] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newRating, setNewRating] = useState(5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 리뷰 사진 첨부 상태
  const [reviewImageBase64, setReviewImageBase64] = useState<string | null>(null)
  const [isCompressingImage, setIsCompressingImage] = useState(false)
  const reviewFileInputRef = useRef<HTMLInputElement | null>(null)

  const reviewStorageKey = `popple_reviews_${event.id}`
  const bookmarkStorageKey = `popple_bookmark_${event.id}`

  // 닉네임 기본값으로 사용자 프로필 및 Supabase 로그인 세션 닉네임 로드
  useEffect(() => {
    const profile = getUserProfile()
    if (profile && profile.nickname) {
      setNewNickname(profile.nickname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const metaNickname = session?.user?.user_metadata?.nickname
      if (metaNickname) {
        setNewNickname(metaNickname)
      }
    })
  }, [])

  // 리뷰 사진 첨부 핸들러
  const handleReviewPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsCompressingImage(true)
    try {
      const base64 = await compressImageFileToBase64(file)
      setReviewImageBase64(base64)
    } catch {
      showToast('이미지 처리 중 문제가 발생했습니다.')
    } finally {
      setIsCompressingImage(false)
      if (reviewFileInputRef.current) reviewFileInputRef.current.value = ''
    }
  }

  // Toast 안내 메시지 타이머
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 2500)
  }

  // localStorage에서 북마크 및 후기 불러오기
  useEffect(() => {
    try {
      const savedBookmark = localStorage.getItem(bookmarkStorageKey)
      if (savedBookmark === 'true') {
        setIsBookmarked(true)
      }

      const storedReviews = localStorage.getItem(reviewStorageKey)
      if (storedReviews) {
        const parsed = JSON.parse(storedReviews)
        if (Array.isArray(parsed)) {
          // 'default-' 로 시작하는 이전 가짜 목업 후기 자동 필터링
          const realReviews = parsed.filter((r: ReviewItem) => r && !r.id?.startsWith('default-'))
          setReviews(realReviews)
          return
        }
      }
      setReviews([])
    } catch {
      setReviews([])
    }
  }, [bookmarkStorageKey, reviewStorageKey])

  // 북마크 토글
  const handleToggleBookmark = () => {
    const nextState = !isBookmarked
    setIsBookmarked(nextState)
    try {
      localStorage.setItem(bookmarkStorageKey, String(nextState))
      showToast(nextState ? '북마크에 저장되었습니다 ⭐' : '북마크가 해제되었습니다.')
    } catch {
      // localStorage 불가 시 무시
    }
  }

  // 공유 버튼 클릭
  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: `[팝플] ${event.title} - ${event.location}`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${event.title}\n${event.location}\n${window.location.href}`)
        showToast('행사 정보 링크가 복사되었어요! 📋')
      }
    } catch {
      // 사용자 취소 시 무시
    }
  }

  // 후기 등록 제출 (요건 1: 축제 상세페이지 후기 -> 커뮤니티 '축제후기' 실시간 자동 연동)
  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNickname.trim()) {
      showToast('닉네임을 입력해주세요!')
      return
    }
    if (!newContent.trim()) {
      showToast('한 줄 후기를 작성해주세요!')
      return
    }

    setIsSubmitting(true)
    const today = new Date()
    const formattedDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')} 방문`

    const newReviewItem: ReviewItem = {
      id: `review-${Date.now()}`,
      nickname: newNickname.trim(),
      date: formattedDate,
      rating: newRating,
      content: newContent.trim(),
      imageUrl: reviewImageBase64 || undefined,
    }

    const updated = [newReviewItem, ...reviews]
    setReviews(updated)

    try {
      localStorage.setItem(reviewStorageKey, JSON.stringify(updated))
    } catch {
      // localStorage 예외 방어
    }

    // [1] 커뮤니티 피드에도 '축제후기'(photo) 카테고리로 실시간 자동 추가
    const userProfile = getUserProfile()
    const author = newNickname.trim() || userProfile.nickname || '익명팝플'
    const postImageUrl = reviewImageBase64 || event.imageUrl || event.poster || undefined

    const communityPost: CommunityPost = {
      id: `post_review_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: 'photo', // 커뮤니티 '축제후기'
      author,
      avatarColor: userProfile.avatarUrl.includes('bear')
        ? 'bg-amber-600'
        : userProfile.avatarUrl.includes('rabbit')
        ? 'bg-rose-400'
        : userProfile.avatarUrl.includes('cat')
        ? 'bg-amber-400'
        : userProfile.avatarUrl.includes('dog')
        ? 'bg-orange-500'
        : userProfile.avatarUrl.includes('frog')
        ? 'bg-emerald-500'
        : 'bg-[#1884F7]',
      content: `#[${event.title}]\n★ ${newRating}점\n${newContent.trim()}`,
      imageUrl: postImageUrl,
      createdAt: Date.now(),
      likes: 0,
      likedByUser: false,
      comments: [
        {
          id: `c_auto_${Date.now()}`,
          author: '팝플봇',
          content: `${author}님의 생생한 ${event.title} 방문 후기 감사합니다! 🎉`,
          createdAt: Date.now(),
        },
      ],
    }

    const currentPosts = getCommunityPosts()
    saveCommunityPosts([communityPost, ...currentPosts])

    setNewContent('')
    setReviewImageBase64(null)
    setNewRating(5)
    setIsSubmitting(false)
    showToast('방문 후기가 등록되고 커뮤니티(축제후기) 피드에도 실시간 공유되었어요! ✨')
  }

  // 네이버지도 길찾기 URL (행사 주소 또는 장소명 기준)
  const mapSearchTarget = event.location || event.title
  const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(mapSearchTarget)}`

  // 공식 웹사이트 또는 네이버 행사 검색 결과 URL
  const officialUrl =
    event.websiteUrl ||
    `https://search.naver.com/search.naver?query=${encodeURIComponent(event.title)}`

  // 장소명 정제 (주소 앞 2단어 또는 타이틀 기반)
  const placeName = event.title.length > 15 ? event.title.slice(0, 15) + '...' : event.title
  const categoryBadge = event.category || (event.tags && event.tags[0]) || '축제'
  const imageSrc = event.imageUrl || event.poster || ''

  // 무드 태그 목록 (없을 경우 기본 태그 제공)
  const displayTags =
    event.tags && event.tags.length > 0
      ? event.tags.map((t) => (t.startsWith('#') ? t : `#${t}`))
      : ['#야간축제', '#데이트', '#사진명소']

  // 시안의 한 줄 소개글
  const descriptionText =
    event.description ||
    '가을밤을 환하게 밝히는 빛과 음악의 축제예요. 산책하듯 즐기는 전시부터 특별 공연까지 다채로운 프로그램을 만나보세요.'

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col min-h-full bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300"
    >
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* 1번 상단: 네비게이션 헤더 */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          aria-label="이전 화면으로 돌아가기"
          className="-ml-1 flex size-10 items-center justify-center rounded-full text-slate-800 transition-colors hover:bg-slate-100 active:scale-95"
        >
          <ChevronLeft className="size-6" />
        </button>

        <h1 className="text-base font-bold text-slate-900 tracking-tight">행사 상세</h1>

        <button
          type="button"
          onClick={handleShare}
          aria-label="행사 정보 공유하기"
          className="-mr-1 flex size-10 items-center justify-center rounded-full text-slate-800 transition-colors hover:bg-slate-100 active:scale-95"
        >
          <Share2 className="size-5" />
        </button>
      </header>

      {/* 메인 스크롤 콘텐츠 영역 (하단 고정 버튼 높이만큼 충분한 여백 확보) */}
      <div className="flex-1 pb-32">
        {/* 1번 상단: 대표 포스터 이미지 */}
        <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
          {imageFailed || !imageSrc ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
              <Sparkles className="size-8 text-sky-400" />
              <span className="text-xs font-medium">행사 대표 이미지</span>
            </div>
          ) : (
            <Image
              src={imageSrc}
              alt={`${event.title} 대표 이미지`}
              fill
              unoptimized
              onError={() => setImageFailed(true)}
              className="object-cover object-center"
              priority
            />
          )}

          {/* 좌측 하단 카테고리 칩 (팝업/축제 등) */}
          <div className="absolute bottom-3 left-4 z-10">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold text-white bg-[#1884F7] shadow-sm tracking-tight">
              {categoryBadge}
            </span>
          </div>

          {/* 우측 하단 북마크(별) 버튼 */}
          <button
            type="button"
            onClick={handleToggleBookmark}
            aria-label={isBookmarked ? '북마크 해제' : '북마크에 저장'}
            className="absolute bottom-3 right-4 z-10 size-11 rounded-full bg-white shadow-md shadow-black/15 flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
          >
            <Star
              className={`size-5 transition-colors ${
                isBookmarked
                  ? 'fill-amber-400 text-amber-400 scale-110 animate-in zoom-in-50'
                  : 'text-slate-400 stroke-[1.8]'
              }`}
            />
          </button>
        </div>

        {/* 1번 본문: 타이틀, 소개글, 해시태그 칩들 */}
        <div className="px-5 pt-5">
          <span className="text-[11px] font-black tracking-widest text-[#1884F7] uppercase mb-1.5 block">
            LOCAL FESTIVAL
          </span>

          <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight break-keep">
            {event.title}
          </h2>

          <p className="mt-2.5 text-sm text-slate-600 leading-relaxed break-keep">
            {descriptionText}
          </p>

          {/* 무드 해시태그 칩들 */}
          <div className="flex flex-wrap gap-2 mt-4">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E8F3FF] text-[#1884F7] transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* 구분선 */}
        <hr className="my-6 border-slate-100" />

        {/* 2번: 행사 정보 (LIVE 대기 박스는 제외) */}
        <section aria-labelledby="section-event-info" className="px-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-9 rounded-xl bg-[#E8F3FF] flex items-center justify-center text-[#1884F7]">
              <Calendar className="size-5" />
            </div>
            <h3 id="section-event-info" className="text-lg font-bold text-slate-900 tracking-tight">
              행사 정보
            </h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start">
              <span className="w-20 shrink-0 text-slate-400 font-medium">기간</span>
              <span className="font-bold text-slate-800 break-keep">{event.date}</span>
            </div>

            <div className="flex items-start">
              <span className="w-20 shrink-0 text-slate-400 font-medium">운영시간</span>
              <span className="font-bold text-slate-800 break-keep">
                {event.operatingHours || '매일 18:00 — 22:00'}
              </span>
            </div>

            <div className="flex items-start">
              <span className="w-20 shrink-0 text-slate-400 font-medium">입장료</span>
              <span className="font-bold text-slate-800">{event.price || '무료'}</span>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <hr className="my-6 border-slate-100" />

        {/* 3번: 위치 안내 섹션 (네이버지도 길찾기 연동) */}
        <section aria-labelledby="section-location" className="px-5">
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="size-9 rounded-xl bg-[#E8F3FF] flex items-center justify-center text-[#1884F7]">
              <MapPin className="size-5" />
            </div>
            <h3 id="section-location" className="text-lg font-bold text-slate-900 tracking-tight">
              위치 안내
            </h3>
          </div>

          {/* 피그마 시안 스타일 지도 프리뷰 카드 */}
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
            {/* 상단 지도 그래픽 영역 */}
            <div className="relative h-36 w-full bg-[#EBF5FA] overflow-hidden flex items-center justify-center">
              {/* 대각선 도로 그래픽 */}
              <div className="absolute inset-0">
                <div className="absolute w-[240%] h-8 bg-[#DFEBF2] -rotate-35 top-14 -left-20" />
                <div className="absolute w-[240%] h-6 bg-[#DFEBF2] rotate-35 top-16 -left-20" />
                {/* 부드러운 공원 녹지 오발 */}
                <div className="absolute top-3 left-6 w-24 h-14 rounded-full bg-[#D6EEDF] opacity-90" />
                <div className="absolute bottom-3 right-6 w-28 h-16 rounded-full bg-[#D6EEDF] opacity-90" />
              </div>

              {/* 중앙 위치 핀 마커 (펄스 효과) */}
              <div className="relative z-10 flex items-center justify-center">
                <div className="absolute size-14 rounded-full bg-sky-400/25 animate-ping opacity-75" />
                <div className="relative size-10 rounded-full bg-[#1884F7] text-white flex items-center justify-center shadow-md">
                  <MapPin className="size-5 fill-white stroke-[#1884F7]" />
                </div>
              </div>
            </div>

            {/* 하단 장소명, 주소 및 길찾기 버튼 */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm leading-snug break-keep">
                  {placeName}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 leading-normal">
                  {event.location}
                </p>
              </div>

              {/* 네이버지도 길찾기 버튼 */}
              <a
                href={naverMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#E8F3FF] hover:bg-[#D5E9FF] text-[#1884F7] font-bold text-xs transition-colors active:scale-95"
              >
                길찾기
              </a>
            </div>
          </div>
        </section>

        {/* 구분선 */}
        <hr className="my-6 border-slate-100" />

        {/* 4번: 방문 후기 섹션 (간이 방명록) */}
        <section aria-labelledby="section-reviews" className="px-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-[#E8F3FF] flex items-center justify-center text-[#1884F7]">
                <Star className="size-5" />
              </div>
              <h3 id="section-reviews" className="text-lg font-bold text-slate-900 tracking-tight">
                방문 후기
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-0.5">
              전체 {reviews.length}개
              <ChevronRight className="size-3.5 text-slate-300" />
            </span>
          </div>

          {/* 간이 방명록 작성 폼 */}
          <form
            onSubmit={handleAddReview}
            className="mb-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/70 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">후기 남기기</span>
              {/* 별점 선택기: 클릭 인터랙션 & 호버 미리보기 & 실시간 점수 반영 */}
              <div
                className="flex items-center gap-0.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200/80 shadow-2xs"
                onMouseLeave={() => setHoverRating(null)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoverRating !== null ? hoverRating : newRating)
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-label={`별점 ${star}점`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setNewRating(star)
                      }}
                      onMouseEnter={() => setHoverRating(star)}
                      className="p-1 rounded-md text-slate-300 hover:text-amber-400 transition-transform active:scale-125 cursor-pointer focus:outline-none"
                    >
                      <Star
                        className={`size-5 transition-colors ${
                          isFilled
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-100 text-slate-300'
                        }`}
                      />
                    </button>
                  )
                })}
                <span className="text-sm font-black text-amber-500 ml-1.5 min-w-[28px] text-right tabular-nums">
                  {newRating}.0
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="닉네임 (예: 팝플러)"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                maxLength={15}
                className="w-1/3 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1884F7]"
              />
              <input
                type="text"
                placeholder="방문 꿀팁이나 한 줄 후기를 남겨주세요!"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                maxLength={100}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1884F7]"
              />
              <input
                type="file"
                accept="image/*"
                ref={reviewFileInputRef}
                onChange={handleReviewPhotoChange}
                className="hidden"
                id="review-image-input"
              />
              <button
                type="button"
                onClick={() => reviewFileInputRef.current?.click()}
                disabled={isCompressingImage}
                className={`shrink-0 p-2 rounded-xl border flex items-center justify-center transition-colors ${
                  reviewImageBase64
                    ? 'bg-sky-50 text-[#1884F7] border-sky-300 ring-2 ring-sky-200/50'
                    : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
                }`}
                title="후기 사진 첨부"
                aria-label="후기 사진 첨부"
              >
                <Camera className="size-4" />
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressingImage}
                className="shrink-0 px-3 py-2 bg-[#1884F7] hover:bg-[#0F75E8] active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-transform flex items-center justify-center gap-1"
              >
                <Send className="size-3" />
                등록
              </button>
            </div>

            {/* 사진 첨부 미리보기 */}
            {reviewImageBase64 && (
              <div className="flex items-center gap-2 pt-0.5">
                <div className="relative size-14 rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                  <Image
                    src={reviewImageBase64}
                    alt="첨부 사진 미리보기"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setReviewImageBase64(null)}
                    className="absolute top-1 right-1 size-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    aria-label="사진 삭제"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  사진이 첨부되었습니다 (커뮤니티 피드에 함께 공유)
                </span>
              </div>
            )}
          </form>

          {/* 후기 리스트 */}
          <div className="space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC]/70 p-7 text-center flex flex-col items-center justify-center gap-2">
                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Star className="size-5 text-slate-300 stroke-[1.8]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-bold text-slate-700">
                    아직 등록된 방문 후기가 없습니다. 첫 후기를 남겨보세요!
                  </p>
                  <p className="text-[11px] text-slate-400 break-keep">
                    축제에 다녀오신 생생한 경험과 꿀팁을 위 작성 폼에서 남겨보세요.
                  </p>
                </div>
              </div>
            ) : (
              reviews.map((rev) => {
              const initial = rev.nickname ? rev.nickname.charAt(0) : '익'
              return (
                <div
                  key={rev.id}
                  className="rounded-2xl bg-[#F8FAFC] border border-slate-100/90 p-4 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-full bg-[#1884F7] text-white font-bold flex items-center justify-center text-xs">
                        {initial}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-none">{rev.nickname}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{rev.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                      <span>★</span>
                      <span>{rev.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-600 leading-relaxed break-keep">
                    {rev.content}
                  </p>
                  {rev.imageUrl && (
                    <div className="relative mt-2.5 aspect-[16/9] w-full max-w-xs rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs">
                      <Image
                        src={rev.imageUrl}
                        alt="방문 후기 사진"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
              )
            }))}
          </div>

          {/* 방문 전 확인해 주세요 안내 박스 (시안 4번 하단) */}
          <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <h4 className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Info className="size-3.5 text-slate-500" />
              방문 전 확인해 주세요
            </h4>
            <p className="text-[11.5px] text-slate-500 leading-relaxed break-keep">
              주말 저녁에는 주변 교통이 혼잡하니 대중교통 이용을 권장해요. 현장 상황에 따라 운영 시간이 변동될 수 있습니다.
            </p>
          </div>
        </section>
      </div>

      {/* 4번 하단 고정 액션 버튼 (Fixed Bottom Bar: 스크롤과 무관하게 하단 고정 플로팅) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-md p-4">
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-13 rounded-2xl bg-[#1884F7] hover:bg-[#0F75E8] active:scale-[0.99] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
          >
            <ExternalLink className="size-5" />
            공식 안내 / 상세 보기
          </a>
        </div>
      </div>
    </div>
  )
}
