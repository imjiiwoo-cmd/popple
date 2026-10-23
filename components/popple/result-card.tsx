'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ImageOff, MapPin, RotateCcw, Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Recommendation } from '@/lib/types'
import type { PoppleEvent } from '@/lib/events'
import { EventImage } from './event-image'

type ResultCardProps = {
  result: Recommendation
  onReset: () => void
  onSelectEvent?: (event: PoppleEvent) => void
}

function SubEventCard({ event, onClick }: { event: PoppleEvent; onClick?: () => void }) {
  const [failed, setFailed] = useState(false)
  const imageSrc = event.imageUrl || event.poster || ''

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card p-2.5 shadow-xs transition-all hover:border-primary/50 hover:bg-accent/30 active:scale-[0.99]"
    >
      <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        <EventImage
          src={imageSrc}
          alt={`${event.title} 포스터`}
          fill
          sizes="60px"
          className="aspect-[3/4] h-full w-full object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 break-keep">
        <h4 className="text-sm font-bold text-foreground line-clamp-1 leading-snug">
          {event.title}
        </h4>
        <p className="text-xs text-muted-foreground font-medium">
          {event.date}
        </p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80 line-clamp-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span>{event.location}</span>
        </p>
      </div>

      <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </article>
  )
}

export function ResultCard({ result, onReset, onSelectEvent }: ResultCardProps) {
  const { event } = result
  const [posterFailed, setPosterFailed] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(true)

  const imageSrc = event.imageUrl || event.poster || ''
  const categoryLabel = event.category || (event.tags && event.tags[0]) || '추천'

  const moodTags =
    result.mood_tags ||
    (result.keywords && result.keywords.map((k) => (k.startsWith('#') ? k : `#${k}`))) ||
    []

  const detailedReason = result.detailed_reason || {
    visual_mood: result.comment || '감각적인 조명과 색 대비',
    event_feature:
      (event.tags && event.tags.join(', ')) || event.description || '현장의 에너지를 느낄 수 있는 행사',
    match_reason:
      result.reason ||
      `사진에서 느껴지는 무드와 "${event.title}"의 현장 분위기가 잘 어울려요.`,
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-3 duration-400">
      {/* 지역 전환 안내 배너 */}
      {result.area_notice && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 animate-in fade-in">
          <span className="text-sm">💡</span>
          <span>{result.area_notice}</span>
        </div>
      )}

      {/* 1. 상단 AI 무드 분석 요약 */}
      <section aria-labelledby="mood-title" className="flex flex-col gap-2.5">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-widest text-primary">AI MOOD ANALYSIS</span>
          <h2 id="mood-title" className="text-lg font-bold text-foreground">
            사진에서 발견한 무드
          </h2>
        </div>

        {/* mood_tags 해시태그 칩들 */}
        {moodTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {moodTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 연한 하늘색 배경 박스 (Sparkle 아이콘 + mood_headline + mood_summary) */}
        <div className="flex items-start gap-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-800/60 p-3.5 text-sky-950 dark:text-sky-100">
          <Sparkles
            className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-sky-900 dark:text-sky-200 leading-snug">
              {result.mood_headline || '사진에서 느껴지는 특별한 분위기'}
            </p>
            <p className="text-xs leading-relaxed text-sky-800/90 dark:text-sky-300/90">
              {result.mood_summary || result.comment}
            </p>
          </div>
        </div>
      </section>

      {/* 2. 메인 추천 행사 카드 */}
      <section aria-labelledby="pick-title" className="flex flex-col gap-2.5">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-widest text-primary">POPPLE PICK</span>
          <h2 id="pick-title" className="text-lg font-bold text-foreground">
            이 사진에 <span className="text-primary">딱 맞는</span> 행사
          </h2>
        </div>

        <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex gap-3.5">
            {/* 포스터 이미지 */}
            <div className="relative aspect-[3/4] w-[40%] shrink-0 self-start overflow-hidden rounded-xl bg-muted">
              <EventImage
                src={imageSrc}
                alt={`${event.title} 포스터`}
                fill
                priority
                sizes="(max-width: 640px) 40vw, 200px"
                className="aspect-[3/4] h-full w-full object-cover"
              />
              <span className="absolute top-2 left-2 z-10 rounded-md bg-destructive/90 px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm backdrop-blur-xs">
                {categoryLabel}
              </span>
            </div>

            {/* 행사 세부 정보 */}
            <div className="flex min-w-0 flex-1 flex-col justify-between break-keep py-0.5">
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="text-balance text-base font-bold leading-snug text-foreground">
                    {event.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSaved((v) => !v)}
                    aria-pressed={saved}
                    aria-label={saved ? '찜 해제' : '찜하기'}
                    className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <Star
                      className={cn(
                        'size-4.5',
                        saved ? 'fill-primary text-primary' : 'text-muted-foreground/50',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <dl className="flex flex-col gap-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-9 shrink-0 text-muted-foreground">기간</dt>
                    <dd className="font-semibold text-foreground line-clamp-1">{event.date}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-9 shrink-0 text-muted-foreground">입장료</dt>
                    <dd className="font-semibold text-foreground">{event.price}</dd>
                  </div>
                  <div className="flex items-start gap-1 text-muted-foreground">
                    <dt>
                      <MapPin className="mt-0.5 size-3.5" aria-hidden="true" />
                      <span className="sr-only">장소</span>
                    </dt>
                    <dd className="line-clamp-1">{event.location}</dd>
                  </div>
                </dl>

                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {event.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ✨ 왜 이 행사를 추천했을까요? 아코디언 토글 */}
          <div className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              onClick={() => setReasonOpen((v) => !v)}
              aria-expanded={reasonOpen}
              aria-controls="accordion-reason-panel"
              className="flex w-full items-center justify-between rounded-xl bg-accent/60 px-3 py-2 text-xs font-bold text-accent-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="flex items-center gap-1.5">
                <span>✨</span>
                <span>왜 이 행사를 추천했을까요?</span>
              </span>
              <ChevronDown
                className={cn('size-3.5 transition-transform duration-200', reasonOpen && 'rotate-180')}
                aria-hidden="true"
              />
            </button>

            {/* 아코디언 패널 내용 */}
            {reasonOpen && (
              <div
                id="accordion-reason-panel"
                className="mt-2.5 flex flex-col gap-2 rounded-xl bg-muted/60 p-3.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <h4 className="text-[11px] font-bold text-primary tracking-wide">
                  사진의 특징과 행사의 연결점
                </h4>
                <ul className="flex flex-col gap-2 text-foreground/90 leading-relaxed text-[11.5px]">
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0 font-bold text-foreground">• 시각적 분위기:</span>
                    <span>{detailedReason.visual_mood}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0 font-bold text-foreground">• 행사의 특징:</span>
                    <span>{detailedReason.event_feature}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="shrink-0 font-bold text-foreground">• 추천 이유:</span>
                    <span>{detailedReason.match_reason}</span>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* 행사 상세페이지 바로가기 버튼 */}
          <button
            type="button"
            onClick={() => onSelectEvent?.(event)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs py-2.5 transition-colors active:scale-[0.99]"
          >
            <span>행사 상세 정보 및 위치/후기 보기</span>
            <ChevronDown className="size-3.5 -rotate-90" aria-hidden="true" />
          </button>
        </article>
      </section>

      {/* 3. 다른 사진으로 다시 찾기 버튼 */}
      <Button
        type="button"
        variant="outline"
        onClick={onReset}
        className="h-11 rounded-2xl border-primary/30 text-sm font-semibold text-primary hover:bg-accent hover:text-primary transition-all"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        다른 사진으로 다시 찾기
      </Button>

      {/* 4 & 5. 연관 행사 더보기 (서브 축제 2개 미니 카드) */}
      {result.sub_events && result.sub_events.length > 0 && (
        <section aria-labelledby="sub-events-title" className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <h3 id="sub-events-title" className="text-sm font-bold text-foreground">
            연관 행사 더보기
          </h3>
          <div className="flex flex-col gap-2.5">
            {result.sub_events.slice(0, 2).map((subEvent) => (
              <SubEventCard
                key={subEvent.id}
                event={subEvent}
                onClick={() => onSelectEvent?.(subEvent)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
