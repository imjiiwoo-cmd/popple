import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'

type AppHeaderProps = {
  onBack: () => void
  isResult?: boolean
}

export function AppHeader({ onBack, isResult = false }: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="홈으로 돌아가기"
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>
        <h1>
          <Image
            src="/images/popple-logo.png"
            alt="팝플 Popple"
            width={1100}
            height={436}
            priority
            className="h-9 w-auto"
          />
        </h1>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-widest text-primary">POPPLE LENS</span>
        <p className="text-balance text-xl font-bold leading-snug text-foreground">
          사진 한 장으로 찾는 <span className="text-primary">맞춤</span> 행사
        </p>
        {!isResult && (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            나만의 무드를 담은 사진을 촬영해보세요. 팝플이 딱 맞는 행사를 찾아드릴게요!
          </p>
        )}
      </div>
    </header>
  )
}
