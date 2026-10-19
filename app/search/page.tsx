export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import { SearchClient } from './search-client'

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-slate-50 flex items-center justify-center">
          <div className="size-8 rounded-full border-3 border-sky-400 border-t-transparent animate-spin" />
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  )
}
