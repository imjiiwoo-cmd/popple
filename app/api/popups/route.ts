import { GoogleGenAI } from '@google/genai'
import { type PoppleEvent, sortPopupsVisualFirst, isEventOperatingInRange } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1시간 캐싱 적용

export interface PopupItem extends PoppleEvent {
  region: '성수' | '더현대' | '홍대' | '강남' | '잠실' | string
  fee?: string
  reservationUrl?: string
  officialQuery?: string
}

// -------------------------------------------------------------
// [1순위: 공식 예약/원문 링크의 og:image 실제 크롤링 (1.5초 타임아웃)]
// -------------------------------------------------------------
async function extractOgImage(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null

  // 일반 검색엔진 결과 페이지는 검색 로고 등이 잡힐 수 있으므로 스킵
  if (
    url.includes('search.naver.com') ||
    url.includes('google.com') ||
    url.includes('m.booking.naver.com/search')
  ) {
    return null
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(1500),
      redirect: 'follow',
    })

    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null

    const html = await res.text()
    const match =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)

    if (match && match[1]) {
      let img = match[1].trim()
      if (img.startsWith('//')) img = 'https:' + img
      else if (img.startsWith('/')) {
        const parsedUrl = new URL(url)
        img = `${parsedUrl.origin}${img}`
      }
      // 유효한 이미지 확장자/URL인지 검증 (트래킹 픽셀, 포털 기본 스니펫 로고 제외)
      if (
        img.startsWith('http') &&
        !img.includes('blank.gif') &&
        !img.includes('favicon') &&
        !img.includes('1x1') &&
        !img.includes('snippet_') &&
        !img.includes('share_default') &&
        !img.includes('og_default') &&
        !img.includes('no_image')
      ) {
        return img
      }
    }
  } catch {
    // 1.5s 타임아웃 또는 네트워크 오류 시 즉시 null
  }
  return null
}

// -------------------------------------------------------------
// [2순위: 네이버 이미지 검색 API (Search Image API) 연동 (1.5초 타임아웃)]
// -------------------------------------------------------------
async function fetchNaverSearchImage(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const url = `https://openapi.naver.com/v1/search/image.json?query=${encodeURIComponent(query)}&display=3&sort=sim`
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(1500),
    })

    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.items) && data.items.length > 0) {
        for (const item of data.items) {
          const img = item.link || item.thumbnail
          if (img && typeof img === 'string' && img.startsWith('http') && !img.endsWith('.svg')) {
            return img
          }
        }
      }
    }
  } catch {
    // 1.5s 타임아웃 또는 오류 시 즉시 null
  }
  return null
}

// -------------------------------------------------------------
// [2단계 복합 포스터 해석기: og:image -> 네이버 이미지 검색 API]
// 1.5초 지연 또는 미발견 시 엉뚱한 임의의 풍경 사진 대신 null 반환
// -------------------------------------------------------------
async function resolvePopupPosterImage(
  title: string,
  urls: (string | undefined)[],
  clientId?: string,
  clientSecret?: string,
): Promise<string | null> {
  // [1순위: 공식 예약/원문 링크의 og:image 실제 크롤링]
  for (const url of urls) {
    if (!url || !url.startsWith('http')) continue
    const ogImg = await extractOgImage(url)
    if (ogImg) {
      return ogImg
    }
  }

  // [2순위: 네이버 이미지 검색 API (Search Image API) 연동]
  if (clientId && clientSecret) {
    const cleanTitle = title.replace(/\([^)]*\)/g, '').trim()
    const queries = [`${cleanTitle} 포스터`, cleanTitle]
    for (const q of queries) {
      const naverImg = await fetchNaverSearchImage(q, clientId, clientSecret)
      if (naverImg) {
        return naverImg
      }
    }
  }

  // 1.5초 지연/미발견 시 임의의 풍경 사진을 억지로 넣지 않고 null(포스터 준비중 상태) 반환
  return null
}

// -------------------------------------------------------------
// [실제 서울 5대 팝업 성지 28선 마스터 데이터셋]
// -------------------------------------------------------------
export const MASTER_CURATED_POPUPS: PopupItem[] = [
  // --- 성수 (6) ---
  {
    id: 'popup_seongsu_01',
    title: '디올 성수 2026 어텀/윈터 가든 아카이브 팝업',
    region: '성수',
    location: '[성수] 서울 성동구 연무장5길 7 (디올 성수)',
    date: '2026. 10. 15 ~ 11. 30 (D-39)',
    fee: '무료 관람 (사전예약/현장대기)',
    price: '무료 관람 (사전예약/현장대기)',
    description: '가을 정취를 담은 디올 성수의 아카이브 전시 및 프라이빗 포토존. 메종의 헤리티지와 플로럴 아트를 경험할 수 있습니다.',
    tags: ['#디올성수', '#성수팝업', '#포토존', '#사전예약', '#명품팝업'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=디올+성수+팝업스토어',
    officialQuery: '디올 성수 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_seongsu_02',
    title: '탬버린즈 성수 프래그런스 & 퍼퓸 캔들 전시 팝업',
    region: '성수',
    location: '[성수] 서울 성동구 연무장길 84 (탬버린즈 성수)',
    date: '2026. 10. 10 ~ 12. 05 (진행 중)',
    fee: '무료 입장 (현장 대기 등록)',
    price: '무료 입장 (현장 대기 등록)',
    description: '독창적인 향과 조각 예술이 어우러진 감각적인 힐링 전시. 신규 퍼퓸 라인업 시향 및 구매 고객 한정 기프트 증정.',
    tags: ['#탬버린즈', '#성수핫플', '#향수팝업', '#굿즈증정', '#전시체험'],
    reservationUrl: 'https://www.tamburins.com',
    websiteUrl: 'https://www.tamburins.com',
    officialQuery: '탬버린즈 성수 팝업스토어 포스터',
    imageUrl: 'https://web-resource.tamburins.com/image/share_banner_ohand.png',
    poster: 'https://web-resource.tamburins.com/image/share_banner_ohand.png',
    category: '팝업스토어',
  },
  {
    id: 'popup_seongsu_03',
    title: '무신사 뷰티 페스타 성수 트렌드 팝업',
    region: '성수',
    location: '[성수] 서울 성동구 아차산로 104 무신사 스퀘어 성수',
    date: '2026. 10. 18 ~ 11. 08 (D-17)',
    fee: '무료 관람 (무신사 앱 회원 인증)',
    price: '무료 관람 (무신사 앱 회원 인증)',
    description: '핫한 인디 뷰티 브랜드 40여 개가 총출동하는 체험형 팝업. 룰렛 이벤트와 본품 럭키드로우 샘플팩 제공.',
    tags: ['#무신사뷰티', '#성수동', '#샘플증정', '#뷰티팝업', '#럭키드로우'],
    reservationUrl: 'https://www.musinsa.com',
    websiteUrl: 'https://www.musinsa.com',
    officialQuery: '무신사 뷰티 페스타 성수 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_seongsu_04',
    title: '샤넬 코코 크러쉬 성수 익스클루시브 라운지',
    region: '성수',
    location: '[성수] 서울 성동구 연무장길 95 (앤더슨씨 성수)',
    date: '2026. 10. 20 ~ 11. 15 (D-24)',
    fee: '무료 (샤넬 카카오톡 사전예약)',
    price: '무료 (샤넬 카카오톡 사전예약)',
    description: '샤넬의 아이코닉 주얼리 코코 크러쉬를 만나는 인터랙티브 공간. 주얼리 스타일링과 스페셜 포토부스 체험.',
    tags: ['#샤넬', '#코코크러쉬', '#성수팝업', '#사전예약', '#주얼리'],
    reservationUrl: 'https://www.chanel.com',
    websiteUrl: 'https://www.chanel.com',
    officialQuery: '샤넬 코코크러쉬 성수 팝업 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_seongsu_05',
    title: '아더에러(ADERERROR) 성수 스페이스 전시 팝업',
    region: '성수',
    location: '[성수] 서울 성동구 성수이로 82 (아더 성수 스페이스)',
    date: '2026. 10. 05 ~ 11. 25 (진행 중)',
    fee: '무료 관람 (현장 순차 입장)',
    price: '무료 관람 (현장 순차 입장)',
    description: '미디어 아트와 하이엔드 패션이 융합된 우주 테마 오브제 전시. 리미티드 캡슐 컬렉션 단독 공개.',
    tags: ['#아더에러', '#성수전시', '#미디어아트', '#패션팝업', '#포토스팟'],
    reservationUrl: 'https://adererror.com',
    websiteUrl: 'https://adererror.com',
    officialQuery: '아더에러 성수 팝업스토어 포스터',
    imageUrl: 'https://d31flwjaqugbgy.cloudfront.net/s3-cloud-bucket-ader-user/seo/%EB%B8%94%EB%9E%99_%EC%A0%84%EC%8B%A0%EC%BB%B7_FINAL_%EC%BB%A8%ED%8E%8C%EC%99%84%EB%A3%8C_4x5+%EB%B3%B5%EC%82%AC.jpg',
    poster: 'https://d31flwjaqugbgy.cloudfront.net/s3-cloud-bucket-ader-user/seo/%EB%B8%94%EB%9E%99_%EC%A0%84%EC%8B%A0%EC%BB%B7_FINAL_%EC%BB%A8%ED%8E%8C%EC%99%84%EB%A3%8C_4x5+%EB%B3%B5%EC%82%AC.jpg',
    category: '팝업스토어',
  },
  {
    id: 'popup_seongsu_06',
    title: '이케아 팝업 성수: 푸드 & 플레이그라운드',
    region: '성수',
    location: '[성수] 서울 성동구 성수이로 118',
    date: '2026. 10. 12 ~ 11. 20 (D-29)',
    fee: '무료 관람 (DIY 워크숍 사전예약)',
    price: '무료 관람 (DIY 워크숍 사전예약)',
    description: '스웨디시 라이프스타일을 담은 컬러풀 쇼룸과 스웨덴 미트볼 시식존, 업사이클링 DIY 클래스 진행.',
    tags: ['#이케아성수', '#리빙팝업', '#체험존', '#푸드팝업', '#성수놀거리'],
    reservationUrl: 'https://www.ikea.com',
    websiteUrl: 'https://www.ikea.com',
    officialQuery: '이케아 성수 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },

  // --- 더현대 (6) ---
  {
    id: 'popup_thehyundai_01',
    title: '더현대 서울 디즈니·픽사 애니메이션 아트 팝업',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 지하 1층 대행사장',
    date: '2026. 10. 14 ~ 11. 10 (D-19)',
    fee: '무료 관람 (현장 대기 등록)',
    price: '무료 관람 (현장 대기 등록)',
    description: '디즈니·픽사 역대 인기 캐릭터 조형물과 포토존 연출. 한정판 피규어와 인형 굿즈 공식 판매.',
    tags: ['#더현대서울', '#디즈니팝업', '#픽사굿즈', '#여의도핫플', '#포토존'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=더현대+서울+디즈니+팝업',
    officialQuery: '더현대 서울 디즈니 픽사 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_thehyundai_02',
    title: '팝마트(POP MART) 코리아 더현대 한정판 피규어 팝업',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 지하 2층 아이코닉스퀘어',
    date: '2026. 10. 16 ~ 11. 05 (D-14)',
    fee: '무료 입장 (현장 태블릿 등록)',
    price: '무료 입장 (현장 태블릿 등록)',
    description: '몰리, 디무, 라부부 한정판 블라인드 박스 및 대형 아트토이 전시. 구매 금액별 스페셜 굿즈 증정.',
    tags: ['#팝마트', '#더현대팝업', '#아트토이', '#라부부', '#한정판굿즈'],
    reservationUrl: 'https://popmart.co.kr',
    websiteUrl: 'https://popmart.co.kr',
    officialQuery: '더현대 서울 팝마트 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_thehyundai_03',
    title: '잔망루피 월드 더현대 서울 익스클루시브 스토어',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 5층 사운즈포레스트',
    date: '2026. 10. 18 ~ 11. 18 (D-27)',
    fee: '무료 관람',
    price: '무료 관람',
    description: '초대형 핑크 잔망루피 포토존과 직장인 공감 만화 굿즈, 인생네컷 한정 프레임 이벤트 진행.',
    tags: ['#잔망루피', '#사운즈포레스트', '#더현대서울', '#인생네컷', '#포토존'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=더현대+서울+잔망루피+팝업',
    officialQuery: '더현대 잔망루피 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_thehyundai_04',
    title: '나이스웨더 x 글로벌 스트리트 푸드 마켓 팝업',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 지하 2층',
    date: '2026. 10. 11 ~ 11. 12 (D-21)',
    fee: '무료 입장 (식음료 별도)',
    price: '무료 입장 (식음료 별도)',
    description: '힙한 편의점 나이스웨더와 미국·유럽 로컬 스낵 브랜드 콜라보. 레트로 굿즈와 시그니처 도넛 판매.',
    tags: ['#나이스웨더', '#스트리트푸드', '#디저트팝업', '#여의도맛집', '#더현대'],
    reservationUrl: 'https://niceweather.co.kr',
    websiteUrl: 'https://niceweather.co.kr',
    officialQuery: '더현대 서울 나이스웨더 팝업 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_thehyundai_05',
    title: '르라보(LE LABO) 센티드 아틀리에 더현대 서울 팝업',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 1층',
    date: '2026. 10. 08 ~ 11. 28 (진행 중)',
    fee: '무료 입장 (맞춤 라벨링 서비스)',
    price: '무료 입장 (맞춤 라벨링 서비스)',
    description: '클래식 니치 향수 르라보의 랩(Lab) 콘셉트 전시 및 시향. 나만의 문구를 새기는 커스텀 라벨링 제공.',
    tags: ['#르라보', '#니치향수', '#더현대1층', '#커스텀라벨링', '#시향존'],
    reservationUrl: 'https://www.lelabofragrances.com',
    websiteUrl: 'https://www.lelabofragrances.com',
    officialQuery: '더현대 르라보 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_thehyundai_06',
    title: '플레이브(PLAVE) 홀로그램 콘서트 기념 더현대 팝업',
    region: '더현대',
    location: '[여의도] 서울 영등포구 여의대로 108 더현대 서울 지하 1층',
    date: '2026. 10. 19 ~ 11. 02 (D-11)',
    fee: '무료 (사전 모바일 티켓 예약제)',
    price: '무료 (사전 모바일 티켓 예약제)',
    description: '버추얼 아이돌 플레이브의 세계관 체험관 및 홀로그램 영상 상영, 앨범 커스텀 포토카드 증정.',
    tags: ['#플레이브', '#버추얼아이돌', '#더현대팝업', '#사전예약', '#포토카드'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=더현대+플레이브+팝업',
    officialQuery: '더현대 플레이브 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },

  // --- 홍대 (5) ---
  {
    id: 'popup_hongdae_01',
    title: '산리오 러버스 클럽 홍대 2026 리뉴얼 팝업',
    region: '홍대',
    location: '[홍대] 서울 마포구 와우산로19길 18 1~2층',
    date: '2026. 10. 01 ~ 12. 31 (진행 중)',
    fee: '1층 굿즈샵 무료 / 2층 카페 사전예약',
    price: '1층 굿즈샵 무료 / 2층 카페 사전예약',
    description: '헬로키티 50주년 기념 특별 인테리어와 시나모롤, 쿠로미 테마 룸. 한정 음료 및 디저트 판매.',
    tags: ['#산리오러버스클럽', '#홍대핫플', '#헬로키티', '#쿠로미', '#캐릭터카페'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=산리오+러버스+클럽+홍대',
    officialQuery: '홍대 산리오 러버스 클럽 팝업 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_hongdae_02',
    title: '라인프렌즈 스퀘어 홍대 BT21 & 미니니 팝업',
    region: '홍대',
    location: '[홍대] 서울 마포구 양화로 160 1층~2층',
    date: '2026. 10. 15 ~ 11. 20 (D-29)',
    fee: '무료 관람 (자유 입장)',
    price: '무료 관람 (자유 입장)',
    description: '글로벌 인기 캐릭터 미니니(minini)와 BT21 신규 시즌 컬렉션. 초대형 메가 캐릭터 포토존 운영.',
    tags: ['#라인프렌즈', '#BT21', '#홍대입구역', '#미니니', '#굿즈스토어'],
    reservationUrl: 'https://brand.naver.com/linefriends',
    websiteUrl: 'https://brand.naver.com/linefriends',
    officialQuery: '라인프렌즈 스퀘어 홍대 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_hongdae_03',
    title: '카카오프렌즈 홍대 플래그십 춘식이 아트 콜라보',
    region: '홍대',
    location: '[홍대] 서울 마포구 양화로 162 동교동빌딩',
    date: '2026. 10. 10 ~ 11. 30 (진행 중)',
    fee: '무료 입장',
    price: '무료 입장',
    description: '국내 아티스트와 협업한 춘식이 현대미술 콜라보 전시. 인터랙티브 드로잉 체험존과 굿즈샵 마련.',
    tags: ['#카카오프렌즈', '#춘식이', '#홍대플래그십', '#아트콜라보', '#포토존'],
    reservationUrl: 'https://store.kakaofriends.com',
    websiteUrl: 'https://store.kakaofriends.com',
    officialQuery: '카카오프렌즈 홍대 춘식이 팝업 포스터',
    imageUrl: 'https://t1.kakaocdn.net/friends/www/talk/kakaofriends_talk_2018.png',
    poster: 'https://t1.kakaocdn.net/friends/www/talk/kakaofriends_talk_2018.png',
    category: '팝업스토어',
  },
  {
    id: 'popup_hongdae_04',
    title: '닌텐도 스위치 게임 체험 & 캐릭터 굿즈 홍대 팝업',
    region: '홍대',
    location: '[홍대] 서울 마포구 와우산로 100',
    date: '2026. 10. 17 ~ 11. 10 (D-19)',
    fee: '무료 관람 (체험존 현장 접수)',
    price: '무료 관람 (체험존 현장 접수)',
    description: '최신 닌텐도 타이틀 현장 플레이와 마리오·젤다 오리지널 공식 굿즈 팝업 판매.',
    tags: ['#닌텐도', '#게임체험', '#슈퍼마리오', '#홍대놀거리', '#젤다의전설'],
    reservationUrl: 'https://www.nintendo.co.kr',
    websiteUrl: 'https://www.nintendo.co.kr',
    officialQuery: '닌텐도 홍대 팝업스토어 포스터',
    imageUrl: 'https://www.nintendo.co.kr/sns.png',
    poster: 'https://www.nintendo.co.kr/sns.png',
    category: '팝업스토어',
  },
  {
    id: 'popup_hongdae_05',
    title: '무신사 테라스 홍대 인디 레이블 & 레트로 바이닐 팝업',
    region: '홍대',
    location: '[홍대] 서울 마포구 양화로 188 AK플라자 17층 무신사 테라스',
    date: '2026. 10. 13 ~ 11. 05 (D-14)',
    fee: '무료 입장 (청음존 자유 이용)',
    price: '무료 입장 (청음존 자유 이용)',
    description: '홍대 파노라마 시티뷰와 함께 즐기는 LP 청음 라운지. 인디 밴드 라이브 쇼케이스 및 빈티지 의류 마켓.',
    tags: ['#무신사테라스', '#바이닐팝업', '#LP청음', '#홍대뷰맛집', '#루프탑'],
    reservationUrl: 'https://www.musinsaterrace.com',
    websiteUrl: 'https://www.musinsaterrace.com',
    officialQuery: '무신사 테라스 홍대 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },

  // --- 강남 (6) ---
  {
    id: 'popup_gangnam_01',
    title: '넷플릭스 K-오리지널 세계관 익스피리언스 강남 팝업',
    region: '강남',
    location: '[강남] 서울 강남구 강남대로 426 (일상비일상의틈 1~4층)',
    date: '2026. 10. 12 ~ 11. 19 (D-28)',
    fee: '무료 관람 (틈 앱 다운로드 후 입장)',
    price: '무료 관람 (틈 앱 다운로드 후 입장)',
    description: '넷플릭스 인기 시리즈의 몰입형 세트장 구현. 방탈출 미션 이벤트와 스페셜 굿즈 패키지 증정.',
    tags: ['#넷플릭스', '#일상비일상의틈', '#강남역핫플', '#세트장체험', '#굿즈증정'],
    reservationUrl: 'https://www.uplus.co.kr',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=일상비일상의틈+넷플릭스+팝업',
    officialQuery: '넷플릭스 일상비일상의틈 강남 팝업 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_gangnam_02',
    title: '애플 강남 크리에이티브 뮤직 & 아트 Today at Apple 팝업',
    region: '강남',
    location: '[강남] 서울 강남구 강남대로 464 (애플 강남)',
    date: '2026. 10. 01 ~ 11. 30 (진행 중)',
    fee: '무료 참가 (Apple 공식 세션 예약)',
    price: '무료 참가 (Apple 공식 세션 예약)',
    description: '공간 음향 스튜디오 체험과 iPad 일러스트레이션 무료 세션. K-POP 아티스트 콜라보 세션 진행.',
    tags: ['#애플강남', '#투데이앳애플', '#강남대로', '#무료세션', '#체험프로그램'],
    reservationUrl: 'https://www.apple.com/kr/today',
    websiteUrl: 'https://www.apple.com/kr/today',
    officialQuery: '애플 강남 팝업스토어 포스터',
    imageUrl: 'https://www.apple.com/today/assets/images/seoImages/landing/todayatapple_social.jpg',
    poster: 'https://www.apple.com/today/assets/images/seoImages/landing/todayatapple_social.jpg',
    category: '팝업스토어',
  },
  {
    id: 'popup_gangnam_03',
    title: '젠틀몬스터 x 메종 마르지엘라 아이웨어 강남 팝업',
    region: '강남',
    location: '[강남] 서울 강남구 압구정로46길 50 (하우스 도산)',
    date: '2026. 10. 15 ~ 11. 25 (진행 중)',
    fee: '무료 관람 (자유 입장)',
    price: '무료 관람 (자유 입장)',
    description: '초현실적인 키네틱 인스톨레이션과 마르지엘라의 4개의 스티치가 담긴 아이웨어 협업 컬렉션 전시.',
    tags: ['#젠틀몬스터', '#마르지엘라', '#하우스도산', '#압구정핫플', '#아이웨어'],
    reservationUrl: 'https://www.gentlemonster.com',
    websiteUrl: 'https://www.gentlemonster.com',
    officialQuery: '젠틀몬스터 마르지엘라 팝업스토어 포스터',
    imageUrl: 'https://gm-prd-resource.gentlemonster.com/assets/common/og/prada_open_graph3.jpg',
    poster: 'https://gm-prd-resource.gentlemonster.com/assets/common/og/prada_open_graph3.jpg',
    category: '팝업스토어',
  },
  {
    id: 'popup_gangnam_04',
    title: '나이키 강남 스튜디오 서울 커스텀 랩 팝업',
    region: '강남',
    location: '[강남] 서울 강남구 강남대로 446 (나이키 강남)',
    date: '2026. 10. 10 ~ 11. 15 (D-24)',
    fee: '무료 입장 (나이키 바이 유 패치 유료)',
    price: '무료 입장 (나이키 바이 유 패치 유료)',
    description: '서울 한정 그래픽 패치와 레이저 각인으로 나만의 에어포스를 커스텀하는 Nike By You 팝업.',
    tags: ['#나이키강남', '#나이키바이유', '#에어포스', '#커스텀신발', '#강남핫플'],
    reservationUrl: 'https://www.nike.com/kr',
    websiteUrl: 'https://www.nike.com/kr',
    officialQuery: '나이키 강남 팝업스토어 포스터',
    imageUrl: 'https://static.nike.com/a/images/w_1920,c_limit/wzrqsjqpg6pslrevtkpl/image.png',
    poster: 'https://static.nike.com/a/images/w_1920,c_limit/wzrqsjqpg6pslrevtkpl/image.png',
    category: '팝업스토어',
  },
  {
    id: 'popup_gangnam_05',
    title: '스타벅스 리저브 코리아 아트 라운지 강남',
    region: '강남',
    location: '[강남] 서울 강남구 테헤란로 134 포스코타워 1층',
    date: '2026. 10. 05 ~ 11. 20 (진행 중)',
    fee: '무료 관람 (음료 별도)',
    price: '무료 관람 (음료 별도)',
    description: '세계적인 희귀 원두 시음 세션과 국내 신진 아티스트 커피 아트 전시. 리저브 전용 텀블러 증정 이벤트.',
    tags: ['#스타벅스리저브', '#테헤란로', '#커피시음', '#아트라운지', '#강남카페'],
    reservationUrl: 'https://www.starbucks.co.kr',
    websiteUrl: 'https://www.starbucks.co.kr',
    officialQuery: '스타벅스 리저브 강남 팝업 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_gangnam_06',
    title: '아모레퍼시픽 웰니스 & 티 컬렉션 도산 팝업',
    region: '강남',
    location: '[강남] 서울 강남구 도산대로45길 10',
    date: '2026. 10. 14 ~ 11. 12 (D-21)',
    fee: '무료 (사전 예약 티 테이스팅)',
    price: '무료 (사전 예약 티 테이스팅)',
    description: '오설록 프리미엄 티 페어링과 웰니스 스킨케어 진단존. 가을 차 향과 함께하는 프라이빗 힐링 클래스.',
    tags: ['#아모레퍼시픽', '#오설록', '#도산공원', '#티클래스', '#힐링팝업'],
    reservationUrl: 'https://m.booking.naver.com',
    websiteUrl: 'https://m.search.naver.com/search.naver?query=아모레+도산+팝업스토어',
    officialQuery: '아모레퍼시픽 도산 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },

  // --- 잠실 (5) ---
  {
    id: 'popup_jamsil_01',
    title: '잠실 롯데월드몰 아트리움 포켓몬 스프링 페스타 팝업',
    region: '잠실',
    location: '[잠실] 서울 송파구 올림픽로 300 롯데월드몰 1층 아트리움 광장',
    date: '2026. 10. 16 ~ 11. 10 (D-19)',
    fee: '무료 관람 (포토존 자유)',
    price: '무료 관람 (포토존 자유)',
    description: '12m 초대형 피카츄 풍선과 포켓몬 카드 게임 공식 배틀존, 한정판 오리지널 굿즈 스토어.',
    tags: ['#포켓몬페스타', '#잠실롯데월드몰', '#피카츄', '#아트리움', '#가족나들이'],
    reservationUrl: 'https://pokemonkorea.co.kr',
    websiteUrl: 'https://pokemonkorea.co.kr',
    officialQuery: '잠실 롯데월드몰 포켓몬 팝업스토어 포스터',
    imageUrl: 'https://data1.pokemonkorea.co.kr/2016/06/2016-06-20_00-44-39-61799-1466351079.jpg',
    poster: 'https://data1.pokemonkorea.co.kr/2016/06/2016-06-20_00-44-39-61799-1466351079.jpg',
    category: '팝업스토어',
  },
  {
    id: 'popup_jamsil_02',
    title: '레고(LEGO) 플레이 그라운드 잠실 월드몰 팝업',
    region: '잠실',
    location: '[잠실] 서울 송파구 올림픽로 300 롯데월드몰 지하 1층',
    date: '2026. 10. 10 ~ 11. 16 (D-25)',
    fee: '무료 입장 (조립 체험존 자유)',
    price: '무료 입장 (조립 체험존 자유)',
    description: '수십만 개 레고 브릭으로 구현한 디오라마와 나만의 미니피겨 만들기 체험. 신제품 단독 할인 프로모션.',
    tags: ['#레고팝업', '#잠실월드몰', '#어린이체험', '#레고디오라마', '#키덜트'],
    reservationUrl: 'https://www.lego.com/ko-kr',
    websiteUrl: 'https://www.lego.com/ko-kr',
    officialQuery: '잠실 레고 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_jamsil_03',
    title: '런던베이글뮤지엄 잠실 익스클루시브 굿즈 팝업',
    region: '잠실',
    location: '[잠실] 서울 송파구 올림픽로 300 롯데월드몰 1층',
    date: '2026. 10. 18 ~ 11. 20 (D-29)',
    fee: '무료 (캐치테이블 현장 웨이팅)',
    price: '무료 (캐치테이블 현장 웨이팅)',
    description: '영국 빈티지 감성을 극대화한 특별 쇼룸. 잠실 단독 베이글 라인업과 리미티드 에코백, 머그컵 판매.',
    tags: ['#런던베이글뮤지엄', '#잠실맛집', '#베이글팝업', '#캐치테이블', '#웨이팅필수'],
    reservationUrl: 'https://catchtable.co.kr',
    websiteUrl: 'https://catchtable.co.kr',
    officialQuery: '런던베이글뮤지엄 잠실 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_jamsil_04',
    title: '카카오페이 x 최고심 잠실 롯데월드몰 행운 팝업',
    region: '잠실',
    location: '[잠실] 서울 송파구 올림픽로 300 롯데월드몰 1층 아뜨리움',
    date: '2026. 10. 15 ~ 11. 05 (D-14)',
    fee: '무료 관람',
    price: '무료 관람',
    description: '긍정 에너지 가득한 최고심 일러스트 부적 증정 및 대형 포토존. 카카오페이 결제 시 한정판 키링 제공.',
    tags: ['#최고심', '#카카오페이', '#잠실팝업', '#행운부적', '#한정판키링'],
    reservationUrl: 'https://www.kakaopay.com',
    websiteUrl: 'https://www.kakaopay.com',
    officialQuery: '잠실 최고심 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
  {
    id: 'popup_jamsil_05',
    title: '산리오 캐릭터즈 롯데월드타워 월드파크 야외 팝업',
    region: '잠실',
    location: '[잠실] 서울 송파구 올림픽로 300 월드파크 야외 잔디광장',
    date: '2026. 10. 10 ~ 11. 10 (D-19)',
    fee: '야외 잔디광장 무료 관람',
    price: '야외 잔디광장 무료 관람',
    description: '석촌호수와 어우러진 초대형 산리오 패밀리 벌룬 전시. 가을밤 야간 조명쇼 및 피크닉 존 운영.',
    tags: ['#산리오캐릭터즈', '#롯데월드타워', '#월드파크', '#석촌호수', '#야외전시'],
    reservationUrl: 'https://www.lwt.co.kr',
    websiteUrl: 'https://www.lwt.co.kr',
    officialQuery: '잠실 롯데월드타워 산리오 팝업스토어 포스터',
    imageUrl: '',
    poster: '',
    category: '팝업스토어',
  },
]

// [인메모리 캐시 (1시간 = 3600초 유지)]
let serverCachedPopups: PopupItem[] = MASTER_CURATED_POPUPS
let cacheExpiresAt = 0

// [Gemini AI 플래시 모델을 활용한 25~30선 실시간 팝업 큐레이션]
async function curateWithGemini(apiKey: string): Promise<PopupItem[]> {
  const ai = new GoogleGenAI({ apiKey })
  const models = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest']

  const prompt = `현재 2026년 기준 서울의 핵심 5대 팝업스토어 성지인 [성수, 더현대, 홍대, 강남, 잠실]에서 실제로 열리고 있거나 가장 핫한 팝업스토어 25~30개를 큐레이션해주세요.
각 지역별로 반드시 5~6개씩 균등하게 구성해주세요.

반드시 아래 JSON 스키마 규격의 JSON 배열 하나만 반환해주세요:
[
  {
    "id": "popup_지역영문_숫자 (예: popup_seongsu_1)",
    "title": "정확한 브랜드 및 행사명 (예: 샤넬 코코 크러쉬 팝업스토어)",
    "region": "성수 | 더현대 | 홍대 | 강남 | 잠실 중 정확히 하나",
    "location": "[지역] 서울 상세 도로명 주소 및 건물/매장명",
    "date": "운영 기간: YYYY.MM.DD ~ YYYY.MM.DD (진행 중 또는 D-Day)",
    "fee": "무료/유료 및 예약/현장대기 안내 (예: 무료 관람 (사전예약/현장대기))",
    "description": "핵심 볼거리, 굿즈 증정, 팝업 요약 2~3줄",
    "tags": ["#굿즈", "#포토존", "#사전예약", "#지역핫플 등 해시태그 3~5개"],
    "reservationUrl": "네이버 예약, 캐치테이블 또는 공식 SNS/웹 링크",
    "officialQuery": "실제 포스터 이미지 검색용 쿼리 (예: 성수 샤넬 팝업스토어 포스터)"
  }
]`

  for (const model of models) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout for ${model}`)), 4500),
      )
      const generatePromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      })

      const response = await Promise.race([generatePromise, timeoutPromise])

      const raw = response.text?.trim()
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length >= 15) {
          return parsed.map((item, idx) => {
            const region = (item.region || '성수').trim()
            const id = item.id || `popup_${idx}_${Date.now()}`
            const fee = item.fee || '무료 관람 (현장 대기)'

            return {
              id,
              title: item.title || '서울 트렌디 팝업스토어',
              region,
              location: item.location || `[${region}] 서울 도심 팝업존`,
              date: item.date || '2026. 10. 15 ~ 11. 30 (진행 중)',
              fee,
              price: fee,
              description: item.description || `${item.title} 팝업 행사. 현장 이벤트와 한정판 굿즈를 만나보세요.`,
              tags: Array.isArray(item.tags) ? item.tags : ['#팝업', `#${region}`, '#핫플레이스'],
              reservationUrl: item.reservationUrl || 'https://m.booking.naver.com',
              websiteUrl:
                item.reservationUrl ||
                'https://m.search.naver.com/search.naver?query=' +
                  encodeURIComponent(item.title || '팝업스토어'),
              officialQuery: item.officialQuery || `${item.title} 포스터`,
              imageUrl: '',
              poster: '',
              category: '팝업스토어',
            } as PopupItem
          })
        }
      }
    } catch (err) {
      console.warn(`[popple-popups] Model ${model} generation failed, falling back:`, err)
    }
  }

  return []
}

// -------------------------------------------------------------
// [큐레이션된 팝업스토어 목록 조회 함수 (API 라우트 및 AI 추천 공용)]
// -------------------------------------------------------------
export async function getCuratedPopups(regionParam?: string): Promise<PopupItem[]> {
  const now = Date.now()
  let popupsPool: PopupItem[] = []

  // 1) 1시간 유효 캐시가 있으면 즉시 재사용
  if (serverCachedPopups && serverCachedPopups.length >= 20 && now < cacheExpiresAt) {
    popupsPool = serverCachedPopups
  } else {
    // 2) Gemini AI 큐레이션 시도
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        const geminiItems = await curateWithGemini(geminiApiKey)
        if (geminiItems && geminiItems.length >= 20) {
          popupsPool = geminiItems
        }
      } catch (err) {
        console.warn('[popple-popups] Gemini curation failed:', err)
      }
    }

    // 3) 부족할 경우 28선 마스터 데이터셋과 병합하여 무조건 25~30개 이상 확보
    if (popupsPool.length < 20) {
      popupsPool = MASTER_CURATED_POPUPS
    }

    // 4) [1순위: og:image 추출 & 2순위: 네이버 이미지 검색 API] 병렬 해석
    const clientId = process.env.NAVER_CLIENT_ID
    const clientSecret = process.env.NAVER_CLIENT_SECRET

    try {
      const resolvePromises = popupsPool.map(async (p) => {
        // 이미 유효한 공식 이미지가 있는 경우 스킵
        if (p.imageUrl && p.imageUrl.startsWith('http') && !p.imageUrl.includes('unsplash.com')) {
          return
        }
        const resolved = await resolvePopupPosterImage(
          p.title,
          [p.reservationUrl, p.websiteUrl],
          clientId,
          clientSecret,
        )
        if (resolved) {
          p.imageUrl = resolved
          p.poster = resolved
        } else {
          p.imageUrl = ''
          p.poster = ''
        }
      })

      // 비동기 병렬로 최대 1.8초간 이미지 해석 실행 (개별 1.5s 타임아웃과 연동)
      await Promise.race([
        Promise.allSettled(resolvePromises),
        new Promise((resolve) => setTimeout(resolve, 1800)),
      ])
    } catch (err) {
      console.warn('[popple-popups] Poster image resolution error:', err)
    }

    // 5) 시각적 우선 정렬 (Visual-first sorting) 적용 후 캐시 저장 (1시간)
    popupsPool = sortPopupsVisualFirst(popupsPool)
    serverCachedPopups = popupsPool
    cacheExpiresAt = now + 3600 * 1000
  }

  // 6) 지역 필터링 ('전체' 또는 파라미터가 없으면 전체 반환)
  let filtered = popupsPool
  if (regionParam && regionParam !== '전체' && regionParam !== 'all') {
    filtered = popupsPool.filter((p) => {
      if (p.region === regionParam) return true
      const combined = `${p.title} ${p.location} ${(p.tags || []).join(' ')}`.toLowerCase()
      if (regionParam === '더현대') {
        return combined.includes('더현대') || combined.includes('여의도')
      }
      return combined.includes(regionParam.toLowerCase())
    })
  }

  // 필터링 결과에도 시각적 우선 정렬 유지
  return sortPopupsVisualFirst(filtered)
}

// -------------------------------------------------------------
// [메인 API GET 핸들러]
// -------------------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const regionParam = (searchParams.get('region') || searchParams.get('category') || '').trim()
  const startParam = (searchParams.get('startDate') || '').replace(/\D/g, '')
  const endParam = (searchParams.get('endDate') || '').replace(/\D/g, '')

  let filtered = await getCuratedPopups(regionParam)

  // 주간 날짜 범위 파라미터(startDate, endDate) 필터링: 주간에 운영 중인 팝업만 반환
  if (startParam && endParam) {
    filtered = filtered.filter((p) => isEventOperatingInRange(p, startParam, endParam))
  }

  return Response.json({
    popups: filtered,
    total: filtered.length,
    allCount: serverCachedPopups.length,
    cached: Date.now() < cacheExpiresAt,
  })
}
