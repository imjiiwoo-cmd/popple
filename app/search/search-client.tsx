'use client'

import { useSearchParams } from 'next/navigation'
import { PoppleApp } from '@/components/popple/popple-app'

export function SearchClient() {
  const searchParams = useSearchParams()
  const keyword =
    searchParams.get('keyword') ||
    searchParams.get('theme') ||
    searchParams.get('q') ||
    ''

  return <PoppleApp initialMode="home" initialSearch={keyword} />
}
