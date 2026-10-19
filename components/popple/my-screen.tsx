'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Camera,
  Edit3,
  Calendar as CalendarIcon,
  Star,
  Ticket,
  ChevronRight,
  ChevronLeft,
  Share2,
  Plus,
  Trash2,
  X,
  Check,
  Sparkles,
  MapPin,
  Home,
  Users,
  User,
  Copy,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Mail,
} from 'lucide-react'
import type { PoppleEvent } from '@/lib/events'
import { MOCK_EVENTS } from '@/lib/events'
import { supabase } from '@/lib/supabaseClient'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AuthModal } from './auth-modal'
import {
  type UserProfile,
  DEFAULT_AVATARS,
  getUserProfile,
  saveUserProfile,
  type PhotoDiaryEntry,
  getPhotoDiaries,
  savePhotoDiary,
  deletePhotoDiary,
  getBookmarkedEvents,
} from '@/lib/mypage'
import {
  getCommunityPosts,
  saveCommunityPosts,
  type CommunityPost,
  CATEGORY_BADGES,
  compressImageFileToBase64,
} from '@/lib/community'
import { MiniPhotoCalendar } from './mini-photo-calendar'
import { getUserCoupons } from '@/lib/coupons'

interface MyScreenProps {
  onOpenHome: () => void
  onOpenEvents: () => void
  onOpenCommunity: () => void
  onOpenLens: () => void
  onSelectEvent: (event: PoppleEvent) => void
  onOpenCoupons?: () => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function MyScreen({
  onOpenHome,
  onOpenEvents,
  onOpenCommunity,
  onOpenLens,
  onSelectEvent,
  onOpenCoupons,
}: MyScreenProps) {
  // 0. Supabase 인증 및 세션 상태
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login')

  // 1. 프로필 상태
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile())
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [editingNickname, setEditingNickname] = useState(profile.nickname)
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(profile.avatarUrl)

  // 2. 북마크(찜한 축제) 목록
  const [bookmarkedEvents, setBookmarkedEvents] = useState<PoppleEvent[]>([])

  // 3. 포토 캘린더 다이어리 상태
  const [photoDiaries, setPhotoDiaries] = useState<Record<string, PhotoDiaryEntry>>(() =>
    getPhotoDiaries(),
  )
  const [calendarYear, setCalendarYear] = useState(2026)
  const [calendarMonth, setCalendarMonth] = useState(10) // 10월
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [diaryModalOpen, setDiaryModalOpen] = useState(false)
  const [diaryMemo, setDiaryMemo] = useState('')
  const [diaryImageBase64, setDiaryImageBase64] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  // 보유 쿠폰 상태
  const [couponCount, setCouponCount] = useState(() =>
    getUserCoupons().filter((c) => !c.isUsed).length,
  )

  // 커뮤니티 공유 글쓰기 모달 상태 (요건 2 & 4: 세 번째 카테고리 '달력공유' 기본 활성화)
  const [isCommunityShareModalOpen, setIsCommunityShareModalOpen] = useState(false)
  const [shareCategory, setShareCategory] = useState<'talk' | 'photo' | 'calendar'>('calendar')
  const [shareAuthorName, setShareAuthorName] = useState(profile.nickname)
  const [shareContent, setShareContent] = useState('')

  const profileFileInputRef = useRef<HTMLInputElement | null>(null)
  const diaryFileInputRef = useRef<HTMLInputElement | null>(null)
  const diaryCameraInputRef = useRef<HTMLInputElement | null>(null)

  // 데이터 로드
  useEffect(() => {
    // 찜한 축제 로드
    fetch('/api/festivals')
      .then((res) => (res.ok ? res.json() : { festivals: [] }))
      .then((data) => {
        const pool = Array.isArray(data.festivals) && data.festivals.length > 0 ? data.festivals : MOCK_EVENTS
        const bookmarks = getBookmarkedEvents(pool)
        setBookmarkedEvents(bookmarks)
      })
      .catch(() => {
        setBookmarkedEvents(getBookmarkedEvents(MOCK_EVENTS))
      })

    // 보유 쿠폰 개수 동기화
    setCouponCount(getUserCoupons().filter((c) => !c.isUsed).length)
  }, [])

  // Supabase 세션 감지 및 프로필 자동 동기화
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setCurrentUser(user)
      if (user) {
        const metaNickname = user.user_metadata?.nickname
        setProfile((prev) => {
          const updated: UserProfile = {
            ...prev,
            nickname: metaNickname || prev.nickname,
            email: user.email,
            userId: user.id,
          }
          saveUserProfile(updated)
          return updated
        })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setCurrentUser(user)
      if (user) {
        const metaNickname = user.user_metadata?.nickname
        setProfile((prev) => {
          const updated: UserProfile = {
            ...prev,
            nickname: metaNickname || prev.nickname,
            email: user.email,
            userId: user.id,
          }
          saveUserProfile(updated)
          return updated
        })
      } else {
        setProfile((prev) => {
          const updated: UserProfile = {
            ...prev,
            email: undefined,
            userId: undefined,
          }
          saveUserProfile(updated)
          return updated
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 로그아웃 핸들러
  const handleSignOut = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await supabase.auth.signOut()
      setCurrentUser(null)
      const updated: UserProfile = {
        ...profile,
        email: undefined,
        userId: undefined,
      }
      setProfile(updated)
      saveUserProfile(updated)
    }
  }

  // 로그인 성공 시 핸들러
  const handleAuthSuccess = (user: SupabaseUser) => {
    setCurrentUser(user)
    const metaNickname = user.user_metadata?.nickname
    const updated: UserProfile = {
      ...profile,
      nickname: metaNickname || profile.nickname,
      email: user.email,
      userId: user.id,
    }
    setProfile(updated)
    saveUserProfile(updated)
    setIsAuthModalOpen(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('popple-login-success'))
    }
  }

  // 프로필 모달 열기
  const handleOpenProfileModal = () => {
    setEditingNickname(profile.nickname)
    setSelectedAvatarUrl(profile.avatarUrl)
    setIsProfileModalOpen(true)
  }

  // 프로필 사진 직접 업로드 핸들러
  const handleProfileFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCompressing(true)
    try {
      const base64 = await compressImageFileToBase64(file)
      setSelectedAvatarUrl(base64)
    } catch {
      alert('이미지를 불러오지 못했습니다.')
    } finally {
      setIsCompressing(false)
      if (profileFileInputRef.current) profileFileInputRef.current.value = ''
    }
  }

  // 프로필 저장
  const handleSaveProfile = () => {
    const updated: UserProfile = {
      ...profile,
      nickname: editingNickname.trim() || '팝플러',
      avatarUrl: selectedAvatarUrl,
      avatarType: selectedAvatarUrl.startsWith('data:') ? 'custom' : 'character',
    }
    setProfile(updated)
    saveUserProfile(updated)
    setIsProfileModalOpen(false)
  }

  // 포토 캘린더 날짜 클릭 핸들러
  const handleDateClick = (dateKey: string) => {
    setSelectedDateKey(dateKey)
    const existing = photoDiaries[dateKey]
    if (existing) {
      setDiaryMemo(existing.memo)
      setDiaryImageBase64(existing.imageUrl)
    } else {
      setDiaryMemo('')
      setDiaryImageBase64(null)
    }
    setDiaryModalOpen(true)
  }

  // 다이어리 사진 업로드 핸들러
  const handleDiaryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCompressing(true)
    try {
      const base64 = await compressImageFileToBase64(file)
      setDiaryImageBase64(base64)
    } catch {
      alert('이미지를 불러오지 못했습니다.')
    } finally {
      setIsCompressing(false)
      if (diaryFileInputRef.current) diaryFileInputRef.current.value = ''
    }
  }

  // 다이어리 저장
  const handleSaveDiary = () => {
    if (!selectedDateKey) return
    if (!diaryImageBase64 && !diaryMemo.trim()) {
      alert('사진을 첨부하거나 한 줄 일기를 입력해주세요.')
      return
    }

    const entry: PhotoDiaryEntry = {
      dateKey: selectedDateKey,
      imageUrl: diaryImageBase64 || '/events/autumn-walk.jpg',
      memo: diaryMemo.trim() || '오늘의 축제 일상 기록 📸',
      createdAt: Date.now(),
    }

    const updated = savePhotoDiary(entry)
    setPhotoDiaries(updated)
    setDiaryModalOpen(false)
  }

  // 다이어리 삭제
  const handleDeleteDiary = () => {
    if (!selectedDateKey) return
    if (confirm('이 날의 일상 기록을 삭제하시겠습니까?')) {
      const updated = deletePhotoDiary(selectedDateKey)
      setPhotoDiaries(updated)
      setDiaryModalOpen(false)
    }
  }

  // [📸 이번 달 축제 달력 커뮤니티에 공유하기] 모달 오픈 (요건 2 & 3)
  const handleOpenShareModal = () => {
    const entries = Object.values(photoDiaries).filter((d) =>
      d.dateKey.startsWith(`${calendarYear}-${String(calendarMonth).padStart(2, '0')}`),
    )

    if (entries.length === 0) {
      alert(
        '이번 달에 등록된 포토 다이어리가 없습니다. 먼저 캘린더 날짜를 눌러 사진과 일기를 기록해보세요!',
      )
      return
    }

    // 1) 현재 설정된 프로필 닉네임을 기본 작성자로 지정 및 세 번째 카테고리 '달력공유' 활성화
    setShareAuthorName(profile.nickname)
    setShareCategory('calendar')

    // 2 & 3) 이번 달 축제 기록 요약 멘트를 프리필 (요건 3: '자랑' -> '공유')
    const diarySummaries = entries
      .map((e) => `• ${e.dateKey.slice(5)}: ${e.memo}`)
      .join('\n')

    setShareContent(
      `🍂 ${calendarYear}년 ${calendarMonth}월 축제 포토 캘린더 공유해요! 📸\n\n총 ${entries.length}개의 특별한 축제 일상을 기록했습니다.\n${diarySummaries}\n\n다들 이번 달에 어떤 축제 다녀오셨나요? 저의 축제 달력 구경해보세요! 🎈`,
    )

    // 모달 즉시 띄우기
    setIsCommunityShareModalOpen(true)
  }

  // 커뮤니티 게시물 최종 등록 (요건 2 - 4)
  const handleSubmitSharePost = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = shareContent.trim()
    if (!trimmed) {
      alert('게시글 내용을 입력해주세요!')
      return
    }

    const entries = Object.values(photoDiaries).filter((d) =>
      d.dateKey.startsWith(`${calendarYear}-${String(calendarMonth).padStart(2, '0')}`),
    )
    const entriesMap: Record<string, { imageUrl: string; memo: string }> = {}
    entries.forEach((e) => {
      entriesMap[e.dateKey] = { imageUrl: e.imageUrl, memo: e.memo }
    })
    const latestEntry = entries[entries.length - 1]

    const newPost: CommunityPost = {
      id: `post_cal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category: shareCategory,
      author: shareAuthorName.trim() || profile.nickname || '익명팝플',
      avatarColor: 'bg-[#1884F7]',
      content: trimmed,
      imageUrl: latestEntry ? latestEntry.imageUrl : '/events/autumn-walk.jpg',
      calendarYear,
      calendarMonth,
      calendarDiaries: entriesMap,
      createdAt: Date.now(),
      likes: 0,
      likedByUser: false,
      comments: [
        {
          id: `c_auto_${Date.now()}`,
          author: '팝플봇',
          content: `${shareAuthorName.trim() || profile.nickname}님의 멋진 포토 캘린더 기록을 환영합니다! 🎉`,
          createdAt: Date.now(),
        },
      ],
    }

    // 커뮤니티 게시글 목록 최상단에 등록
    const currentPosts = getCommunityPosts()
    saveCommunityPosts([newPost, ...currentPosts])
    setIsCommunityShareModalOpen(false)

    if (
      confirm(
        `🎉 ${calendarMonth}월 축제 달력 공유글이 커뮤니티 피드에 성공적으로 등록되었습니다!\n\n커뮤니티 화면으로 이동하여 확인해볼까요?`,
      )
    ) {
      onOpenCommunity()
    }
  }

  // 캘린더 그리드 날짜 계산 (2026년 10월)
  const firstDayOfWeek = new Date(calendarYear, calendarMonth - 1, 1).getDay() // 0: 일요일
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate() // 31일

  const calendarDays = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="relative flex flex-col min-h-dvh bg-slate-50 text-slate-900 pb-24">
      {/* 1. 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-slate-900">마이페이지</h1>
          </div>
          {currentUser ? (
            <button
              type="button"
              onClick={handleOpenProfileModal}
              className="text-xs font-bold text-[#1884F7] hover:text-[#0F75E8] flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 transition-colors"
            >
              <Edit3 className="size-3.5" />
              <span>프로필 수정</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthModalTab('login')
                setIsAuthModalOpen(true)
              }}
              className="text-xs font-bold text-[#1884F7] hover:text-[#0F75E8] flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full border border-sky-100 transition-colors"
            >
              <LogIn className="size-3.5" />
              <span>로그인</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-6">
        {/* [1. 상단 프로필 영역] */}
        <section aria-label="프로필 요약" className="rounded-3xl bg-white p-5 shadow-xs border border-slate-100 flex flex-col gap-3.5">
          {currentUser ? (
            /* 로그인 완료 상태 */
            <div className="flex items-start gap-4">
              {/* 아바타 원형 이미지 */}
              <div
                onClick={handleOpenProfileModal}
                role="button"
                tabIndex={0}
                className="relative size-18 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-md bg-slate-100 cursor-pointer group"
                title="프로필 이미지 변경"
              >
                <Image
                  src={profile.avatarUrl}
                  alt={currentUser.user_metadata?.nickname || profile.nickname}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera className="size-5" />
                </div>
              </div>

              {/* 프로필 정보 */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 truncate">
                      {currentUser.user_metadata?.nickname || profile.nickname}
                    </h2>
                    <button
                      type="button"
                      onClick={handleOpenProfileModal}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="닉네임 수정"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                  </div>

                  {/* 프로필 우측 상단 [로그아웃] 버튼 */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 bg-slate-50 hover:bg-rose-50 px-2.5 py-1 rounded-full border border-slate-200/80 hover:border-rose-200 transition-colors shrink-0"
                    title="로그아웃"
                  >
                    <LogOut className="size-3" />
                    <span>로그아웃</span>
                  </button>
                </div>

                {/* 가입 이메일 표시 */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                  <Mail className="size-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </div>

                <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-1">
                  {profile.bio || '축제와 팝업스토어를 사랑하는 프로 나들이러 ✨'}
                </p>
              </div>
            </div>
          ) : (
            /* 비로그인 상태 */
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div
                  onClick={() => {
                    setAuthModalTab('login')
                    setIsAuthModalOpen(true)
                  }}
                  role="button"
                  tabIndex={0}
                  className="relative size-16 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-md bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-sky-50 transition-colors"
                  title="로그인 / 회원가입"
                >
                  <User className="size-8 stroke-[1.8] text-slate-400" />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <h2 className="text-base font-black text-slate-900">
                    로그인이 필요합니다
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    로그인하고 축제 후기 및 나만의 일상을 기록해보세요!
                  </p>
                </div>
              </div>

              {/* [로그인 / 회원가입] 버튼 */}
              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalTab('login')
                    setIsAuthModalOpen(true)
                  }}
                  className="flex-1 bg-[#1884F7] hover:bg-[#0F75E8] active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-2xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn className="size-3.5" />
                  <span>로그인 / 회원가입</span>
                </button>
              </div>
            </div>
          )}

          {/* 공통 통계 (찜한 축제 & 기록된 일상) */}
          <div className="flex items-center gap-3 pt-2.5 border-t border-slate-100 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <Star className="size-3 text-amber-500 fill-amber-500" />
              찜한 축제 <strong className="text-[#1884F7]">{bookmarkedEvents.length}</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3 text-emerald-500" />
              기록된 일상 <strong className="text-emerald-600">{Object.keys(photoDiaries).length}</strong>
            </span>
          </div>
        </section>

        {/* [2. 섹션 1: 내가 찜한 축제 (북마크 리스트) - 최상단] */}
        <section aria-labelledby="section-bookmarks" className="flex flex-col gap-2.5">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
                MY FAVORITES
              </span>
              <h2 id="section-bookmarks" className="text-lg font-black text-slate-900">
                내가 찜한 축제{' '}
                <span className="text-sm font-semibold text-slate-400">
                  ({bookmarkedEvents.length})
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenEvents}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-0.5"
            >
              전체 일정 <ChevronRight className="size-3.5" />
            </button>
          </div>

          {bookmarkedEvents.length === 0 ? (
            /* 빈 화면 안내 (요건 2) */
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-xs flex flex-col items-center gap-3">
              <div className="size-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                <Star className="size-6 stroke-[1.8]" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-slate-800">
                  아직 찜한 축제가 없어요.
                </p>
                <p className="text-xs text-slate-400 break-keep">
                  가고 싶은 축제나 팝업스토어를 찜(★)하고 나만의 리스트를 완성해보세요!
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenEvents}
                className="mt-1 bg-[#1884F7] hover:bg-[#0F75E8] text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-2xs"
              >
                축제 둘러보기
              </button>
            </div>
          ) : (
            /* 찜한 축제 가로 스크롤 카드 */
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
              {bookmarkedEvents.map((ev) => (
                <article
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  role="button"
                  tabIndex={0}
                  className="shrink-0 w-38 rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs cursor-pointer active:scale-[0.98] transition-transform flex flex-col"
                >
                  <div className="relative aspect-[3/4] w-full bg-slate-100">
                    <Image
                      src={ev.imageUrl || ev.poster || '/events/rock-festival.png'}
                      alt={ev.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <span className="absolute top-2 left-2 z-10 rounded-md bg-[#1884F7] px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                      {ev.category || '축제'}
                    </span>
                    <span className="absolute top-2 right-2 z-10 text-amber-400">
                      <Star className="size-4 fill-amber-400" />
                    </span>
                  </div>
                  <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug">
                      {ev.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium line-clamp-1">
                      {ev.date}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* [3. 섹션 2: 일상기록 (포토 캘린더 다이어리)] */}
        <section aria-labelledby="section-diary" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
                PHOTO DIARY
              </span>
              <h2 id="section-diary" className="text-lg font-black text-slate-900">
                일상기록 (포토 캘린더)
              </h2>
            </div>

            {/* [📸 이번 달 축제 달력 커뮤니티에 공유하기] 버튼 (요건 2 & 3) */}
            <button
              type="button"
              onClick={handleOpenShareModal}
              className="flex items-center gap-1.5 bg-gradient-to-r from-sky-500 to-[#1884F7] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xs hover:opacity-95 active:scale-95 transition-all"
            >
              <Share2 className="size-3.5" />
              <span>축제 달력 공유</span>
            </button>
          </div>

          {/* 월간 미니 캘린더 카드 */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col gap-3">
            {/* 캘린더 상단 월 표시 및 안내 */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-black text-slate-900">
                {calendarYear}년 {calendarMonth}월
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                날짜를 눌러 사진을 기록해보세요 📸
              </span>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 py-1 border-b border-slate-100">
              {WEEKDAYS.map((wd, i) => (
                <div key={wd} className={i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : ''}>
                  {wd}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 (사진 등록된 날짜는 썸네일로 쏙 채움!) */}
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty_${idx}`} className="aspect-square" />
                }

                const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const diary = photoDiaries[dateKey]
                const isToday = day === 18 // 현재 10월 18일

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDateClick(dateKey)}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200/60 hover:border-[#1884F7] focus:outline-none transition-all flex flex-col items-center justify-center bg-slate-50 active:scale-95"
                  >
                    {diary ? (
                      /* 사진이 등록된 날짜 칸 (요건 3: 사진 썸네일이 쏙 들어감) */
                      <div className="relative size-full">
                        <Image
                          src={diary.imageUrl}
                          alt={diary.memo}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                        <span className="absolute top-1 left-1.5 text-[10px] font-black text-white drop-shadow-md">
                          {day}
                        </span>
                        <span className="absolute bottom-1 right-1 size-1.5 bg-yellow-400 rounded-full" />
                      </div>
                    ) : (
                      /* 일반 날짜 칸 */
                      <div className="flex flex-col items-center justify-center size-full">
                        <span
                          className={`text-xs font-bold ${
                            isToday
                              ? 'size-5 rounded-full bg-[#1884F7] text-white flex items-center justify-center text-[10px] shadow-xs'
                              : 'text-slate-700'
                          }`}
                        >
                          {day}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 등록된 일상 기록이 없을 때: Empty State 안내 문구 및 [기록 작성하기] 버튼 */}
            {Object.keys(photoDiaries).length === 0 && (
              <div className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 flex flex-col items-center justify-center text-center gap-2.5">
                <div className="size-10 rounded-full bg-sky-100/80 text-[#1884F7] flex items-center justify-center text-lg shadow-2xs">
                  📸
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-bold text-slate-800">
                    아직 작성된 일상 기록이 없습니다.
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    축제 방문 후 첫 추억을 남겨보세요!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                    handleDateClick(dateKey)
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 bg-[#1884F7] hover:bg-sky-600 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>기록 작성하기</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* [4. 섹션 3: 혜택 & 쿠폰함] */}
        <section aria-labelledby="section-coupon" className="flex flex-col gap-2.5">
          <div>
            <span className="text-[11px] font-black text-[#1884F7] tracking-wider uppercase">
              COUPON & BENEFIT
            </span>
            <h2 id="section-coupon" className="text-lg font-black text-slate-900">
              혜택 & 쿠폰함
            </h2>
          </div>

          {/* 깔끔한 쿠폰함 진입 메뉴 바 (요건 2) */}
          <button
            type="button"
            onClick={onOpenCoupons}
            className="w-full rounded-2xl bg-white p-4 shadow-xs border border-slate-200/80 hover:border-sky-300 hover:shadow-sm transition-all flex items-center justify-between group active:scale-[0.99] text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-xl text-[#1884F7] group-hover:bg-sky-100 transition-colors shrink-0">
                🎟️
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-900 group-hover:text-[#1884F7] transition-colors">
                  내 쿠폰함
                </span>
                <span className="text-xs font-semibold text-slate-400 mt-0.5">
                  보유 쿠폰 <strong className="text-[#1884F7]">{couponCount}장</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400 group-hover:text-[#1884F7] transition-colors">
              <ChevronRight className="size-5" />
            </div>
          </button>

          {/* 지역 상생 제휴 혜택 안내 뱃지 (요건 4) */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="text-base">🌱</span>
              <span className="font-semibold">
                지역 상생 제휴 혜택이 곧 추가될 예정입니다
              </span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
              COMING SOON
            </span>
          </div>
        </section>
      </main>

      {/* [1-1. 프로필 이미지 변경 모달 (내 사진 직접 등록 + 기본 캐릭터 5종)] */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[90dvh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">프로필 수정</h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="flex flex-col gap-5 p-5 overflow-y-auto">
              {/* 현재 선택된 아바타 미리보기 */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative size-20 rounded-full overflow-hidden border-2 border-[#1884F7] shadow-md bg-slate-100">
                  <Image
                    src={selectedAvatarUrl}
                    alt="선택된 프로필"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">프로필 미리보기</span>
              </div>

              {/* 닉네임 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">닉네임</label>
                <input
                  type="text"
                  maxLength={15}
                  value={editingNickname}
                  onChange={(e) => setEditingNickname(e.target.value)}
                  placeholder="닉네임 입력"
                  className="bg-slate-50 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800"
                />
              </div>

              {/* 1) [내 사진 직접 등록] */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">내 사진 직접 등록</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={profileFileInputRef}
                  onChange={handleProfileFileChange}
                  className="hidden"
                  id="profile-image-upload"
                />
                <label
                  htmlFor="profile-image-upload"
                  className="flex items-center justify-center gap-2 border border-slate-200 hover:border-[#1884F7] hover:bg-sky-50/50 rounded-xl py-2.5 cursor-pointer text-xs font-bold text-slate-700 hover:text-[#1884F7] transition-all"
                >
                  <Camera className="size-4" />
                  <span>{isCompressing ? '사진 최적화 중...' : '갤러리에서 사진 선택'}</span>
                </label>
              </div>

              {/* 2) [기본 캐릭터 아바타 5종 선택 팔레트 (고양이, 토끼, 곰, 강아지, 개구리)] */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">
                  기본 캐릭터 아바타 선택
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {DEFAULT_AVATARS.map((avatar) => {
                    const isSelected = selectedAvatarUrl === avatar.imageUrl
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarUrl(avatar.imageUrl)}
                        className={`group relative flex flex-col items-center gap-1 p-1 rounded-2xl border transition-all ${
                          isSelected
                            ? 'border-[#1884F7] ring-2 ring-[#1884F7]/30 bg-sky-50'
                            : 'border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`relative size-12 rounded-full overflow-hidden ${avatar.bgColor} shadow-2xs`}
                        >
                          <Image
                            src={avatar.imageUrl}
                            alt={avatar.name}
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-[#1884F7]/20 flex items-center justify-center">
                              <Check className="size-4 text-[#1884F7] stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600">
                          {avatar.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 저장 버튼 */}
              <button
                type="button"
                onClick={handleSaveProfile}
                className="w-full mt-2 bg-[#1884F7] hover:bg-[#0F75E8] text-white font-bold py-3 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all"
              >
                프로필 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [3-1. 포토 캘린더 다이어리 작성/수정 모달] */}
      {diaryModalOpen && selectedDateKey && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[90dvh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="size-4 text-[#1884F7]" />
                <h3 className="text-sm font-black text-slate-900">
                  {selectedDateKey} 일상 기록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiaryModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="flex flex-col gap-4 p-5 overflow-y-auto">
              {/* 사진 첨부 영역 (요건 1: '직접 촬영' / '사진 등록' 1:1 반반 분할 UI) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">축제/일상 사진</label>

                {/* 1) 모바일 카메라 즉시 실행 input */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={diaryCameraInputRef}
                  onChange={handleDiaryFileChange}
                  className="hidden"
                  id="diary-camera-upload"
                />

                {/* 2) 사진 보관함(앨범) input */}
                <input
                  type="file"
                  accept="image/*"
                  ref={diaryFileInputRef}
                  onChange={handleDiaryFileChange}
                  className="hidden"
                  id="diary-gallery-upload"
                />

                {diaryImageBase64 ? (
                  <div className="flex flex-col gap-2">
                    <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-2xs">
                      <Image
                        src={diaryImageBase64}
                        alt="다이어리 사진 미리보기"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDiaryImageBase64(null)}
                        className="absolute top-2.5 right-2.5 size-8 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-black/85 transition-colors shadow-xs"
                        aria-label="사진 삭제"
                        title="사진 삭제"
                      >
                        <X className="size-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 right-2 bg-black/55 backdrop-blur-2xs text-white text-[10px] font-semibold py-1 px-2.5 rounded-lg text-center">
                        ✨ 캘린더 날짜 칸에 사진 썸네일이 쏙 들어갑니다
                      </div>
                    </div>

                    {/* 사진 변경 및 재촬영 툴바 */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => diaryCameraInputRef.current?.click()}
                        disabled={isCompressing}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-[#1884F7] text-xs font-bold transition-all active:scale-95"
                      >
                        <Camera className="size-3.5 stroke-[2.2]" />
                        <span>다시 촬영</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => diaryFileInputRef.current?.click()}
                        disabled={isCompressing}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-[#1884F7] text-xs font-bold transition-all active:scale-95"
                      >
                        <ImageIcon className="size-3.5 stroke-[2.2]" />
                        <span>보관함 변경</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 좌측 버튼: [📷 바로 촬영] (capture="environment") */}
                    <button
                      type="button"
                      onClick={() => diaryCameraInputRef.current?.click()}
                      disabled={isCompressing}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/60 hover:bg-sky-50 hover:border-[#1884F7] text-slate-700 hover:text-[#1884F7] transition-all group active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <div className="size-11 rounded-2xl bg-white shadow-xs flex items-center justify-center text-[#1884F7] group-hover:scale-110 transition-transform">
                        <Camera className="size-5 stroke-[2.5]" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-[#1884F7]">
                          바로 촬영
                        </span>
                        <span className="text-[10px] text-slate-400">카메라 즉시 실행</span>
                      </div>
                    </button>

                    {/* 우측 버튼: [🖼️ 사진 보관함] (앨범/파일 탐색기) */}
                    <button
                      type="button"
                      onClick={() => diaryFileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-[#1884F7] text-slate-700 hover:text-[#1884F7] transition-all group active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <div className="size-11 rounded-2xl bg-white shadow-xs flex items-center justify-center text-slate-700 group-hover:text-[#1884F7] group-hover:scale-110 transition-transform">
                        <ImageIcon className="size-5 stroke-[2.2]" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-800 group-hover:text-[#1884F7]">
                          사진 보관함
                        </span>
                        <span className="text-[10px] text-slate-400">앨범에서 선택</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 한 줄 일기 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">한 줄 일기 / 소감</label>
                <textarea
                  rows={3}
                  value={diaryMemo}
                  onChange={(e) => setDiaryMemo(e.target.value)}
                  placeholder="오늘 다녀온 축제나 일상을 한 줄로 남겨보세요! (예: 억새밭 인생샷 건짐 🌾)"
                  className="w-full bg-slate-50 focus:bg-white rounded-xl p-3 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-normal text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>

              {/* 저장 및 삭제 버튼 */}
              <div className="flex items-center gap-2 pt-2">
                {photoDiaries[selectedDateKey] && (
                  <button
                    type="button"
                    onClick={handleDeleteDiary}
                    className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    title="기록 삭제"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveDiary}
                  className="flex-1 bg-[#1884F7] hover:bg-[#0F75E8] text-white font-bold py-3 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all"
                >
                  기록 저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [3-2. 커뮤니티 달력 공유 글쓰기 모달 (요건 2: 축제 광장 글쓰기)] */}
      {isCommunityShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[92dvh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  📅
                </div>
                <h3 className="text-sm font-black text-slate-900">축제 광장 글쓰기</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCommunityShareModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 모달 폼 */}
            <form onSubmit={handleSubmitSharePost} className="flex flex-col gap-4 p-5 overflow-y-auto">
              {/* 카테고리 선택 (요건 2 & 4: 세 번째 카테고리 '달력공유' 기본 활성화) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">카테고리</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['talk', 'photo', 'calendar'] as const).map((cat) => {
                    const info = CATEGORY_BADGES[cat]
                    const isSelected = shareCategory === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setShareCategory(cat)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                          isSelected
                            ? 'bg-[#1884F7] text-white border-[#1884F7] shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                        }`}
                      >
                        {info.shortLabel}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 작성자 닉네임 (프로필 닉네임 기본 지정, 수정 가능) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">작성자 닉네임</label>
                <input
                  type="text"
                  maxLength={15}
                  value={shareAuthorName}
                  onChange={(e) => setShareAuthorName(e.target.value)}
                  placeholder="닉네임 입력"
                  className="bg-slate-50 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800"
                />
              </div>

              {/* 본문 내용 (프리필 및 자유 수정) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">본문 내용</label>
                <textarea
                  rows={5}
                  value={shareContent}
                  onChange={(e) => setShareContent(e.target.value)}
                  placeholder="이번 달 축제 일상 기록 소감을 남겨보세요!"
                  className="w-full bg-slate-50 focus:bg-white rounded-xl p-3.5 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-normal text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                />
                <div className="flex justify-end text-[10px] text-slate-400">
                  {shareContent.length} / 500자
                </div>
              </div>

              {/* 첨부될 미니 포토 캘린더 미리보기 (요건 3) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  피드에 공유될 미니 포토 캘린더 미리보기
                </label>
                <MiniPhotoCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  diaries={photoDiaries}
                  showSummaryChips={true}
                  interactive={false}
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  ✨ 이번 달 캘린더에 기록된 사진 썸네일들이 피드 카드에 미니 달력 형태로 함께 게시됩니다.
                </p>
              </div>

              {/* 게시물 등록하기 버튼 */}
              <button
                type="submit"
                disabled={!shareContent.trim()}
                className="w-full mt-1 bg-[#1884F7] hover:bg-[#0F75E8] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all"
              >
                게시물 등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. 하단 고정 네비게이션 바: 홈, 행사, 커뮤니티, 마이(활성) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg">
        <div className="mx-auto max-w-md flex items-center justify-around py-2">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Home className="size-5" />
            <span>홈</span>
          </button>

          <button
            type="button"
            onClick={onOpenEvents}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <CalendarIcon className="size-5" />
            <span>행사</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommunity}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Users className="size-5" />
            <span>커뮤니티</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-[#1884F7] transition-colors"
          >
            <User className="size-5" />
            <span>마이</span>
          </button>
        </div>
      </nav>

      {/* 6. 로그인 / 회원가입 모달 */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        defaultTab={authModalTab}
      />
    </div>
  )
}
