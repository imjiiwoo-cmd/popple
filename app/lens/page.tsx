export const dynamic = 'force-dynamic'
export const revalidate = 0

import { PoppleApp } from '@/components/popple/popple-app'

export default function LensPage() {
  return <PoppleApp initialMode="lens" />
}
