import { Loader2 } from 'lucide-react'

export function LoadingState({ previewUrl }: { previewUrl: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-6 py-10 text-center"
    >
      <div className="relative flex size-28 items-center justify-center">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-2 size-24 rounded-full object-cover opacity-60"
          />
        )}
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Loader2 className="size-7 animate-spin" aria-hidden="true" />
        </span>
      </div>

      <div className="flex w-full flex-col gap-3">
        <p className="text-pretty font-semibold text-foreground">
          팝플이 사진의 무드와 감성을 분석하고 있어요...
        </p>
        <div className="mx-auto h-1.5 w-3/4 overflow-hidden rounded-full bg-secondary">
          <div className="popple-progress h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  )
}
