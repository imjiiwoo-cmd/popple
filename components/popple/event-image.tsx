'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * 유효하지 않거나 가짜 일러스트인지 확인하는 함수
 */
export function isInvalidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true
  const trimmed = url.trim()
  if (!trimmed) return true
  if (
    trimmed.includes('jazz-picnic') ||
    trimmed.includes('rock-festival') ||
    trimmed.includes('placeholder-image')
  ) {
    return true
  }
  return false
}

export interface PoppleImageFallbackProps {
  className?: string
  logoClassName?: string
  text?: string
}

/**
 * Popple 브랜드 공식 로고 기반 Fallback 컴포넌트
 * - 배경: 부드러운 연회색/미색 톤 (bg-slate-50)
 * - 중앙 상단: 3D 비눗방울 로고 (/images/logo-bubble.png, mix-blend-multiply, w-3/4 max-w-[200px])
 * - 중앙 하단: "이미지 준비 중입니다" 텍스트 (-mt-1 sm:-mt-0.5, text-xs text-slate-400 font-medium)
 */
export function PoppleImageFallback({
  className,
  logoClassName,
  text = '이미지 준비 중입니다',
}: PoppleImageFallbackProps) {
  return (
    <div
      className={cn(
        'w-full h-full flex flex-col items-center justify-center bg-slate-50 select-none p-2 sm:p-2.5 text-center border border-slate-100/60',
        className,
      )}
    >
      <div className="relative flex flex-col items-center justify-center w-full">
        <Image
          src="/images/logo-bubble.png"
          alt="Popple"
          width={1024}
          height={532}
          unoptimized
          className={cn(
            'w-3/4 max-w-[200px] h-auto object-contain mix-blend-multiply opacity-85 pointer-events-none drop-shadow-2xs transition-transform',
            logoClassName,
          )}
        />
        <span className="-mt-1 sm:-mt-0.5 text-xs text-slate-400 font-medium tracking-tight truncate max-w-full px-1 select-none">
          {text}
        </span>
      </div>
    </div>
  )
}

export interface EventImageProps {
  src?: string | null
  alt?: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  fallbackClassName?: string
  logoClassName?: string
  fallbackText?: string
  sizes?: string
  priority?: boolean
  unoptimized?: boolean
}

/**
 * 포스터 이미지를 렌더링하고, 이미지가 없거나 로딩 실패(onError) 시
 * 공식 Popple 로고 Fallback UI를 자동으로 표시하는 공통 컴포넌트
 */
export function EventImage({
  src,
  alt = '행사 포스터',
  fill = true,
  width,
  height,
  className,
  fallbackClassName,
  logoClassName,
  fallbackText = '이미지 준비 중입니다',
  sizes,
  priority,
  unoptimized = true,
}: EventImageProps) {
  const [hasError, setHasError] = useState(false)
  const isInvalid = isInvalidImageUrl(src)

  if (isInvalid || hasError) {
    return (
      <PoppleImageFallback
        className={fallbackClassName}
        logoClassName={logoClassName}
        text={fallbackText}
      />
    )
  }

  return (
    <Image
      src={src!}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  )
}
