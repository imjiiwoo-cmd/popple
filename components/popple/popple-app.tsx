'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { resizeImage } from '@/lib/resize-image'
import type { Recommendation } from '@/lib/types'
import type { PoppleEvent } from '@/lib/events'
import { recordEventClick } from '@/lib/ranking'
import { cn } from '@/lib/utils'

type LensStatus = 'idle' | 'loading' | 'result'
type ScreenMode = 'home' | 'events' | 'community' | 'my' | 'lens' | 'detail' | 'coupons'
type NavMode = 'home' | 'events' | 'community' | 'my' | 'lens' | 'coupons'

export function PoppleApp() {
  const [mode, setMode] = useState<ScreenMode>('home')
  const [previousMode, setPreviousMode] = useState<NavMode>('home')

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
          data.error ?? '순간적인 접속량 증가로 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
        )
      }

      setResult(data as Recommendation)
      setLensStatus('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const isTechnicalJson = msg.includes('{') || msg.includes('ApiError') || msg.includes('503')
      setError(
        isTechnicalJson || !msg
          ? '순간적인 접속량 증가로 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
          : msg,
      )
      setLensStatus('idle')
    }
  }

  // 1. 홈 화면 (피그마 홈 시안)
  if (mode === 'home') {
    return (
      <HomeScreen
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
  }

  // 2. 행사 캘린더 화면 (피그마 주간 행사 캘린더 시안)
  if (mode === 'events') {
    return (
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
  }

  // 3. 커뮤니티 화면 (실시간 축제 톡 & 후기 피드)
  if (mode === 'community') {
    return (
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
  }

  // 4. 마이페이지 화면 (프로필, 찜한 축제, 포토 캘린더, 쿠폰함)
  if (mode === 'my') {
    return (
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
  }

  // 5. 전용 쿠폰함 화면
  if (mode === 'coupons') {
    return (
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
  }

  // 4. 행사 상세 화면 (피그마 상세 시안)
  if (mode === 'detail' && selectedEvent) {
    return (
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
  }

  // 3. Popple Lens 화면 (사진 기반 맞춤 행사 추천)
  return (
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
