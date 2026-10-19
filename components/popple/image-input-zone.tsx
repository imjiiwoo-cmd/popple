'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Camera, Images, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const EXAMPLE_TAGS = ['뮤직페스티벌', '팝업스토어', '야시장', '굿즈', '불꽃축제']

type ImageInputZoneProps = {
  previewUrl: string | null
  onSelect: (file: File) => void
  onClear: () => void
}

export function ImageInputZone({ previewUrl, onSelect, onClear }: ImageInputZoneProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (file && file.type.startsWith('image/')) onSelect(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  if (previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
        <img
          src={previewUrl}
          alt="선택한 사진 미리보기"
          className="aspect-[4/3] w-full object-cover"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onClear}
          aria-label="사진 지우고 다시 찍기"
          className="absolute top-3 right-3 h-9 gap-1 rounded-full bg-background/90 px-3 text-foreground shadow-sm backdrop-blur hover:bg-background"
        >
          <X aria-hidden="true" />
          다시 찍기
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl bg-primary px-3 py-6 text-primary-foreground shadow-lg shadow-primary/30 transition-transform outline-none active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-foreground/15">
            <Camera className="size-7" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-bold">바로 촬영하기</span>
            <span className="text-xs text-primary-foreground/80">카메라 열기</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-primary/30 bg-card px-3 py-6 text-primary transition-[transform,background-color] outline-none hover:bg-accent active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-ring/40"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-accent">
            <Images className="size-7" aria-hidden="true" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-bold">앨범에서 선택</span>
            <span className="text-xs text-muted-foreground">갤러리 · 파일</span>
          </span>
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-2.5 text-xs transition-colors',
          isDragging
            ? 'border-primary bg-accent text-primary'
            : 'border-border text-muted-foreground',
        )}
      >
        <Upload className="size-3.5 shrink-0" aria-hidden="true" />
        <span>여기로 사진을 쓱- 끌어와보세요</span>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <ul className="flex flex-wrap gap-2" aria-label="추천 가능한 행사 예시">
        {EXAMPLE_TAGS.map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-primary/30 bg-card px-3 py-1 text-xs font-medium text-primary"
          >
            #{tag}
          </li>
        ))}
      </ul>
    </div>
  )
}
