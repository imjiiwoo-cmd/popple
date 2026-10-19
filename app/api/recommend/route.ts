import { GoogleGenAI } from '@google/genai'
import { MOCK_EVENTS } from '@/lib/events'
import type { PoppleEvent } from '@/lib/events'
import type { Recommendation } from '@/lib/types'

export const maxDuration = 60

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// 모델 체인: 안정적인 gemini-3.5-flash / gemini-3.8-flash 우선 적용
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-pro-latest',
]
const MODEL_CANDIDATES = Array.from(new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]))

// 지역 코드별 한글 명칭 및 주소 키워드 매핑
const AREA_MAP: Record<string, { name: string; keywords: string[] }> = {
  '1': { name: '서울', keywords: ['서울'] },
  '2': { name: '인천', keywords: ['인천'] },
  '31': { name: '경기', keywords: ['경기', '수원', '양주', '고양', '광명', '안양', '부천', '성남', '용인'] },
  '32': { name: '강원', keywords: ['강원', '강릉', '춘천', '속초', '원주', '태백', '평창'] },
  '6': { name: '부산', keywords: ['부산'] },
  '4': { name: '대구', keywords: ['대구'] },
  '3': { name: '대전', keywords: ['대전'] },
  '5': { name: '광주', keywords: ['광주'] },
  '39': { name: '제주', keywords: ['제주', '서귀포'] },
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 한국 시각(KST) 기준 오늘 날짜 문자열(YYYYMMDD) 생성
 */
function getTodayKstString(): string {
  const now = new Date()
  const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const yyyy = kstTime.getUTCFullYear()
  const mm = String(kstTime.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kstTime.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/**
 * 축제 시작일, 종료일 포맷팅 (YYYYMMDD -> YYYY. MM. DD)
 */
function formatFestivalDate(start?: string, end?: string): string {
  const fmt = (d: string) => {
    if (d && d.length === 8) {
      return `${d.slice(0, 4)}. ${d.slice(4, 6)}. ${d.slice(6, 8)}`
    }
    return d || ''
  }
  const s = fmt(start || '')
  const e = fmt(end || '')
  if (s && e && s !== e) return `${s} - ${e}`
  return s || e || '진행 중'
}

interface TourFestivalItem {
  contentid?: string
  title?: string
  eventstartdate?: string
  eventenddate?: string
  addr1?: string
  addr2?: string
  firstimage?: string
  firstimage2?: string
}

/**
 * 공공데이터포털 한국관광공사 TourAPI KorService2에서 실시간 축제 데이터 조회
 * 선택된 areaCode가 있으면 해당 지역 축제를 조회/필터링하고, 축제가 부족할 시 전국 단위로 폴백합니다.
 */
async function fetchLiveFestivals(
  tourApiKey: string,
  areaCode?: string,
): Promise<{ festivals: PoppleEvent[]; areaNotice?: string }> {
  const today = getTodayKstString()
  const decodedKey = decodeURIComponent(tourApiKey.trim())
  const selectedArea = areaCode && AREA_MAP[areaCode] ? AREA_MAP[areaCode] : null

  const url = new URL('https://apis.data.go.kr/B551011/KorService2/searchFestival2')
  url.searchParams.set('serviceKey', decodedKey)
  url.searchParams.set('MobileOS', 'ETC')
  url.searchParams.set('MobileApp', 'Popple')
  url.searchParams.set('_type', 'json')
  url.searchParams.set('eventStartDate', today)
  url.searchParams.set('arrange', 'A')
  url.searchParams.set('numOfRows', '60') // 지역 필터링을 고려하여 넉넉히 60건 수집

  if (selectedArea && areaCode) {
    url.searchParams.set('areaCode', areaCode)
  }

  try {
    console.log(
      `[popple] Calling TourAPI searchFestival2 (startDate: ${today}, areaCode: ${areaCode || 'ALL'})...`,
    )
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000), // 공공데이터포털 응답 지연 방지 (6초)
    })

    if (!res.ok) {
      throw new Error(`TourAPI HTTP error: ${res.status}`)
    }

    const data = await res.json()
    let rawItems: TourFestivalItem[] = data.response?.body?.items?.item || []

    // TourAPI에서 areaCode 파라미터 전달 시 데이터베이스 색인 특성으로 0건이 오는 경우 대비:
    // 전국 단위로 재호출하여 addr1(주소) 키워드로 해당 지역 축제를 스마트 필터링합니다.
    if (selectedArea && (!Array.isArray(rawItems) || rawItems.length === 0)) {
      console.log(
        `[popple] TourAPI returned 0 items with areaCode=${areaCode}. Querying nationwide and filtering by address...`,
      )
      url.searchParams.delete('areaCode')
      const fallbackRes = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
      })
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json()
        const allItems: TourFestivalItem[] = fallbackData.response?.body?.items?.item || []
        rawItems = allItems.filter((item) =>
          selectedArea.keywords.some((k) => (item.addr1 || '').includes(k)),
        )
      }
    }

    // 1. 이미 종료된 행사 제외 필터링 (현재 진행 중이거나 앞으로 열릴 행사만 유지)
    let activeItems = (Array.isArray(rawItems) ? rawItems : []).filter((item) => {
      const end = (item.eventenddate || '').trim()
      const start = (item.eventstartdate || '').trim()
      if (end && end < today) return false
      if (!end && start && start < today) return false
      return true
    })

    let areaNotice: string | undefined = undefined

    // 2. 만약 해당 지역에 현재 진행/예정 축제가 없는 경우 (0건):
    // 친절한 안내 문구와 함께 전국 단위 축제로 전환하여 빈 화면이 나오지 않도록 폴백합니다.
    if (selectedArea && activeItems.length === 0) {
      areaNotice = `선택하신 [${selectedArea.name}] 지역에 현재 진행 중인 축제가 적어 전국 단위 추천으로 전환합니다.`
      console.log(`[popple] ${areaNotice}`)

      url.searchParams.delete('areaCode')
      const nationwideRes = await fetch(url.toString(), {
        signal: AbortSignal.timeout(6000),
      })
      if (nationwideRes.ok) {
        const nwData = await nationwideRes.json()
        const allRawItems: TourFestivalItem[] = nwData.response?.body?.items?.item || []
        activeItems = allRawItems.filter((item) => {
          const end = (item.eventenddate || '').trim()
          const start = (item.eventstartdate || '').trim()
          if (end && end < today) return false
          if (!end && start && start < today) return false
          return true
        })
      }
    }

    if (activeItems.length === 0) {
      console.warn('[popple] No active festivals found. Falling back to default mock events.')
      return { festivals: MOCK_EVENTS, areaNotice }
    }

    console.log(
      `[popple] Active/Upcoming festivals after filtering: ${activeItems.length} items (area: ${selectedArea ? selectedArea.name : '전국'})`,
    )

    // 3. 포스터 이미지(firstimage)가 유효한 행사 위주로 우선 정렬
    const sortedItems = [...activeItems].sort((a, b) => {
      const aHasImg = Boolean(a.firstimage && a.firstimage.trim().startsWith('http'))
      const bHasImg = Boolean(b.firstimage && b.firstimage.trim().startsWith('http'))
      if (aHasImg && !bHasImg) return -1
      if (!aHasImg && bHasImg) return 1
      return 0
    })

    // 4. 최신 축제 정제 (최대 20건)
    const candidates = sortedItems.slice(0, 20)

    const cleanedEvents: PoppleEvent[] = candidates.map((item, idx) => {
      const rawImage = (item.firstimage || item.firstimage2 || '').trim()
      const fallbackPoster = MOCK_EVENTS[idx % MOCK_EVENTS.length].imageUrl
      const imageUrl = rawImage.startsWith('http') ? rawImage : fallbackPoster

      const addrTokens = (item.addr1 || '').split(' ').filter(Boolean)
      const locationShort = addrTokens.slice(0, 2).join(' ') || '전국'
      const areaTag =
        addrTokens[0]?.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '') || '전국'

      const title =
        item.title?.replace(/&amp;/g, '&')?.replace(/&lt;/g, '<')?.replace(/&gt;/g, '>') ||
        '전국 축제'

      return {
        id: `festival_${item.contentid || idx}`,
        title,
        date: formatFestivalDate(item.eventstartdate, item.eventenddate),
        location: item.addr1 || item.addr2 || '상세 장소는 주최측 공지 참조',
        price: '무료 관람 (체험비 별도)',
        imageUrl,
        poster: imageUrl,
        tags: [areaTag, '진행중축제', '문화행사', '야외활동', '나들이'],
        category: '축제/행사',
        description: `${locationShort}에서 진행되는 실시간 축제 "${title}". 현장의 즐거움과 계절의 정취를 만끽할 수 있습니다.`,
      }
    })

    return { festivals: cleanedEvents, areaNotice }
  } catch (error) {
    console.error('[popple] Failed to fetch festivals from TourAPI:', error)
    return { festivals: MOCK_EVENTS }
  }
}

/**
 * Gemini Vision API 호출
 */
async function callGeminiVision(
  ai: GoogleGenAI,
  base64Data: string,
  mimeType: string,
  systemInstruction: string,
): Promise<{ rawText: string; usedModel: string }> {
  let lastError: unknown = null

  for (const model of MODEL_CANDIDATES) {
    const maxRetries = 2

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[popple] [Gemini Vision] Requesting model: ${model} (attempt ${attempt}/${maxRetries})`)

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            '이 사진의 시각적 요소(색감, 조명, 계절감, 분위기, 장소, 피사체)와 감성적인 무드를 정밀하게 분석하고, 제공된 실시간 축제 목록 중 가장 잘 어울리는 축제 1개를 매칭하여 지정된 JSON으로 응답해주세요.',
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        })

        if (response.text) {
          console.log(`[popple] [Gemini Vision] Success with model: ${model}`)
          return { rawText: response.text, usedModel: model }
        }
      } catch (err) {
        lastError = err
        const errMsg = err instanceof Error ? err.message : String(err)
        console.warn(`[popple] [Gemini Vision] Model ${model} (attempt ${attempt}) failed: ${errMsg}`)

        const isRetryable =
          errMsg.includes('503') ||
          errMsg.includes('429') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE')

        if (isRetryable && attempt < maxRetries) {
          console.log(`[popple] Retrying in 1.5s for model ${model}...`)
          await sleep(1500)
          continue
        } else {
          break
        }
      }
    }
  }

  throw lastError
}

export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY
  const tourApiKey = process.env.TOUR_API_KEY

  if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here') {
    console.error('[popple] GEMINI_API_KEY is missing or invalid in process.env')
    return Response.json(
      {
        error:
          'GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 실제 Gemini API 키를 입력해주세요.',
      },
      { status: 400 },
    )
  }

  const formData = await request.formData().catch(() => null)
  const image = formData?.get('image')
  const areaCode = (formData?.get('areaCode') as string) || ''

  if (!(image instanceof File)) {
    console.error('[popple] No image file provided in formData')
    return Response.json({ error: '분석할 이미지 파일이 필요합니다.' }, { status: 400 })
  }

  const mimeType = image.type || 'image/jpeg'
  if (!ALLOWED_TYPES.has(mimeType)) {
    console.error(`[popple] Unsupported image type: ${mimeType}`)
    return Response.json(
      { error: '지원하지 않는 이미지 형식입니다. (JPEG, PNG, WebP 지원)' },
      { status: 415 },
    )
  }

  if (image.size > MAX_IMAGE_BYTES) {
    console.error(`[popple] Image size too large: ${image.size} bytes`)
    return Response.json({ error: '이미지 용량이 너무 큽니다. (최대 10MB)' }, { status: 413 })
  }

  try {
    // 1. TourAPI 실시간 축제 목록 조회 (선택된 areaCode 반영)
    const { festivals, areaNotice } = tourApiKey
      ? await fetchLiveFestivals(tourApiKey, areaCode)
      : { festivals: MOCK_EVENTS, areaNotice: undefined }

    const areaName = areaCode && AREA_MAP[areaCode] ? AREA_MAP[areaCode].name : '전국'

    // 2. Gemini에게 전달할 축제 카탈로그 프롬프트 구성 (최대 20개)
    const catalogPrompt = festivals
      .slice(0, 20)
      .map(
        (f) =>
          `- id: "${f.id}" | 축제명: "${f.title}" | 일시: "${f.date}" | 장소: "${f.location}" | 특징: ${f.description || f.title}`,
      )
      .join('\n')

    const systemInstruction = `당신은 사용자가 업로드한 사진의 시각적 요소(색감, 조명, 계절감, 분위기, 장소, 피사체)와 감성적인 무드를 정밀하게 분석하여 가장 잘 어울리는 축제를 추천해주는 AI 큐레이터 "팝플(Popple)"입니다.

현재 사용자가 선택한 추천 지역은 [${areaName}]입니다.
반드시 업로드된 사진의 이미지 데이터를 직접 분석하고, 제공되는 [실시간 축제 목록] 중에서 사진의 분위기와 가장 어울리는 행사 '단 1개'를 매칭하여 아래 JSON 스키마 형식으로 응답하세요.

[실시간 축제 목록]
${catalogPrompt}

[응답 JSON 스키마]
{
  "recommended_event_id": "제공된 목록의 id 중 사진의 무드와 가장 어울리는 행사의 id",
  "mood_tags": ["#키워드1", "#키워드2", "#키워드3"],
  "mood_headline": "사진의 핵심 분위기를 함축한 짧은 헤드라인 (예: 가을바람과 낭만적인 노을빛)",
  "mood_summary": "사진의 색감이나 분위기를 다정하게 요약한 설명 문장 (예: 붉게 물든 하늘과 편안한 풍경에서 여유로운 무드가 느껴져요.)",
  "detailed_reason": {
    "visual_mood": "사진에서 관찰되는 시각적 분위기 (예: 따스한 색감과 탁 트인 야외 풍경)",
    "event_feature": "추천한 축제의 핵심적인 매력 및 특징 (예: 강변을 따라 펼쳐지는 가을 정취와 다양한 먹거리)",
    "match_reason": "사진의 무드와 축제의 특징이 연결되는 구체적인 이유 (예: 사진 속 평화롭고 낭만적인 분위기가 축제 현장의 여유로운 정취와 잘 어울려요.)"
  }
}

주의사항:
- 반드시 순수한 JSON 형식으로만 응답해야 합니다 (마크다운 코드블록 없이 순수 JSON만 반환).
- recommended_event_id는 반드시 제공된 축제 목록의 id 중 하나여야 합니다.
- mood_tags는 반드시 #으로 시작하는 2~3개의 감성 키워드여야 합니다.`

    // 3. 사진 데이터 준비 및 Gemini Vision 분석
    const arrayBuffer = await image.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const { rawText, usedModel } = await callGeminiVision(ai, base64Data, mimeType, systemInstruction)
    console.log(`[popple] Gemini Vision completed using model: ${usedModel}`)

    const cleanedText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: {
      recommended_event_id?: string
      eventId?: string
      mood_tags?: string[]
      mood_headline?: string
      mood_summary?: string
      detailed_reason?: {
        visual_mood?: string
        event_feature?: string
        match_reason?: string
      }
    } = {}

    try {
      parsed = JSON.parse(cleanedText)
    } catch (parseErr) {
      console.error('[popple] JSON parsing failed for rawText:', rawText, parseErr)
    }

    const eventId = parsed.recommended_event_id || parsed.eventId
    const matchedEvent = festivals.find((f) => f.id === eventId) || festivals[0]

    const moodTags =
      Array.isArray(parsed.mood_tags) && parsed.mood_tags.length > 0
        ? parsed.mood_tags.map((t) => (String(t).startsWith('#') ? String(t) : `#${t}`))
        : ['#감성', '#진행중축제', '#나들이']

    const visualMood =
      parsed.detailed_reason?.visual_mood || '사진의 시각적 요소와 색감이 돋보이는 분위기'
    const eventFeature =
      parsed.detailed_reason?.event_feature ||
      matchedEvent.description ||
      '현장의 생생한 매력을 경험할 수 있는 축제'
    const matchReason =
      parsed.detailed_reason?.match_reason ||
      `사진에서 느껴지는 분위기와 "${matchedEvent.title}"의 정취가 자연스럽게 어우러져요.`

    // 서브 추천 행사 2개 선정 (메인 추천 행사 제외)
    let subEvents = festivals.filter((f) => f.id !== matchedEvent.id).slice(0, 2)
    if (subEvents.length < 2) {
      const fallbackSub = MOCK_EVENTS.filter(
        (m) => m.id !== matchedEvent.id && !subEvents.some((s) => s.id === m.id),
      )
      subEvents = [...subEvents, ...fallbackSub].slice(0, 2)
    }

    const result: Recommendation = {
      recommended_event_id: matchedEvent.id,
      mood_tags: moodTags,
      mood_headline: parsed.mood_headline || '사진에서 느껴지는 매력적인 분위기',
      mood_summary:
        parsed.mood_summary || '사진 속 색감과 피사체에서 특유의 무드가 느껴져요.',
      detailed_reason: {
        visual_mood: visualMood,
        event_feature: eventFeature,
        match_reason: matchReason,
      },
      event: matchedEvent,
      sub_events: subEvents,
      area_notice: areaNotice,
      keywords: moodTags.map((t) => t.replace(/^#/, '')),
      comment: parsed.mood_summary || '사진 속 무드가 돋보이네요!',
      reason: matchReason,
    }

    return Response.json(result)
  } catch (error) {
    console.error('[popple] recommend API Error caught in catch block:')
    if (error instanceof Error) {
      console.error(`[popple] Error Message: ${error.message}`)
      console.error(`[popple] Error Stack: ${error.stack}`)
    } else {
      console.error(`[popple] Unknown Error Object:`, error)
    }

    return Response.json(
      {
        error:
          '순간적인 접속량 증가로 추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 503 },
    )
  }
}
