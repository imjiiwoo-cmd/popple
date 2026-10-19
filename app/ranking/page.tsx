export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { RankingScreen } from '@/components/popple/ranking-screen'

export default function RankingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-slate-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="size-8 border-2 border-[#1884F7] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">최신 랭킹 목록을 불러오는 중...</p>
          </div>
        </div>
      }
    >
      <RankingScreen />
    </Suspense>
  )
}
