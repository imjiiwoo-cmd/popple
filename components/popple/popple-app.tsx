'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { HomeScreen } from './home-screen'
import { AppHeader } from './app-header'
import { AreaSelect } from './area-select'
import { ImageInputZone } from './image-input-zone'
import { LoadingState } from './loading-state'
import { ResultCard } from './result-card'
import { EventDetail } from './event-detail'
import { EventsCalendarScreen } from './events-calendar-screen'
import { CommunityScreen } from './community-screen'
import { MyScreen } from './my-screen'
import { CouponScreen } from './coupon-screen'
import { PopupsScreen } from './popups-screen'
import { resizeImage } from '@/lib/resize-image'
import type { Recommendation } from '@/lib/types'
import type { PoppleEvent } from '@/lib/events'
import { recordEventClick } from '@/lib/ranking'
import { cn } from '@/lib/utils'

type LensStatus = 'idle' | 'loading' | 'result'
type ScreenMode = 'home' | 'events' | 'community' | 'my' | 'lens' | 'detail' | 'coupons' | 'popups'
type NavMode = 'home' | 'events' | 'community' | 'my' | 'lens' | 'coupons' | 'popups'

export function PoppleApp({
  initialMode = 'home',
  initialSearch,
}: {
  initialMode?: ScreenMode
  initialSearch?: string
} = {}) {
  const [mode, setMode] = useState<ScreenMode>(initialMode)
  const [previousMode, setPreviousMode] = useState<NavMode>(initialMode === 'lens' ? 'home' : initialMode as NavMode)

  const [file, setFile] = useState<File | null>(null)
  const [areaCode, setAreaCode] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [lensStatus, setLensStatus] = useState<LensStatus>('idle')
  const [result, setResult] = useState<Recommendation | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<PoppleEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleSelect(selected: File) {
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setError(null)
  }

  function reset() {
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    setSelectedEvent(null)
    setError(null)
    setLensStatus('idle')
  }

  async function handleRecommend() {
    if (!file) return
    setLensStatus('loading')
    setError(null)

    try {
      const body = new FormData()
      body.append('image', await resizeImage(file), 'photo.jpg')
      if (areaCode) {
        body.append('areaCode', areaCode)
      }

      const response = await fetch('/api/recommend', { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          data.error ??
            '현재 지역 내 진행 중인 행사 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.',
        )
      }

      setResult(data as Recommendation)
      setLensStatus('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const isTechnicalJson = msg.includes('{') || msg.includes('ApiError') || msg.includes('503')
      setError(
        isTechnicalJson || !msg
          ? '현재 지역 내 진행 중인 행사 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
          : msg,
      )
      setLensStatus('idle')
    }
  }

  // 이메일 로그인 / 매직링크 인증 완료 피드백 토스트 상태 (요건 2)
  const [loginToast, setLoginToast] = useState<{
    show: boolean
    message: string
  }>({
    show: false,
    message: '',
  })

  // 이메일 인증(매직링크 등) 완료 리다이렉트 감지 및 토스트 알림 처리
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. URL에서 매직링크/이메일 인증 리다이렉트 파라미터 감지 (#access_token, ?code=, type= 등)
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    const isAuthRedirect =
      hash.includes('access_token') ||
      hash.includes('type=signup') ||
      hash.includes('type=magiclink') ||
      hash.includes('type=recovery') ||
      hash.includes('type=invite') ||
      search.includes('code=')

    if (isAuthRedirect) {
      setLoginToast({
        show: true,
        message: '로그인이 완료되었습니다! 팝플에 오신 것을 환영합니다 🎉',
      })
      setMode('home')
      try {
        const cleanUrl = window.location.origin + window.location.pathname
        window.history.replaceState(null, '', cleanUrl)
      } catch {
        // ignore
      }
    }

    // 2. Supabase auth 리스너 (세션 체결 시점 포착)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const curHash = window.location.hash || ''
        const curSearch = window.location.search || ''
        const hasRedirectParam =
          curHash.includes('access_token') ||
          curHash.includes('type=') ||
          curSearch.includes('code=')

        if (hasRedirectParam || isAuthRedirect) {
          setLoginToast({
            show: true,
            message: '로그인이 완료되었습니다! 팝플에 오신 것을 환영합니다 🎉',
          })
          setMode('home')
          try {
            const cleanUrl = window.location.origin + window.location.pathname
            window.history.replaceState(null, '', cleanUrl)
          } catch {
            // ignore
          }
        }
      }
    })

    // 3. 전역 커스텀 이벤트 리스너 (일반 모달 등 로그인 성공 시 연동)
    const handleLoginSuccessEvent = () => {
      setLoginToast({
        show: true,
        message: '로그인이 완료되었습니다! 팝플에 오신 것을 환영합니다 🎉',
      })
      setMode('home')
    }
    window.addEventListener('popple-login-success', handleLoginSuccessEvent)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('popple-login-success', handleLoginSuccessEvent)
    }
  }, [])

  // 토스트 자동 닫힘 (4.5초)
  useEffect(() => {
    if (!loginToast.show) return
    const timer = setTimeout(() => {
      setLoginToast({ show: false, message: '' })
    }, 4500)
    return () => clearTimeout(timer)
  }, [loginToast.show])

  // 화면 모드별 렌더링 콘텐츠 생성
  let content: React.ReactNode = null

  // 1. 홈 화면 (피그마 홈 시안)
  if (mode === 'home') {
    content = (
      <HomeScreen
        initialSearch={initialSearch}
        onOpenEvents={() => {
          setMode('events')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCommunity={() => {
          setMode('community')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenMy={() => {
          setMode('my')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenLens={() => {
          setMode('lens')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCoupons={() => {
          setPreviousMode('home')
          setMode('coupons')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenPopups={() => {
          setPreviousMode('home')
          setMode('popups')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onSelectEvent={(ev) => {
          recordEventClick(ev)
          setSelectedEvent(ev)
          setPreviousMode('home')
          setMode('detail')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'events') {
    // 2. 행사 캘린더 화면 (피그마 주간 행사 캘린더 시안)
    content = (
      <EventsCalendarScreen
        onOpenHome={() => {
          setMode('home')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCommunity={() => {
          setMode('community')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenMy={() => {
          setMode('my')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenLens={() => {
          setMode('lens')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onSelectEvent={(ev) => {
          recordEventClick(ev)
          setSelectedEvent(ev)
          setPreviousMode('events')
          setMode('detail')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'community') {
    // 3. 커뮤니티 화면 (실시간 축제 톡 & 후기 피드)
    content = (
      <CommunityScreen
        onOpenHome={() => {
          setMode('home')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenEvents={() => {
          setMode('events')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenMy={() => {
          setMode('my')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenLens={() => {
          setMode('lens')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'my') {
    // 4. 마이페이지 화면 (프로필, 찜한 축제, 포토 캘린더, 쿠폰함)
    content = (
      <MyScreen
        onOpenHome={() => {
          setMode('home')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenEvents={() => {
          setMode('events')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCommunity={() => {
          setMode('community')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenLens={() => {
          setMode('lens')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onSelectEvent={(ev) => {
          recordEventClick(ev)
          setSelectedEvent(ev)
          setPreviousMode('my')
          setMode('detail')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCoupons={() => {
          setPreviousMode('my')
          setMode('coupons')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'coupons') {
    // 5. 전용 쿠폰함 화면
    content = (
      <CouponScreen
        onBack={() => {
          setMode(previousMode === 'coupons' ? 'my' : previousMode)
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenHome={() => {
          setMode('home')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenEvents={() => {
          setMode('events')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCommunity={() => {
          setMode('community')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenMy={() => {
          setMode('my')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'popups') {
    // 5-1. 실시간 핫한 팝업스토어 전용 화면
    content = (
      <PopupsScreen
        onBack={() => {
          setMode(previousMode === 'popups' ? 'home' : previousMode)
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onSelectEvent={(ev) => {
          recordEventClick(ev)
          setSelectedEvent(ev)
          setPreviousMode('popups')
          setMode('detail')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenHome={() => {
          setMode('home')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenEvents={() => {
          setMode('events')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenLens={() => {
          setMode('lens')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenCommunity={() => {
          setMode('community')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
        onOpenMy={() => {
          setMode('my')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
          }
        }}
      />
    )
  } else if (mode === 'detail' && selectedEvent) {
    // 6. 행사 상세 화면 (피그마 상세 시안)
    content = (
      <main className="min-h-dvh bg-slate-100 sm:px-4 sm:py-6 pb-24 sm:pb-28">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <EventDetail
            event={selectedEvent}
            onBack={() => {
              setMode(previousMode)
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
              }
            }}
          />
        </div>
      </main>
    )
  } else {
    // 7. Popple Lens 화면 (사진 기반 맞춤 행사 추천)
    content = (
      <main className="min-h-dvh bg-background px-5 py-4 animate-in fade-in duration-200">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <AppHeader
            onBack={() => {
              if (lensStatus === 'result') {
                reset()
              } else {
                setMode('home')
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                }
              }
            }}
            isResult={lensStatus === 'result'}
          />

          <div className="rounded-2xl bg-card p-5 shadow-card">
            {lensStatus === 'loading' && <LoadingState previewUrl={previewUrl} />}

            {lensStatus === 'result' && result && (
              <ResultCard
                result={result}
                onReset={reset}
                onSelectEvent={(ev) => {
                  recordEventClick(ev)
                  setSelectedEvent(ev)
                  setPreviousMode('lens')
                  setMode('detail')
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
                  }
                }}
              />
            )}

            {lensStatus === 'idle' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-muted-foreground">
                    추천받을 축제 지역
                  </span>
                  <AreaSelect value={areaCode} onChange={setAreaCode} />
                </div>

                <ImageInputZone
                  previewUrl={previewUrl}
                  onSelect={handleSelect}
                  onClear={reset}
                />

                {error && (
                  <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="button"
                  onClick={handleRecommend}
                  disabled={!file}
                  className="h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/30 disabled:shadow-none"
                >
                  <Sparkles className="size-5" aria-hidden="true" />
                  맞춤 행사 추천받기
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <>
      {/* 이메일 로그인 / 매직링크 인증 완료 피드백 Toast UI (요건 2) */}
      {loginToast.show && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-sm animate-in fade-in slide-in-from-top-6 duration-300 drop-shadow-2xl pointer-events-auto"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 text-white p-3.5 backdrop-blur-md border border-slate-700/60 shadow-2xl">
            <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-[#1884F7] to-sky-400 flex items-center justify-center text-xl shadow-md">
              🎉
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white tracking-tight leading-snug">
                로그인이 완료되었습니다!
              </p>
              <p className="text-[11px] text-sky-200 font-medium truncate mt-0.5">
                팝플에 오신 것을 환영합니다 🎉
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLoginToast({ show: false, message: '' })}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="닫기"
            >
              <X className="size-4" />
            </button>
          </div>
        </aside>
      )}
      {content}
    </>
  )
}
