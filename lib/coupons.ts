export interface PoppleCoupon {
  id: string
  code?: string
  discount: string
  badge: string
  badgeBg: string
  title: string
  place: string
  description: string
  validUntil: string
  icon?: string
  characterImg?: string
  characterBg?: string
  isUsed?: boolean
  usedAt?: number
}

export const INITIAL_COUPONS: PoppleCoupon[] = [
  {
    id: 'coupon-1',
    code: 'POPPLE-LOCAL-5000',
    discount: '5,000원',
    badge: '#지역상생',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title: '행사장 인근 제휴 맛집·카페 5천원 할인',
    place: '행사장 반경 2km 이내 등록 제휴 가맹점',
    description: '최소 결제 금액 15,000원 이상 • 현장 결제 시 제시',
    validUntil: '2026.11.30까지',
    icon: '🎉',
  },
  {
    id: 'coupon-2',
    code: 'POPPLE-BOOTH-3000',
    discount: '3,000원',
    badge: '#축제부스',
    badgeBg: 'bg-blue-50 text-[#1884F7] border-blue-200',
    title: '주말 축제 플리마켓·체험부스 전용 바우처',
    place: '축제 행사장 내 공식 인증 체험·판매 부스',
    description: '최소 주문 금액 10,000원 이상 • 현장 결제 시 제시',
    validUntil: '2026.11.30까지',
    icon: '🎉',
  },
  {
    id: 'coupon-3',
    code: 'POPPLE-WELCOME-10K',
    discount: '10,000원',
    badge: '#웰컴바우처',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    title: '팝플 축제 나들이 웰컴 상생 바우처 1만원권',
    place: '전국 축제·팝업 공식 제휴 가맹점 전점',
    description: '최소 결제 금액 30,000원 이상 • 현장 결제 시 제시',
    validUntil: '2026.12.31까지',
    icon: '🎉',
  },
]

const COUPONS_STORAGE_KEY = 'popple_user_coupons_v2'

export function getUserCoupons(): PoppleCoupon[] {
  if (typeof window === 'undefined') return INITIAL_COUPONS
  try {
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(INITIAL_COUPONS))
      return INITIAL_COUPONS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COUPONS
  } catch {
    return INITIAL_COUPONS
  }
}

export function saveUserCoupons(coupons: PoppleCoupon[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons))
  } catch (e) {
    console.error('Failed to save coupons:', e)
  }
}

export function resetUserCoupons(): PoppleCoupon[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(INITIAL_COUPONS))
  }
  return INITIAL_COUPONS
}
