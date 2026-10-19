'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  Search,
  Camera,
  Bell,
  Heart,
  MessageCircle,
  Share2,
  Send,
  Plus,
  X,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  Home,
  Calendar,
  Users,
  User,
  Check,
} from 'lucide-react'
import {
  type CommunityCategory,
  type CommunityPost,
  type CommunityComment,
  CATEGORY_TABS,
  CATEGORY_BADGES,
  getCommunityPosts,
  saveCommunityPosts,
  formatRelativeTime,
  getRandomAvatarColor,
  compressImageFileToBase64,
} from '@/lib/community'
import { MiniPhotoCalendar } from './mini-photo-calendar'
import { getUserProfile, getPhotoDiaries } from '@/lib/mypage'
import { supabase } from '@/lib/supabaseClient'

interface CommunityScreenProps {
  onOpenHome: () => void
  onOpenEvents: () => void
  onOpenLens: () => void
  onOpenMy?: () => void
}

export function CommunityScreen({
  onOpenHome,
  onOpenEvents,
  onOpenLens,
  onOpenMy,
}: CommunityScreenProps) {
  // 상태 관리
  const [selectedCategory, setSelectedCategory] = useState<CommunityCategory>('all')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // 글쓰기 모달/폼 상태
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  const [writeCategory, setWriteCategory] = useState<'talk' | 'photo' | 'calendar'>('talk')
  const [authorName, setAuthorName] = useState('익명팝플')
  const [postContent, setPostContent] = useState('')
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  // 각 게시물별 댓글창 토글 및 댓글 입력 상태 관리 (postId -> string)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [commentAuthors, setCommentAuthors] = useState<Record<string, string>>({})

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 1. 초기 로드 (localStorage 및 Supabase 세션 동기화)
  useEffect(() => {
    const loaded = getCommunityPosts()
    setPosts(loaded)
    setIsLoaded(true)
    const profile = getUserProfile()
    if (profile && profile.nickname) {
      setAuthorName(profile.nickname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const metaNickname = session?.user?.user_metadata?.nickname
      if (metaNickname) {
        setAuthorName(metaNickname)
      }
    })
  }, [])

  // 글쓰기 모달 열기 시 최신 닉네임 동기화
  const handleOpenWriteModal = () => {
    const profile = getUserProfile()
    if (profile && profile.nickname) {
      setAuthorName(profile.nickname)
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const metaNickname = session?.user?.user_metadata?.nickname
      if (metaNickname) {
        setAuthorName(metaNickname)
      }
    })
    setIsWriteModalOpen(true)
  }

  // 2. 스크롤 감지 (상단 이동 플로팅 버튼)
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 카테고리 필터링된 게시글 목록
  const filteredPosts = posts.filter((p) => {
    if (selectedCategory === 'all') return true
    return p.category === selectedCategory
  })

  // 이미지 파일 첨부 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(jpg, png 등)만 업로드할 수 있습니다.')
      return
    }

    setIsCompressing(true)
    try {
      const base64 = await compressImageFileToBase64(file)
      setAttachedImageBase64(base64)
    } catch (err) {
      console.error(err)
      alert('이미지 처리 중 문제가 발생했습니다.')
    } finally {
      setIsCompressing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 첨부 이미지 삭제
  const handleRemoveImage = () => {
    setAttachedImageBase64(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 새 게시글 등록 핸들러
  const handleCreatePost = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = postContent.trim()
    if (!trimmed) {
      alert('공유할 축제 소식이나 내용을 입력해주세요!')
      return
    }

    const diaries = getPhotoDiaries()
    const isCalendar = writeCategory === 'calendar'

    const newPost: CommunityPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: writeCategory,
      author: authorName.trim() || '익명팝플',
      avatarColor: getRandomAvatarColor(),
      content: trimmed,
      imageUrl: attachedImageBase64 || (isCalendar ? '/events/autumn-walk.jpg' : undefined),
      calendarYear: isCalendar ? 2026 : undefined,
      calendarMonth: isCalendar ? 10 : undefined,
      calendarDiaries: isCalendar ? diaries : undefined,
      createdAt: Date.now(),
      likes: 0,
      likedByUser: false,
      comments: [],
    }

    const updated = [newPost, ...posts]
    setPosts(updated)
    saveCommunityPosts(updated)

    // 폼 초기화 및 모달 닫기
    setPostContent('')
    setAttachedImageBase64(null)
    setIsWriteModalOpen(false)

    // 맨 위로 부드럽게 스크롤
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 좋아요 토글 핸들러
  const handleToggleLike = (postId: string) => {
    const updated = posts.map((post) => {
      if (post.id === postId) {
        const isLiked = post.likedByUser
        return {
          ...post,
          likedByUser: !isLiked,
          likes: isLiked ? Math.max(0, post.likes - 1) : post.likes + 1,
        }
      }
      return post
    })
    setPosts(updated)
    saveCommunityPosts(updated)
  }

  // 댓글 접기/펼치기 토글
  const handleToggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }))
  }

  // 댓글 등록 핸들러
  const handleAddComment = (postId: string) => {
    const text = (commentInputs[postId] || '').trim()
    if (!text) return

    const author = (commentAuthors[postId] || '').trim() || '익명팝플'

    const newComment: CommunityComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author,
      content: text,
      createdAt: Date.now(),
    }

    const updated = posts.map((p) => {
      if (p.id === postId) {
        return {
          ...p,
          comments: [...p.comments, newComment],
        }
      }
      return p
    })

    setPosts(updated)
    saveCommunityPosts(updated)

    // 인풋창 초기화
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
    // 자동으로 댓글 목록 펼치기
    setExpandedComments((prev) => ({ ...prev, [postId]: true }))
  }

  return (
    <div className="relative flex flex-col min-h-dvh bg-slate-50 text-slate-900 pb-24">
      {/* 1. 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between gap-2.5">
          {/* 좌측 Popple 로고 & 서브 타이틀 */}
          <div
            onClick={onOpenHome}
            className="shrink-0 cursor-pointer flex items-center gap-2"
            title="홈으로 가기"
          >
            <Image
              src="/images/popple-logo.png"
              alt="Popple"
              width={88}
              height={32}
              priority
              className="h-7 w-auto object-contain"
            />
            <span className="text-xs font-black text-[#1884F7] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
              커뮤니티
            </span>
          </div>

          {/* 우측 액션 버튼: [📷 렌즈 추천] & [🔔 알림] */}
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenLens}
              aria-label="사진 기반 맞춤 행사 추천"
              title="사진 기반 맞춤 추천"
              className="relative p-2 rounded-full text-slate-700 hover:bg-sky-50 hover:text-[#1884F7] transition-all"
            >
              <Camera className="size-5 stroke-[2]" />
            </button>
            <button
              type="button"
              aria-label="알림"
              className="relative p-2 rounded-full text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Bell className="size-5 stroke-[2]" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="mx-auto w-full max-w-md px-4 py-3 flex flex-col gap-4">
        {/* 상단 안내 & 간편 글쓰기 유도 카드 */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-[#1884F7] p-4 text-white shadow-sm flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-yellow-300" />
              <span className="text-[11px] font-black tracking-wider uppercase text-sky-100">
                실시간 축제 광장
              </span>
            </div>
            <span className="text-[10px] font-bold bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full">
              LIVE SQUARE
            </span>
          </div>
          <div>
            <h2 className="text-base font-black leading-snug">
              지금 현장은 어떤가요? 자유롭게 소통해요!
            </h2>
            <p className="text-xs text-sky-100 mt-0.5 font-medium">
              대기 줄, 포토존 명당, 솔직한 방문 후기를 실시간으로 나눠보세요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenWriteModal}
            className="mt-1 flex items-center justify-between w-full bg-white text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold shadow-xs hover:bg-slate-50 active:scale-[0.99] transition-all"
          >
            <span className="text-slate-400">축제 소식이나 궁금한 점을 적어보세요...</span>
            <div className="flex items-center gap-1 text-[#1884F7] font-bold">
              <span>글쓰기</span>
              <Plus className="size-4 stroke-[2.5]" />
            </div>
          </button>
        </div>

        {/* [1. 상단 카테고리 필터 탭 (가로 스크롤 둥근 칩 버튼)] */}
        <section aria-label="커뮤니티 카테고리 필터" className="overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          <div className="flex items-center gap-2">
            {CATEGORY_TABS.map((tab) => {
              const isSelected = selectedCategory === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all select-none active:scale-95 ${
                    isSelected
                      ? 'bg-[#1884F7] text-white shadow-xs ring-2 ring-[#1884F7]/25'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* [3. 실시간 피드 및 카드 UI] */}
        <section aria-label="실시간 게시글 피드" className="flex flex-col gap-3.5 pt-1">
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 text-center gap-3 shadow-xs">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <MessageCircle className="size-6 stroke-[1.8]" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-bold text-slate-800">
                  아직 등록된 게시글이 없습니다
                </p>
                <p className="text-xs text-slate-500 break-keep">
                  가장 먼저 축제 현장 소식이나 궁금한 점을 남겨보세요!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 bg-[#1884F7] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs hover:bg-[#0F75E8] active:scale-95 transition-all"
              >
                <Plus className="size-4" />
                첫 게시글 남기기
              </button>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const badgeInfo = CATEGORY_BADGES[post.category]
              const isCommentsOpen = !!expandedComments[post.id]
              const commentInput = commentInputs[post.id] || ''

              return (
                <article
                  key={post.id}
                  className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:border-slate-300/80 flex flex-col gap-3"
                >
                  {/* 작성자 프로필 & 카테고리 뱃지 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-9 rounded-full ${post.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-xs`}
                      >
                        {post.author.slice(0, 1)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          {post.author}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badgeInfo.badgeClass}`}
                    >
                      {badgeInfo.label}
                    </span>
                  </div>

                  {/* 본문 텍스트 */}
                  <div className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap break-words">
                    {post.content}
                  </div>

                  {/* 카테고리별 비주얼 렌더링: '달력공유'는 미니 포토 캘린더, 그 외는 단일 사진 */}
                  {post.category === 'calendar' ? (
                    <div className="w-full">
                      <MiniPhotoCalendar
                        year={post.calendarYear ?? 2026}
                        month={post.calendarMonth ?? 10}
                        diaries={post.calendarDiaries ?? {}}
                        showSummaryChips={true}
                        interactive={true}
                      />
                    </div>
                  ) : post.imageUrl ? (
                    <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-2xs">
                      <Image
                        src={post.imageUrl}
                        alt="축제 현장 사진"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  ) : null}

                  {/* 반응 버튼 영역: 좋아요(❤️), 댓글(💬) */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500 font-semibold">
                    <div className="flex items-center gap-4">
                      {/* 좋아요 버튼 (토글 & 실시간 숫자 반영) */}
                      <button
                        type="button"
                        onClick={() => handleToggleLike(post.id)}
                        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors active:scale-90 ${
                          post.likedByUser
                            ? 'text-red-500 bg-red-50'
                            : 'hover:text-slate-700 hover:bg-slate-50'
                        }`}
                        title="좋아요"
                      >
                        <Heart
                          className={`size-4 stroke-[2] ${
                            post.likedByUser ? 'fill-red-500 text-red-500' : ''
                          }`}
                        />
                        <span>{post.likes}</span>
                      </button>

                      {/* 댓글 토글 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleToggleComments(post.id)}
                        className="flex items-center gap-1.5 py-1 px-2 rounded-lg hover:text-slate-700 hover:bg-slate-50 transition-colors"
                        title="댓글 보기"
                      >
                        <MessageCircle className="size-4 stroke-[2]" />
                        <span>댓글 {post.comments.length}</span>
                      </button>
                    </div>

                    {/* 공유 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(window.location.href)
                          alert('게시글 링크가 클립보드에 복사되었습니다!')
                        }
                      }}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="공유하기"
                    >
                      <Share2 className="size-4" />
                    </button>
                  </div>

                  {/* 댓글 섹션 (열려있거나 댓글이 있을 때) */}
                  {isCommentsOpen && (
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100/80 animate-in fade-in duration-150">
                      {/* 댓글 목록 */}
                      {post.comments.length > 0 && (
                        <div className="flex flex-col gap-2 bg-slate-50/80 rounded-2xl p-3">
                          {post.comments.map((comm) => (
                            <div key={comm.id} className="flex flex-col gap-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {comm.author}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatRelativeTime(comm.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-700 break-words">{comm.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 댓글 작성 인풋창 */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleAddComment(post.id)
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          placeholder="한 줄 댓글을 남겨보세요..."
                          value={commentInput}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-slate-100 hover:bg-slate-100/90 focus:bg-white focus:ring-2 focus:ring-[#1884F7]/25 rounded-xl px-3 py-2 text-xs border border-slate-200/80 focus:outline-none transition-all placeholder:text-slate-400"
                        />
                        <button
                          type="submit"
                          disabled={!commentInput.trim()}
                          className="size-8 shrink-0 flex items-center justify-center rounded-xl bg-[#1884F7] text-white disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 transition-all shadow-2xs"
                          aria-label="댓글 등록"
                        >
                          <Send className="size-3.5" />
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </section>
      </main>

      {/* 우측 하단 플로팅 글쓰기 버튼 (FAB) */}
      <div className="fixed bottom-[74px] right-4 z-30">
        <button
          type="button"
          onClick={handleOpenWriteModal}
          aria-label="새 글 작성하기"
          className="flex items-center gap-1.5 bg-[#1884F7] hover:bg-[#0F75E8] text-white px-4 py-3 rounded-full shadow-lg shadow-sky-500/30 active:scale-95 transition-all font-bold text-xs"
        >
          <Plus className="size-4 stroke-[3]" />
          <span>글쓰기</span>
        </button>
      </div>

      {/* 플로팅 최상단 스크롤 버튼 (^) */}
      <div
        className={`fixed bottom-[74px] left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          showScrollTop
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-75 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="최상단으로 이동"
          className="flex items-center justify-center size-10 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md text-slate-700 hover:text-[#1884F7] hover:border-sky-300 active:scale-90 transition-all"
        >
          <ChevronUp className="size-5 stroke-[2.5]" />
        </button>
      </div>

      {/* [2. 간편 글쓰기 모달 창] */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col max-h-[90dvh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#1884F7]" />
                <h3 className="text-sm font-black text-slate-900">축제 광장 글쓰기</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label="닫기"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* 모달 폼 바디 */}
            <form onSubmit={handleCreatePost} className="flex flex-col gap-4 p-5 overflow-y-auto">
              {/* 카테고리 선택 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">카테고리</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['talk', 'photo', 'calendar'] as const).map((cat) => {
                    const info = CATEGORY_BADGES[cat]
                    const isSelected = writeCategory === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setWriteCategory(cat)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                          isSelected
                            ? 'bg-[#1884F7] text-white border-[#1884F7] shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                        }`}
                      >
                        {info.shortLabel || info.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 닉네임 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">닉네임</label>
                <input
                  type="text"
                  maxLength={15}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="닉네임 입력 (기본: 익명팝플)"
                  className="bg-slate-50 focus:bg-white rounded-xl px-3.5 py-2 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800"
                />
              </div>

              {/* 본문 텍스트에어리어 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">본문 내용</label>
                <textarea
                  rows={5}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="지금 축제 현장 소식이나 궁금한 점을 공유해보세요! (예: 대기 시간, 주차 팁, 포토존 위치 등)"
                  className="w-full bg-slate-50 focus:bg-white rounded-xl p-3.5 text-xs border border-slate-200/80 focus:border-[#1884F7] focus:outline-none transition-colors font-normal text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                />
                <div className="flex justify-end text-[10px] text-slate-400">
                  {postContent.length} / 500자
                </div>
              </div>

              {/* 사진 첨부 기능 또는 달력 첨부 미리보기 */}
              {writeCategory === 'calendar' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">첨부될 포토 캘린더</label>
                    <span className="text-[10px] text-[#1884F7] font-bold">마이페이지 일상기록 연동</span>
                  </div>
                  <MiniPhotoCalendar
                    year={2026}
                    month={10}
                    diaries={getPhotoDiaries()}
                    showSummaryChips={true}
                    interactive={false}
                  />
                  <p className="text-[11px] text-slate-500 font-medium">
                    ✨ 마이페이지 캘린더에 저장된 이번 달 사진 썸네일들이 피드 카드에 미니 달력 형태로 함께 공유됩니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">현장 사진 첨부</label>
                    <span className="text-[10px] text-slate-400">최대 1장 (자동 최적화)</span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="community-image-input"
                  />

                  {attachedImageBase64 ? (
                    <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                      <Image
                        src={attachedImageBase64}
                        alt="첨부된 사진 미리보기"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        aria-label="사진 삭제"
                        className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="community-image-input"
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-[#1884F7]/40 rounded-2xl p-4 cursor-pointer text-slate-500 hover:text-[#1884F7] hover:bg-sky-50/50 transition-all"
                    >
                      <ImageIcon className="size-4" />
                      <span className="text-xs font-bold">
                        {isCompressing ? '사진 최적화 중...' : '사진 선택하기'}
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* 하단 제출 버튼 */}
              <button
                type="submit"
                disabled={!postContent.trim() || isCompressing}
                className="w-full mt-1 bg-[#1884F7] hover:bg-[#0F75E8] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all"
              >
                게시물 등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. 하단 고정 네비게이션 바: 홈, 행사, 커뮤니티(활성), 마이 */}
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
            <Calendar className="size-5" />
            <span>행사</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-[#1884F7] transition-colors"
          >
            <Users className="size-5" />
            <span>커뮤니티</span>
          </button>

          <button
            type="button"
            onClick={onOpenMy}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <User className="size-5" />
            <span>마이</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
