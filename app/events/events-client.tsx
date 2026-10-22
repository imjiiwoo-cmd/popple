'use client'

import { useSearchParams } from 'next/navigation'
import { PoppleApp } from '@/components/popple/popple-app'

export function EventsClient() {
  const searchParams = useSearchParams()
  const category = (searchParams.get('category') || '').toLowerCase()
  const isPopup = category === 'popup' || category === 'popups' || category === '팝업'

  return <PoppleApp initialMode={isPopup ? 'popups' : 'events'} />
}
