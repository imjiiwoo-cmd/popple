'use client'

import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  Check,
  Ticket,
  Calendar,
  Home,
  Users,
  User,
  MapPin,
  Store,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import {
  type PoppleCoupon,
  getUserCoupons,
  saveUserCoupons,
  resetUserCoupons,
} from '@/lib/coupons'

interface CouponScreenProps {
  onBack: () => void
  onOpenHome: () => void
  onOpenEvents: () => void
  onOpenCommunity: () => void
  onOpenMy: () => void
}

export function CouponScreen({
  onBack,
  onOpenHome,
  onOpenEvents,
  onOpenCommunity,
  onOpenMy,
}: CouponScreenProps) {
  const [coupons, setCoupons] = useState<PoppleCoupon[]>(() => getUserCoupons())
  const [activeTab, setActiveTab] = useState<'available' | 'used'>('available')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 사장님(직원) 확인 컨펌 모달 상태
  const [confirmModalCoupon, setConfirmModalCoupon] = useState<PoppleCoupon | null>(null)

  useEffect(() => {
    setCoupons(getUserCoupons())
  }, [])

  // 토스트 메시지 출력
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 2500)
  }

  // [직원 확인 (사용하기)] 클릭 시 컨펌 모달 오픈
  const handleOpenConfirmModal = (coupon: PoppleCoupon) => {
    setConfirmModalCoupon(coupon)
  }

  // 모달 닫기
  const handleCloseConfirmModal = () => {
    setConfirmModalCoupon(null)
  }

  // 사장님(직원) 사용 완료 최종 처리
  const handleConfirmUseCoupon = () => {
    if (!confirmModalCoupon) return

    const updated = coupons.map((c) => {
      if (c.id === confirmModalCoupon.id) {
        return {
          ...c,
          isUsed: true,
          usedAt: Date.now(),
        }
      }
      return c
    })

    setCoupons(updated)
    saveUserCoupons(updated)
    setConfirmModalCoupon(null)
    showToast(`🎉 [${confirmModalCoupon.title}] 체험 완료 처리가 되었습니다!`)
  }

  // 테스트/데모용 쿠폰 초기화
  const handleResetCoupons = () => {
    const fresh = resetUserCoupons()
    setCoupons(fresh)
    setActiveTab('available')
    showToast('모든 상생 쿠폰이 새로 발급되었습니다! 🎟️')
  }

  // 사용 가능 / 지난 쿠폰 필터링
  const availableCoupons = coupons.filter((c) => !c.isUsed)
  const usedCoupons = coupons.filter((c) => c.isUsed)
  const displayedCoupons = activeTab === 'available' ? availableCoupons : usedCoupons

  return (
    <div className="relative flex flex-col min-h-dvh bg-slate-50 text-slate-900 pb-24">
      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-slate-700">
            <Check className="size-4 text-emerald-400 stroke-[2.5]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 1. 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="뒤로가기"
              className="-ml-1.5 p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-6" />
            </button>
            <h1 className="text-lg font-black text-slate-900">쿠폰함</h1>
          </div>
          <span className="text-xs font-bold text-[#1884F7] bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
            보유 {availableCoupons.length}장
          </span>
        </div>
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="mx-auto w-full max-w-md px-4 py-4 flex flex-col gap-4">
        {/* 상생 바우처 안내 헤더 카드 */}
        <section aria-label="상생 바우처 안내" className="rounded-2xl bg-gradient-to-r from-sky-500 to-[#1884F7] p-4 text-white shadow-xs flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-extrabold tracking-widest text-sky-100 uppercase">
              LOCAL VOUCHER
            </span>
            <p className="text-sm font-black leading-snug">
              행사장 인근 제휴 상생 모바일 바우처
            </p>
            <p className="text-[11px] text-sky-100/90 font-medium">
              결제 시 매장 직원에게 화면을 보여주고 즉시 할인 받으세요!
            </p>
          </div>
          <div className="size-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0">
            🎉
          </div>
        </section>

        {/* 탭 버튼: [사용 가능한 쿠폰] / [지난 쿠폰] */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'available'
                ? 'bg-white text-[#1884F7] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            사용 가능 ({availableCoupons.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('used')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'used'
                ? 'bg-white text-[#1884F7] shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            지난 쿠폰 ({usedCoupons.length})
          </button>
        </div>

        {/* 시범 운영(Beta) 기능 체험용 가상 쿠폰 상단 안내 카드 */}
        <div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-3.5 flex items-start gap-2.5 shadow-2xs">
          <span className="text-base leading-none shrink-0 mt-0.5">💡</span>
          <p className="text-xs font-semibold text-slate-700 leading-relaxed break-keep">
            Popple 시범 운영(Beta) 기간 동안 제공되는 기능 체험용 가상 쿠폰입니다.{' '}
            <span className="text-slate-500 font-bold">(실제 매장 사용 불가)</span>
          </p>
        </div>

        {/* 3. 쿠폰 목록 세로 카드 리스트 */}
        {displayedCoupons.length === 0 ? (
          /* 빈 화면 안내 (Empty State) */
          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xs flex flex-col items-center gap-3.5 my-4">
            <div className="size-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
              <Ticket className="size-7 stroke-[1.8]" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-black text-slate-800">
                {activeTab === 'available'
                  ? '보유 중인 쿠폰이 없어요.'
                  : '지난 쿠폰 내역이 없습니다.'}
              </h3>
              <p className="text-xs text-slate-400 break-keep leading-relaxed">
                {activeTab === 'available'
                  ? '축제와 팝업스토어 인근 상권에서 사용할 수 있는 다양한 혜택이 곧 추가될 예정입니다!'
                  : '사용한 쿠폰이나 만료된 쿠폰이 여기에 표시됩니다.'}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {activeTab === 'available' && (
                <button
                  type="button"
                  onClick={onOpenEvents}
                  className="bg-[#1884F7] hover:bg-[#0F75E8] text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  축제 둘러보기
                </button>
              )}
              {usedCoupons.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetCoupons}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>쿠폰 다시 받기</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {displayedCoupons.map((coupon) => (
              <article
                key={coupon.id}
                className={`relative rounded-2xl bg-white p-4 sm:p-5 border shadow-xs transition-all flex flex-col gap-3 group overflow-hidden ${
                  coupon.isUsed
                    ? 'border-slate-200 bg-slate-50/60 opacity-80'
                    : 'border-slate-200/80 hover:shadow-md hover:border-sky-200'
                }`}
              >
                {/* 상단: 굵은 할인 금액 + 카테고리 태그 뱃지 + 우측 폭죽 아이콘 ('🎉') */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black text-[#1884F7] tracking-tight">
                        {coupon.discount}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${coupon.badgeBg}`}
                      >
                        {coupon.badge}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        체험용
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                      {coupon.title}
                    </h2>
                  </div>

                  {/* 우측 폭죽 이모지('🎉') 미니 그래픽 뱃지 */}
                  <div
                    className="size-12 rounded-2xl bg-sky-50 border border-sky-100/80 shadow-2xs shrink-0 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform"
                    title="지역 상생 모바일 바우처"
                  >
                    🎉
                  </div>
                </div>

                {/* 서브: 사용 가능 장소 & 최소 결제 조건 및 사용 기한 */}
                <div className="flex flex-col gap-1 text-xs font-medium bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <MapPin className="size-3.5 text-[#1884F7] shrink-0" />
                    <span className="truncate">{coupon.place}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Calendar className="size-3 text-slate-400 shrink-0" />
                    <span>{coupon.description}</span>
                  </div>
                </div>

                {/* 하단: 현장 제시형 인터랙션 UI (요건 1 & 2) */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  {coupon.isUsed ? (
                    /* 지난 쿠폰 탭 / 사용 완료 스탬프 */
                    <div className="flex items-center justify-between py-1 px-1">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {coupon.usedAt
                          ? `${new Date(coupon.usedAt).toLocaleDateString()} 현장 사용 완료`
                          : '현장 사용 완료된 바우처'}
                      </span>
                      <span className="border-2 border-slate-300 text-slate-500 text-xs font-black px-3 py-1 rounded-xl bg-slate-100 select-none">
                        ✓ 사용 완료
                      </span>
                    </div>
                  ) : (
                    /* 사용 가능 쿠폰 탭 */
                    <div className="flex flex-col gap-2">
                      {/* 작은 회색 안내 문구 */}
                      <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <span>💡</span>
                        <span>결제 시 매장 직원에게 이 화면을 보여주세요.</span>
                      </p>

                      {/* [직원 확인 (사용하기)] 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleOpenConfirmModal(coupon)}
                        className="w-full bg-[#1884F7] hover:bg-[#0F75E8] active:scale-[0.99] text-white text-xs font-bold py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Store className="size-3.5 stroke-[2.5]" />
                        <span>직원 확인 (사용하기)</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* [직원 확인] 시범 운영 안내 모달 */}
      {confirmModalCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center gap-3 animate-in zoom-in-95 duration-200">
            {/* 상단 아이콘 */}
            <div className="size-13 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-2xl text-[#1884F7]">
              💡
            </div>

            {/* 타이틀 및 바우처 정보 */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-black text-slate-900">
                Popple 서비스 시범 운영 안내
              </h3>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 my-0.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-800 line-clamp-1">
                    {confirmModalCoupon.title}
                  </p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 shrink-0">
                    체험용
                  </span>
                </div>
                <p className="text-sm font-black text-[#1884F7] mt-0.5">
                  {confirmModalCoupon.discount} 할인
                </p>
              </div>
              <p className="text-xs text-slate-600 font-medium break-keep leading-relaxed">
                현재 화면은 서비스 기능 체험을 위한 가상 인터랙션입니다. 실제 현장 제휴 매장에서는 사용하실 수 없습니다. 곧 정식 제휴 혜택으로 찾아오겠습니다!
              </p>
            </div>

            {/* 하단 닫기 / 체험 완료해보기 버튼 */}
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={handleCloseConfirmModal}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleConfirmUseCoupon}
                className="flex-1 bg-[#1884F7] hover:bg-[#0F75E8] active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-sky-500/20 cursor-pointer"
              >
                체험 완료해보기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 하단 고정 네비게이션 바: 마이(활성) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg">
        <div className="mx-auto max-w-md flex items-center justify-around py-2">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Home className="size-5" />
            <span>홈</span>
          </button>

          <button
            type="button"
            onClick={onOpenEvents}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Calendar className="size-5" />
            <span>행사</span>
          </button>

          <button
            type="button"
            onClick={onOpenCommunity}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Users className="size-5" />
            <span>커뮤니티</span>
          </button>

          <button
            type="button"
            onClick={onOpenMy}
            className="flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-bold text-[#1884F7] transition-colors"
          >
            <User className="size-5" />
            <span>마이</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
