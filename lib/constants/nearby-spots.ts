/**
 * 행사 인근 추천 핫플 (도보 거리 식당 1곳 + 카페 1곳) 및 가상 쿠폰 데이터셋
 * 행사의 장소(location) 또는 제목을 기반으로 100% 매칭되어
 * 지도 안내 아래, 방문 후기 위에 일관된 카드 규격으로 렌더링됩니다.
 */

export interface NearbyCoupon {
  title: string
  discount: string
  dday: string
  code: string
  benefit: string
  validUntil: string
}

export interface NearbySpot {
  id: string
  category: '식당' | '카페'
  name: string
  distance: string
  tag: string
  imageUrl: string
  coupon: NearbyCoupon
}

// 1. 성수 권역 (성동구, 성수동 일대)
const SEONGSU_RESTAURANT: NearbySpot = {
  id: 'spot_seongsu_food',
  category: '식당',
  name: '[성수] 소문난성수감자탕',
  distance: '도보 3분 · 210m',
  tag: '#감자탕맛집 #줄서는식당 #성수핫플',
  imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '포플러 전용 10% 할인',
    discount: '10% OFF',
    dday: 'D-7',
    code: 'POPPLE-SEONGSU-10',
    benefit: '식사 메뉴 2인 이상 주문 시 10% 현장 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const SEONGSU_CAFE: NearbySpot = {
  id: 'spot_seongsu_cafe',
  category: '카페',
  name: '[성수] 대림창고 갤러리카페',
  distance: '도보 4분 · 280m',
  tag: '#스페셜티커피 #베이커리디저트 #전시공간',
  imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '음료 주문 시 1,000원 할인',
    discount: '1,000원 OFF',
    dday: 'D-14',
    code: 'POPPLE-DAELIM-1K',
    benefit: '제조 음료 주문 시 1,000원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 2. 종로/광화문/경복궁/서촌 권역
const JONGNO_RESTAURANT: NearbySpot = {
  id: 'spot_jongno_food',
  category: '식당',
  name: '[종로] 토속촌 삼계탕 본점',
  distance: '도보 5분 · 340m',
  tag: '#미쉐린가이드 #보양식 #경복궁맛집',
  imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '포플러 전용 10% 할인',
    discount: '10% OFF',
    dday: 'D-10',
    code: 'POPPLE-JONGNO-10',
    benefit: '식사 메뉴 주문 시 10% 현장 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const JONGNO_CAFE: NearbySpot = {
  id: 'spot_jongno_cafe',
  category: '카페',
  name: '[서촌] 통인스윗 에그타르트 & 커피',
  distance: '도보 3분 · 220m',
  tag: '#수제에그타르트 #핸드드립 #서촌디저트',
  imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '타르트 세트 1,500원 할인',
    discount: '1,500원 OFF',
    dday: 'D-7',
    code: 'POPPLE-TONGIN-15',
    benefit: '음료 + 타르트 2개 세트 구매 시 1,500원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 3. 잠실/송파 권역
const JAMSIL_RESTAURANT: NearbySpot = {
  id: 'spot_jamsil_food',
  category: '식당',
  name: '[송리단길] 다운타우너 잠실',
  distance: '도보 4분 · 260m',
  tag: '#수제버거맛집 #송리단길핫플 #치즈버거',
  imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '버거 세트 10% 할인',
    discount: '10% OFF',
    dday: 'D-7',
    code: 'POPPLE-DOWNTOWN-10',
    benefit: '버거 세트 메뉴 주문 시 10% 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const JAMSIL_CAFE: NearbySpot = {
  id: 'spot_jamsil_cafe',
  category: '카페',
  name: '[송리단길] 뷰클런즈 드립커피',
  distance: '도보 5분 · 310m',
  tag: '#스웨덴감성 #필터커피 #디저트카페',
  imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '드립커피 1,000원 할인',
    discount: '1,000원 OFF',
    dday: 'D-12',
    code: 'POPPLE-SWEDISH-1K',
    benefit: '필터 드립커피 주문 시 1,000원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 4. 홍대/연남/마포 권역
const HONGDAE_RESTAURANT: NearbySpot = {
  id: 'spot_hongdae_food',
  category: '식당',
  name: '[연남] 소이연남 태국국수',
  distance: '도보 4분 · 270m',
  tag: '#소고기국수 #연남동웨이팅 #태국요리',
  imageUrl: 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '식사 10% 현장 할인',
    discount: '10% OFF',
    dday: 'D-7',
    code: 'POPPLE-SOYYEON-10',
    benefit: '국수 및 사이드 주문 시 10% 현장 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const HONGDAE_CAFE: NearbySpot = {
  id: 'spot_hongdae_cafe',
  category: '카페',
  name: '[홍대] 테일러커피 서교본점',
  distance: '도보 3분 · 210m',
  tag: '#크림모카 #아인슈페너 #시그니처커피',
  imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '시그니처 음료 1,000원 할인',
    discount: '1,000원 OFF',
    dday: 'D-14',
    code: 'POPPLE-TAILOR-1K',
    benefit: '시그니처 커피 메뉴 주문 시 1,000원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 5. 강남/서초 권역
const GANGNAM_RESTAURANT: NearbySpot = {
  id: 'spot_gangnam_food',
  category: '식당',
  name: '[강남] 땀땀 매운소곱창쌀국수',
  distance: '도보 4분 · 250m',
  tag: '#줄서는식당 #보양쌀국수 #강남맛집',
  imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '포플러 전용 10% 할인',
    discount: '10% OFF',
    dday: 'D-7',
    code: 'POPPLE-TAMTAM-10',
    benefit: '메인 쌀국수 주문 시 10% 현장 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const GANGNAM_CAFE: NearbySpot = {
  id: 'spot_gangnam_cafe',
  category: '카페',
  name: '[신논현] 알베르 베이커리 카페',
  distance: '도보 3분 · 190m',
  tag: '#숲속느낌대형카페 #티라미수 #베이커리',
  imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '베이커리 15% 할인',
    discount: '15% OFF',
    dday: 'D-10',
    code: 'POPPLE-ALVER-15',
    benefit: '베이커리 2종 이상 구매 시 15% 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 6. 수원/행궁동 권역
const SUWON_RESTAURANT: NearbySpot = {
  id: 'spot_suwon_food',
  category: '식당',
  name: '[수원] 통닭거리 진미통닭 & 솥뚜껑갈비',
  distance: '도보 4분 · 260m',
  tag: '#수원통닭거리 #미디어아트맛집 #화성행궁',
  imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '포플러 전용 10% 할인',
    discount: '10% OFF',
    dday: 'D-8',
    code: 'POPPLE-SUWON-10',
    benefit: '식사 메뉴 2인 이상 주문 시 10% 현장 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const SUWON_CAFE: NearbySpot = {
  id: 'spot_suwon_cafe',
  category: '카페',
  name: '[행궁동] 정지영커피로스터즈 화홍문점',
  distance: '도보 3분 · 210m',
  tag: '#행궁동카페 #루프탑뷰 #스페셜티커피',
  imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '음료 주문 시 1,000원 할인',
    discount: '1,000원 OFF',
    dday: 'D-12',
    code: 'POPPLE-JUNGJI-1K',
    benefit: '제조 음료 주문 시 1,000원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

// 7. 전국/지역 공통 기본 (Fallback)
const DEFAULT_RESTAURANT: NearbySpot = {
  id: 'spot_default_food',
  category: '식당',
  name: '[인근] 로컬 다이닝 & 캐주얼 키친',
  distance: '도보 3분 · 210m',
  tag: '#인근맛집 #로컬푸드 #데이트코스',
  imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '포플러 전용 10% 할인',
    discount: '10% OFF',
    dday: 'D-7',
    code: 'POPPLE2026',
    benefit: '식사 메뉴 2인 이상 주문 시 10% 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

const DEFAULT_CAFE: NearbySpot = {
  id: 'spot_default_cafe',
  category: '카페',
  name: '[인근] 아틀리에 로스터리 카페',
  distance: '도보 4분 · 250m',
  tag: '#스페셜티커피 #수제디저트 #감성카페',
  imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=600&q=80',
  coupon: {
    title: '음료 주문 시 1,000원 할인',
    discount: '1,000원 OFF',
    dday: 'D-14',
    code: 'POPPLECAFE',
    benefit: '제조 음료 주문 시 1,000원 즉시 할인',
    validUntil: '2026.11.30까지',
  },
}

/**
 * 행사 위치(location) 또는 제목을 분석하여 가장 가까운 도보 핫플(식당 1곳 + 카페 1곳) 반환
 */
export function getNearbySpotsForEvent(location?: string, title?: string): [NearbySpot, NearbySpot] {
  const target = `${location || ''} ${title || ''}`.toLowerCase()

  if (target.includes('성수')) {
    return [SEONGSU_RESTAURANT, SEONGSU_CAFE]
  }
  if (
    target.includes('경복궁') ||
    target.includes('광화문') ||
    target.includes('종로') ||
    target.includes('서촌') ||
    target.includes('북촌')
  ) {
    return [JONGNO_RESTAURANT, JONGNO_CAFE]
  }
  if (target.includes('수원') || target.includes('화성')) {
    return [SUWON_RESTAURANT, SUWON_CAFE]
  }
  if (
    target.includes('잠실') ||
    target.includes('송파') ||
    target.includes('석촌') ||
    target.includes('롯데')
  ) {
    return [JAMSIL_RESTAURANT, JAMSIL_CAFE]
  }
  if (
    target.includes('홍대') ||
    target.includes('연남') ||
    target.includes('마포') ||
    target.includes('망원') ||
    target.includes('하늘공원')
  ) {
    return [HONGDAE_RESTAURANT, HONGDAE_CAFE]
  }
  if (
    target.includes('강남') ||
    target.includes('역삼') ||
    target.includes('서초') ||
    target.includes('반포') ||
    target.includes('신사')
  ) {
    return [GANGNAM_RESTAURANT, GANGNAM_CAFE]
  }

  return [DEFAULT_RESTAURANT, DEFAULT_CAFE]
}

export interface PartnershipCouponSpot extends NearbySpot {
  linkedEventTitle: string
  linkedEventId: string
  area: string
  connectionText: string
}

/**
 * 마이페이지 및 상생 제휴 혜택 모아보기에 노출할 대표 상생 쿠폰 목록
 */
export const ALL_PARTNERSHIP_SPOTS: PartnershipCouponSpot[] = [
  {
    ...SEONGSU_CAFE,
    name: '[성수] 대림창고 갤러리카페',
    linkedEventTitle: '디올 성수 2026 어텀/윈터 가든 아카이브 팝업',
    linkedEventId: 'popup_preset_01',
    area: '성수',
    connectionText: '디올 성수 도보 4분',
  },
  {
    ...SEONGSU_RESTAURANT,
    name: '[성수] 소문난성수감자탕',
    linkedEventTitle: '디올 성수 2026 어텀/윈터 가든 아카이브 팝업',
    linkedEventId: 'popup_preset_01',
    area: '성수',
    connectionText: '디올 성수 도보 3분',
  },
  {
    ...SUWON_RESTAURANT,
    name: '[수원] 통닭거리 진미통닭 & 솥뚜껑갈비',
    linkedEventTitle: '수원화성 미디어아트 & 가을 문화제',
    linkedEventId: 'fest_preset_06',
    area: '수원/행궁동',
    connectionText: '수원화성 도보 4분',
  },
  {
    ...SUWON_CAFE,
    name: '[행궁동] 정지영커피로스터즈 화홍문점',
    linkedEventTitle: '수원화성 미디어아트 & 가을 문화제',
    linkedEventId: 'fest_preset_06',
    area: '수원/행궁동',
    connectionText: '수원화성 도보 3분',
  },
  {
    ...JONGNO_RESTAURANT,
    name: '[종로] 토속촌 삼계탕 본점',
    linkedEventTitle: '경복궁 가을 야간특별관람',
    linkedEventId: 'fest_preset_01',
    area: '종로/서촌',
    connectionText: '경복궁 도보 5분',
  },
  {
    ...JONGNO_CAFE,
    name: '[서촌] 통인스윗 에그타르트 & 커피',
    linkedEventTitle: '경복궁 가을 야간특별관람',
    linkedEventId: 'fest_preset_01',
    area: '종로/서촌',
    connectionText: '경복궁 도보 3분',
  },
  {
    ...HONGDAE_CAFE,
    name: '[홍대] 테일러커피 서교본점',
    linkedEventTitle: '서울 하늘공원 은빛 억새 페스티벌',
    linkedEventId: 'fest_preset_04',
    area: '홍대/마포',
    connectionText: '하늘공원 & 홍대 도보 3분',
  },
  {
    ...JAMSIL_RESTAURANT,
    name: '[송리단길] 다운타우너 잠실',
    linkedEventTitle: '잠실 롯데월드몰 팝업 & 석촌호수 페스타',
    linkedEventId: 'fest_preset_05',
    area: '잠실/송파',
    connectionText: '석촌호수 도보 4분',
  },
]
