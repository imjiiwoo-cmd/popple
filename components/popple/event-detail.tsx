'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import Image from 'next/image'
import { EventImage } from './event-image'
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
  ImageIcon,
  UtensilsCrossed,
  Tag,
  Ticket,
} from 'lucide-react'
import {
  type PoppleEvent,
  type WaitingStatus,
  WAITING_STATUS_CONFIG,
  getDefaultWaitingStatus,
} from '@/lib/events'
import { getUserProfile } from '@/lib/mypage'
import { supabase } from '@/lib/supabaseClient'
import { compressImageFileToBase64 } from '@/lib/community'
import { recordEventClick } from '@/lib/ranking'
import { getNearbySpotsForEvent, type NearbySpot } from '@/lib/constants/nearby-spots'
import {
  getReviewsForEvent,
  addUnifiedReview,
  subscribeToReviews,
  type Review,
} from '@/lib/constants/reviews'

interface EventDetailProps {
  event: PoppleEvent
  onBack: () => void
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

    // 상세 페이지 진입 시 조회수 증가 (로컬 및 Supabase DB 연동)
    recordEventClick(event)

    return () => cancelAnimationFrame(rafId)
  }, [event.id])

  // 리뷰 및 방명록 상태 (단일 공통 저장소 연동)
  const [reviews, setReviews] = useState<Review[]>([])
  const [newNickname, setNewNickname] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newRating, setNewRating] = useState(5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 인근 추천 핫플 (식당 1곳 + 카페 1곳) 및 가상 쿠폰 상태
  const [selectedCouponSpot, setSelectedCouponSpot] = useState<NearbySpot | null>(null)
  const [usedCouponCodes, setUsedCouponCodes] = useState<Record<string, boolean>>({})

  // 실시간 현장 대기시간 상태 ("SMOOTH" | "NORMAL" | "CROWDED" | "CLOSED")
  const [waitingStatus, setWaitingStatus] = useState<WaitingStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`popple_waiting_status_${event.id}`) as WaitingStatus | null
      if (saved && WAITING_STATUS_CONFIG[saved]) return saved
    }
    return event.waitingStatus || getDefaultWaitingStatus(event)
  })

  // 대기시간 퀵 공유 모달 상태 & 쿠폰 발급 대기 타겟
  const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false)
  const [pendingCouponSpot, setPendingCouponSpot] = useState<NearbySpot | null>(null)

  const currentWaitingConfig = WAITING_STATUS_CONFIG[waitingStatus] || WAITING_STATUS_CONFIG.SMOOTH

  const nearbySpots = useMemo(
    () => getNearbySpotsForEvent(event.location, event.title),
    [event.location, event.title],
  )

  // 쿠폰 버튼 클릭 핸들러 (사용 전이면 '대기시간 퀵 공유' 모달 먼저 노출)
  const handleCouponButtonClick = (spot: NearbySpot) => {
    const isUsed = !!usedCouponCodes[spot.coupon.code]
    if (isUsed) {
      // 이미 사용된 쿠폰인 경우 바로 상세 바코드 모달 오픈
      setSelectedCouponSpot(spot)
    } else {
      // 미사용 쿠폰 발급 전 '현장 대기시간 공유' 팝업 오픈
      setPendingCouponSpot(spot)
      setIsWaitingModalOpen(true)
    }
  }

  // 현장 대기시간 퀵 공유 완료 핸들러
  const handleSelectWaitingStatus = (status: WaitingStatus) => {
    setWaitingStatus(status)
    try {
      localStorage.setItem(`popple_waiting_status_${event.id}`, status)
    } catch {
      // 무시
    }
    showToast('소중한 정보 감사합니다! 쿠폰이 발급되었습니다.')
    setIsWaitingModalOpen(false)

    // 즉시 기존 '가상 바코드 쿠폰 모달'로 화면 전환
    const targetSpot = pendingCouponSpot || nearbySpots[0]
    if (targetSpot) {
      setSelectedCouponSpot(targetSpot)
    }
    setPendingCouponSpot(null)
  }

  // '아직 도착 전이에요 (현장 대기 집계 없이 쿠폰 받기)' 예외 핸들러
  const handleSkipWaitingCheckIn = () => {
    showToast('쿠폰이 발급되었습니다!')
    setIsWaitingModalOpen(false)

    // 대기 상태는 기존 상태를 유지하고, 바로 쿠폰 모달로 이동
    const targetSpot = pendingCouponSpot || nearbySpots[0]
    if (targetSpot) {
      setSelectedCouponSpot(targetSpot)
    }
    setPendingCouponSpot(null)
  }

  // 상단 미니 별점 요약 및 부드러운 스크롤 타겟
  const reviewsSectionRef = useRef<HTMLDivElement>(null)
  const scrollToReviews = () => {
    if (reviewsSectionRef.current) {
      reviewsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // 가상 쿠폰 사용 처리
  const handleUseCoupon = (code: string) => {
    const nextMap = { ...usedCouponCodes, [code]: true }
    setUsedCouponCodes(nextMap)
    try {
      localStorage.setItem('popple_used_coupons', JSON.stringify(nextMap))
    } catch {
      // 무시
    }
    showToast('쿠폰이 사용 처리되었습니다! ✨')
  }

  // localStorage에서 사용 완료된 쿠폰 목록 로드
  useEffect(() => {
    try {
      const savedCoupons = localStorage.getItem('popple_used_coupons')
      if (savedCoupons) {
        setUsedCouponCodes(JSON.parse(savedCoupons))
      }
    } catch {
      // 무시
    }
  }, [])

  // 리뷰 평점 및 개수 요약 (실제 후기 데이터 기반 동적 계산)
  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0'
  const totalReviewsCount = reviews.length

  // 리뷰 사진 첨부 상태
  const [reviewImageBase64, setReviewImageBase64] = useState<string | null>(null)
  const [isCompressingImage, setIsCompressingImage] = useState(false)
  const reviewFileInputRef = useRef<HTMLInputElement | null>(null)

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

  // 북마크 로드 및 단일 공통 저장소에서 해당 행사 후기 로드 (실시간 구독)
  useEffect(() => {
    try {
      const savedBookmark = localStorage.getItem(bookmarkStorageKey)
      if (savedBookmark === 'true') {
        setIsBookmarked(true)
      }
    } catch {
      // 무시
    }

    const loadReviews = () => {
      const matched = getReviewsForEvent(event.id, event.title)
      setReviews(matched)
    }

    loadReviews()

    const unsubscribe = subscribeToReviews(loadReviews)
    return () => unsubscribe()
  }, [event.id, event.title, bookmarkStorageKey])

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
    const userProfile = getUserProfile()

    const newRev = addUnifiedReview({
      eventId: event.id,
      eventTitle: event.title,
      author: newNickname.trim(),
      avatar: userProfile?.avatarUrl,
      avatarColor: userProfile?.avatarUrl.includes('bear')
        ? 'bg-amber-600'
        : userProfile?.avatarUrl.includes('rabbit')
        ? 'bg-rose-400'
        : userProfile?.avatarUrl.includes('cat')
        ? 'bg-amber-400'
        : userProfile?.avatarUrl.includes('dog')
        ? 'bg-orange-500'
        : userProfile?.avatarUrl.includes('frog')
        ? 'bg-emerald-500'
        : 'bg-[#1884F7]',
      rating: newRating,
      content: newContent.trim(),
      imageUrl: reviewImageBase64 || undefined,
    })

    setReviews((prev) => [newRev, ...prev.filter((r) => r.id !== newRev.id)])
    setNewContent('')
    setReviewImageBase64(null)
    setNewRating(5)
    setIsSubmitting(false)
    showToast('방문 후기가 등록되고 홈 화면 및 커뮤니티(축제후기) 피드에도 실시간 공유되었어요! ✨')
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[70] rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2">
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
          <EventImage
            src={imageSrc}
            alt={`${event.title} 대표 이미지`}
            fill
            className="object-cover object-center"
            priority
          />

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

        {/* 1번 본문: 타이틀, 미니 별점 요약(클릭 시 후기로 이동), 소개글, 해시태그 칩들 */}
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black tracking-widest text-[#1884F7] uppercase">
                {categoryBadge}
              </span>

              {/* 실시간 현장 대기 상태 뱃지 */}
              <button
                type="button"
                onClick={() => {
                  setPendingCouponSpot(nearbySpots[0] || null)
                  setIsWaitingModalOpen(true)
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all active:scale-95 shadow-2xs cursor-pointer ${currentWaitingConfig.bgClass} ${currentWaitingConfig.borderClass}`}
                title="실시간 현장 대기상황 공유하기"
              >
                <span className={`size-2 rounded-full ${currentWaitingConfig.dotColor} animate-pulse`} />
                <span>{currentWaitingConfig.emoji} {currentWaitingConfig.label}</span>
                <span className="text-[10px] opacity-80 font-medium hidden xs:inline">
                  ({currentWaitingConfig.desc})
                </span>
              </button>
            </div>

            {/* 상단 미니 별점 요약 (클릭 시 하단 '방문 후기' 영역으로 부드럽게 스크롤) */}
            <button
              type="button"
              onClick={scrollToReviews}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100/90 border border-amber-200/70 text-amber-900 text-xs font-bold transition-all active:scale-95 group cursor-pointer shadow-2xs"
              title="방문 후기 영역으로 이동"
            >
              <span className="flex items-center text-amber-500 gap-0.5">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                <span className="font-black text-amber-900">{averageRating}</span>
              </span>
              <span className="text-[11px] text-slate-500 font-semibold group-hover:text-slate-800">
                (후기 {totalReviewsCount}개)
              </span>
              <ChevronRight className="size-3 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

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
            {/* 실시간 현장 대기 현황 */}
            <div className="flex items-start">
              <span className="w-20 shrink-0 text-slate-400 font-medium">실시간 대기</span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentWaitingConfig.bgClass} ${currentWaitingConfig.borderClass}`}>
                  <span className={`size-2 rounded-full ${currentWaitingConfig.dotColor} animate-pulse`} />
                  <span>{currentWaitingConfig.emoji} {currentWaitingConfig.label}</span>
                  <span className="text-[11px] opacity-85 font-medium">({currentWaitingConfig.desc})</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingCouponSpot(nearbySpots[0] || null)
                    setIsWaitingModalOpen(true)
                  }}
                  className="text-xs text-[#1884F7] hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>현장 상황 공유하기</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>

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

        {/* [신설] 함께 가기 좋은 인근 핫플 (도보 거리 식당 1곳 + 카페 1곳 + 가상 쿠폰) */}
        <section aria-labelledby="section-nearby-spots" className="px-5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                <UtensilsCrossed className="size-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-orange-500 tracking-wider uppercase block">
                  NEARBY HOTSPOTS
                </span>
                <h3 id="section-nearby-spots" className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                  함께 가기 좋은 인근 핫플
                </h3>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-400">
              도보 5분 이내
            </span>
          </div>

          {/* 인근 추천 장소 카드 리스트 (달력 행사 카드 규격 100% 통일) */}
          <div className="flex flex-col gap-3.5">
            {nearbySpots.map((spot) => {
              const isUsed = !!usedCouponCodes[spot.coupon.code]

              return (
                <article
                  key={spot.id}
                  onClick={() => handleCouponButtonClick(spot)}
                  className="group relative bg-white rounded-3xl p-3 border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex gap-3.5 hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                >
                  {/* 좌측: 둥근 모서리의 직사각형 썸네일 이미지 (달력 카드 규격 통일) */}
                  <div className="relative w-[112px] min-w-[112px] h-[190px] rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100/80">
                    <span
                      className={`absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-xs ${
                        spot.category === '식당' ? 'bg-[#F43F5E]' : 'bg-[#1884F7]'
                      }`}
                    >
                      {spot.category}
                    </span>

                    <span className="absolute top-2.5 right-2 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-black/60 backdrop-blur-md">
                      {spot.coupon.dday}
                    </span>

                    <EventImage
                      src={spot.imageUrl}
                      alt={spot.name}
                      fill
                      sizes="112px"
                      referrerPolicy="no-referrer"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* 중앙/우측: 가게 정보 및 포인트 컬러 쿠폰 버튼 */}
                  <div className="flex flex-col justify-between flex-1 py-0.5 min-w-0">
                    <div>
                      {/* 상단: 가게명 볼드 타이틀 + 우측 포인트 컬러 쿠폰 뱃지 버튼 */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 pr-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 mb-1 rounded text-[10px] font-black ${
                              spot.category === '식당'
                                ? 'bg-rose-50 text-[#F43F5E]'
                                : 'bg-blue-50 text-[#1884F7]'
                            }`}
                          >
                            {spot.category}
                          </span>
                          <h4 className="text-[15px] font-black text-slate-900 leading-snug line-clamp-1">
                            {spot.name}
                          </h4>
                        </div>

                        {/* 포인트 컬러 쿠폰 뱃지 버튼 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCouponButtonClick(spot)
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black shrink-0 transition-all active:scale-95 shadow-2xs ${
                            isUsed
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-orange-500/20'
                          }`}
                        >
                          <Tag className="size-3" />
                          <span>{isUsed ? '사용완료' : `${spot.coupon.discount} 받기`}</span>
                        </button>
                      </div>

                      {/* 상세 정보: 거리 정보, 대표 키워드 태그, 쿠폰 혜택 요약 */}
                      <div className="flex flex-col gap-1 mt-2 text-xs">
                        <div className="flex items-center text-slate-700 font-bold">
                          <MapPin className="size-3.5 text-[#1884F7] shrink-0 mr-1.5" />
                          <span className="truncate">{spot.distance}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium truncate">
                          {spot.tag}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 rounded-md px-1.5 py-0.5 truncate max-w-full">
                            🏷️ {spot.coupon.title}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 하단: 달력 카드와 동일한 규격의 액션 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCouponButtonClick(spot)
                      }}
                      className="bg-[#F0F7FF] hover:bg-[#E2F0FE] active:scale-[0.98] text-[#1884F7] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-black transition-colors w-full mt-3"
                    >
                      <span>{isUsed ? '쿠폰 상세 / 바코드' : '가상 쿠폰 받기'}</span>
                      <span className="flex items-center gap-0.5 font-bold text-slate-500">
                        <span>{isUsed ? '확인' : '바코드'}</span>
                        <ChevronRight className="size-3.5 text-[#1884F7] stroke-[2.5]" />
                      </span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* 구분선 */}
        <hr className="my-6 border-slate-100" />

        {/* 4번: 방문 후기 섹션 (간이 방명록) */}
        <section ref={reviewsSectionRef} aria-labelledby="section-reviews" className="px-5 scroll-mt-20">
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
                const authorName = rev.author || (rev as any).nickname || '익명팝플'
                const initial = authorName.charAt(0)
                const createdDate = rev.createdAt || (rev as any).date || '방금 전'
                const avatarColor = rev.avatarColor || 'bg-[#1884F7]'

                return (
                  <div
                    key={rev.id}
                    className="rounded-2xl bg-[#F8FAFC] border border-slate-100/90 p-4 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`size-9 rounded-full ${avatarColor} text-white font-bold flex items-center justify-center text-xs shadow-xs`}>
                          {initial}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-none">{authorName}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{createdDate}</p>
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
                          referrerPolicy="no-referrer"
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
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

      {/* 5-1. 현장 대기시간 퀵 공유 모달 (가상 상생 쿠폰 발급 전) */}
      {isWaitingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setIsWaitingModalOpen(false)
            setPendingCouponSpot(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-200 text-center"
          >
            {/* 닫기 (X) 버튼 */}
            <button
              type="button"
              onClick={() => {
                setIsWaitingModalOpen(false)
                setPendingCouponSpot(null)
              }}
              aria-label="닫기"
              className="absolute top-4 right-4 size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* 상단 기프트 아이콘 */}
            <div className="size-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-2xl mb-3 shadow-inner">
              🎁
            </div>

            {/* 모달 타이틀 */}
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug break-keep">
              현장 상황을 공유하고 할인 쿠폰을 받아보세요! 🎁
            </h3>

            <p className="mt-1.5 text-xs text-slate-500 break-keep">
              {pendingCouponSpot ? (
                <span>
                  <strong className="text-slate-800">{pendingCouponSpot.name}</strong> 혜택을 받기 전, 현재 대기 상황을 알려주세요!
                </span>
              ) : (
                '지금 현장의 생생한 대기 시간을 1초 만에 알려주세요!'
              )}
            </p>

            {/* 선택 버튼 (4개 칩 형태) */}
            <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
              <button
                type="button"
                onClick={() => handleSelectWaitingStatus('SMOOTH')}
                className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 active:scale-95 transition-all text-emerald-950 font-bold shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-sm font-black">
                  <span>🟢</span>
                  <span>대기 없음</span>
                </div>
                <span className="text-[11px] text-emerald-700/90 font-medium mt-1">
                  10분 미만
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectWaitingStatus('NORMAL')}
                className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100 active:scale-95 transition-all text-amber-950 font-bold shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-sm font-black">
                  <span>🟡</span>
                  <span>10~30분</span>
                </div>
                <span className="text-[11px] text-amber-700/90 font-medium mt-1">
                  보통
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectWaitingStatus('CROWDED')}
                className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl border-2 border-orange-300 bg-orange-50/70 hover:bg-orange-100 active:scale-95 transition-all text-orange-950 font-bold shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-sm font-black">
                  <span>🟠</span>
                  <span>1시간 이상</span>
                </div>
                <span className="text-[11px] text-orange-700/90 font-medium mt-1">
                  혼잡
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectWaitingStatus('CLOSED')}
                className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl border-2 border-rose-300 bg-rose-50/70 hover:bg-rose-100 active:scale-95 transition-all text-rose-950 font-bold shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-sm font-black">
                  <span>🔴</span>
                  <span>현장 마감</span>
                </div>
                <span className="text-[11px] text-rose-700/90 font-medium mt-1">
                  금일 마감
                </span>
              </button>
            </div>

            {/* 허위 데이터 방지를 위한 '미도착' 예외 옵션 버튼 */}
            <button
              type="button"
              onClick={handleSkipWaitingCheckIn}
              className="mt-3.5 py-1.5 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline transition-colors cursor-pointer flex items-center justify-center gap-1 active:scale-95"
            >
              <span>아직 도착 전이에요 (현장 대기 집계 없이 쿠폰 받기)</span>
            </button>

            <p className="mt-2 text-[11px] text-slate-400 font-medium">
              💡 상태를 1회 탭하면 즉시 가상 바코드 쿠폰이 발급됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 5-2. 가상 쿠폰 사용 모달창 (모바일 바코드 형태) */}
      {selectedCouponSpot && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedCouponSpot(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center animate-in zoom-in-95 duration-200 text-center"
          >
            {/* 닫기 (X) 버튼 */}
            <button
              type="button"
              onClick={() => setSelectedCouponSpot(null)}
              aria-label="닫기"
              className="absolute top-4 right-4 size-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="size-4" />
            </button>

            {/* 상단 뱃지 & 타이틀 */}
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${
                  selectedCouponSpot.category === '식당' ? 'bg-[#F43F5E]' : 'bg-[#1884F7]'
                }`}
              >
                {selectedCouponSpot.category}
              </span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                {selectedCouponSpot.coupon.dday} 남음
              </span>
            </div>

            <h3 className="text-lg font-black text-slate-900 mt-1">
              {selectedCouponSpot.name}
            </h3>

            <div className="mt-2 text-center">
              <span className="text-2xl font-black text-[#1884F7] tracking-tight">
                {selectedCouponSpot.coupon.discount}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">
                {selectedCouponSpot.coupon.benefit}
              </p>
            </div>

            {/* 가상 모바일 바코드 그래픽 */}
            <div className="my-5 w-full bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-4 flex flex-col items-center">
              {/* 바코드 바 (Vertical Stripes) */}
              <div className="h-14 w-full flex items-center justify-center gap-1 sm:gap-1.5 px-2 overflow-hidden select-none">
                {[3, 1, 4, 2, 5, 1, 3, 2, 4, 1, 3, 5, 2, 1, 4, 2, 3, 1, 5, 2, 4, 1, 3].map((w, i) => (
                  <div
                    key={i}
                    className="h-full bg-slate-900 rounded-xs"
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>

              {/* 쿠폰 고유 코드 및 번호 */}
              <span className="text-xs font-mono font-black text-slate-800 tracking-widest mt-2">
                {selectedCouponSpot.coupon.code}
              </span>

              {/* 유효기간 */}
              <span className="text-[10px] text-slate-400 font-medium mt-1">
                유효기간: {selectedCouponSpot.coupon.validUntil}
              </span>
            </div>

            {/* [직원 확인 및 사용하기] 버튼 */}
            {usedCouponCodes[selectedCouponSpot.coupon.code] ? (
              <button
                type="button"
                disabled
                className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Check className="size-4 stroke-[3]" />
                <span>사용 완료된 쿠폰입니다</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleUseCoupon(selectedCouponSpot.coupon.code)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1884F7] to-sky-500 hover:from-blue-600 hover:to-sky-600 active:scale-[0.98] text-white font-black text-sm shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Ticket className="size-4" />
                <span>직원 확인 및 사용하기</span>
              </button>
            )}

            <p className="text-[10.5px] text-slate-400 mt-2.5">
              주문 또는 결제 시 매장 직원에게 위 바코드를 제시해 주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
