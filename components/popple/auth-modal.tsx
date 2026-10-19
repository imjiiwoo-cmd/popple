'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  X,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (user: SupabaseUser) => void
  defaultTab?: 'login' | 'signup'
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = 'login',
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab)

  // 1. 공통 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 2. 회원가입 전용 상태
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [emailCheckStatus, setEmailCheckStatus] = useState<
    'idle' | 'checking' | 'available' | 'duplicate' | 'invalid'
  >('idle')
  const [emailCheckMessage, setEmailCheckMessage] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)

  if (!isOpen) return null

  // 이메일 정규식 검사
  const isValidEmailFormat = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
  }

  // 이메일 중복 확인 핸들러
  const handleCheckEmailDuplicate = async () => {
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailCheckStatus('invalid')
      setEmailCheckMessage('이메일 주소를 입력해주세요.')
      return
    }

    if (!isValidEmailFormat(trimmed)) {
      setEmailCheckStatus('invalid')
      setEmailCheckMessage('올바른 이메일 형식을 입력해주세요. (예: example@email.com)')
      return
    }

    setEmailCheckStatus('checking')
    setEmailCheckMessage(null)

    try {
      // Supabase Auth에 임의 비밀번호로 로그인 시도하여 계정 존재 여부 판별
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password: '__check_probe_dummy_12345!__',
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('email not confirmed')) {
          setEmailCheckStatus('duplicate')
          setEmailCheckMessage('이미 가입된 이메일입니다. 메일함에서 인증을 완료해주세요.')
          return
        }
      }

      // 사용 가능 상태로 판별
      setEmailCheckStatus('available')
      setEmailCheckMessage('사용 가능한 이메일입니다.')
    } catch {
      setEmailCheckStatus('available')
      setEmailCheckMessage('사용 가능한 이메일입니다.')
    }
  }

  // 1) 로그인 제출 핸들러
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.')
      return
    }
    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('email not confirmed')) {
          setErrorMessage('이메일 인증을 완료해주세요. 가입하신 메일함의 확인 링크를 클릭해주세요.')
        } else if (msg.includes('invalid login credentials')) {
          setErrorMessage('계정 정보를 확인해주세요. 이메일 또는 비밀번호가 올바르지 않습니다.')
        } else {
          setErrorMessage(error.message)
        }
        return
      }

      if (data.user) {
        onSuccess?.(data.user)
        onClose()
      }
    } catch {
      setErrorMessage('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  // 2) 회원가입 제출 핸들러
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedEmail = email.trim()
    const trimmedNickname = nickname.trim()

    if (!trimmedEmail || !isValidEmailFormat(trimmedEmail)) {
      setErrorMessage('올바른 이메일 주소를 입력해주세요.')
      return
    }

    if (!trimmedNickname || trimmedNickname.length < 2) {
      setErrorMessage('닉네임은 2자 이상 입력해주세요.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            nickname: trimmedNickname,
          },
          emailRedirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('already registered')) {
          setErrorMessage('이미 가입된 이메일입니다. 로그인 탭에서 로그인해주세요.')
        } else {
          setErrorMessage(error.message)
        }
        return
      }

      // Supabase 보안 정책으로 이미 등록된 사용자는 identities가 비어있음
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMessage('이미 가입된 이메일 계정입니다. 로그인 탭을 이용해주세요.')
        return
      }

      // 가입 성공 -> 인증 안내 화면 전환
      setSignupSuccess(true)
    } catch {
      setErrorMessage('회원가입 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  // 폼 리셋
  const handleTabChange = (tab: 'login' | 'signup') => {
    setActiveTab(tab)
    setErrorMessage(null)
    setEmailCheckStatus('idle')
    setEmailCheckMessage(null)
    setSignupSuccess(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Image
              src="/images/popple-logo.png"
              alt="Popple"
              width={75}
              height={26}
              className="h-6 w-auto object-contain"
            />
            <span className="text-[11px] font-black text-[#1884F7] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
              {activeTab === 'login' ? '로그인' : '회원가입'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 회원가입 성공 완료 안내 화면 */}
        {signupSuccess ? (
          <div className="p-6 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="size-16 rounded-3xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#1884F7] shadow-xs">
              <Mail className="size-8 stroke-[2]" />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center justify-center gap-1 text-xs font-bold text-[#1884F7]">
                <Sparkles className="size-3.5" />
                <span>회원가입 메일 발송 완료</span>
              </div>
              <h3 className="text-lg font-black text-slate-900 leading-snug">
                인증 메일이 발송되었습니다!
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-1 break-keep">
                <strong className="text-slate-800 font-bold">{email}</strong> 으로 인증 메일이 발송되었습니다.
                <br />
                메일함의 링크를 클릭해 인증을 완료해주세요!
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-3 text-[11px] text-slate-500 text-left space-y-1 border border-slate-100">
              <p className="font-bold text-slate-700">💡 안내사항</p>
              <p>• 메일이 오지 않은 경우 스팸 메일함을 확인해주세요.</p>
              <p>• 인증 완료 후 아래 버튼을 눌러 로그인할 수 있습니다.</p>
            </div>

            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className="w-full bg-[#1884F7] hover:bg-[#0F75E8] active:scale-[0.99] text-white font-bold py-3.5 rounded-2xl text-xs shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <span>로그인 화면으로 이동</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* 탭 전환 버튼 */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleTabChange('login')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'login'
                    ? 'bg-white text-[#1884F7] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('signup')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'signup'
                    ? 'bg-white text-[#1884F7] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                회원가입
              </button>
            </div>

            {/* 에러 메시지 알림 */}
            {errorMessage && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-3 text-xs">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-snug font-medium break-keep">{errorMessage}</span>
              </div>
            )}

            {/* ======================= 로그인 탭 ======================= */}
            {activeTab === 'login' ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
                {/* 이메일 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">이메일</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      required
                      className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 비밀번호 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">비밀번호</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="비밀번호 입력"
                      required
                      className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600"
                      aria-label="비밀번호 표시/숨김"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* 로그인 제출 버튼 */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 bg-[#1884F7] hover:bg-[#0F75E8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>로그인</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleTabChange('signup')}
                    className="text-xs text-slate-500 hover:text-[#1884F7] font-semibold transition-colors"
                  >
                    아직 계정이 없으신가요? <span className="text-[#1884F7] underline">회원가입하기</span>
                  </button>
                </div>
              </form>
            ) : (
              /* ======================= 회원가입 탭 ======================= */
              <form onSubmit={handleSignup} className="flex flex-col gap-3">
                {/* 1) 이메일 + 중복 확인 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">이메일 주소</label>
                  <div className="flex gap-2">
                    <div className="relative flex items-center flex-1">
                      <Mail className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          setEmailCheckStatus('idle')
                          setEmailCheckMessage(null)
                        }}
                        placeholder="example@email.com"
                        required
                        className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckEmailDuplicate}
                      disabled={emailCheckStatus === 'checking' || !email.trim()}
                      className="shrink-0 px-3 py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-[#1884F7] hover:bg-sky-100 text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {emailCheckStatus === 'checking' ? '확인 중...' : '중복 확인'}
                    </button>
                  </div>

                  {/* 중복 확인 결과 텍스트 */}
                  {emailCheckMessage && (
                    <p
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        emailCheckStatus === 'available' ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {emailCheckStatus === 'available' ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <AlertCircle className="size-3" />
                      )}
                      <span>{emailCheckMessage}</span>
                    </p>
                  )}
                </div>

                {/* 2) 닉네임 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">닉네임</label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      maxLength={15}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="팝플에서 사용할 닉네임 (2~15자)"
                      required
                      className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 3) 비밀번호 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">비밀번호 (6자 이상)</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6자 이상 입력"
                      required
                      className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600"
                      aria-label="비밀번호 표시/숨김"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {/* 비밀번호 길이 실시간 안내 */}
                  {password.length > 0 && (
                    <p
                      className={`text-[10px] font-semibold ${
                        password.length >= 6 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {password.length >= 6
                        ? '✓ 사용 가능한 비밀번호입니다.'
                        : '✕ 비밀번호는 최소 6자 이상이어야 합니다.'}
                    </p>
                  )}
                </div>

                {/* 4) 비밀번호 확인 */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">비밀번호 확인</label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 size-4 text-slate-400 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 재입력"
                      required
                      className="w-full bg-slate-50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-xs border border-slate-200 focus:border-[#1884F7] focus:outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                  {/* 비밀번호 일치 여부 실시간 안내 */}
                  {passwordConfirm.length > 0 && (
                    <p
                      className={`text-[10px] font-semibold ${
                        password === passwordConfirm ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {password === passwordConfirm
                        ? '✓ 비밀번호가 일치합니다.'
                        : '✕ 비밀번호가 일치하지 않습니다.'}
                    </p>
                  )}
                </div>

                {/* [가입하고 인증 메일 받기] 버튼 */}
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !email.trim() ||
                    !nickname.trim() ||
                    password.length < 6 ||
                    password !== passwordConfirm
                  }
                  className="w-full mt-2 bg-[#1884F7] hover:bg-[#0F75E8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl text-xs shadow-md shadow-sky-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>가입하고 인증 메일 받기</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleTabChange('login')}
                    className="text-xs text-slate-500 hover:text-[#1884F7] font-semibold transition-colors"
                  >
                    이미 계정이 있으신가요? <span className="text-[#1884F7] underline">로그인하기</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
