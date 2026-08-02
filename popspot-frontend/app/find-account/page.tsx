'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, Mail, KeyRound, ChevronRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../../src/lib/api';
import { notify, notifyError } from '@/lib/notify';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

export default function FindAccountPage() {
  const router = useRouter();
  const { t, locale } = useLocale();

  // 탭: 'id'(아이디찾기) / 'pw'(비번찾기)
  const [activeTab, setActiveTab] = useState<'id' | 'pw'>('id');

  // 상태 관리
  const [pwStep, setPwStep] = useState(1);

  // 입력값
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // 결과값
  const [foundEmail, setFoundEmail] = useState('');
  const [providerInfo, setProviderInfo] = useState(''); // 소셜 정보 저장
  const [loading, setLoading] = useState(false);

  // 탭 변경 시 초기화
  const handleTabChange = (tab: 'id' | 'pw') => {
    setActiveTab(tab);
    setPwStep(1);
    setName('');
    setPhone('');
    setEmail('');
    setAuthCode('');
    setNewPassword('');
    setFoundEmail('');
    setProviderInfo('');
  };

  const handleFindId = async () => {
    if (!name || !phone) return notify(t('account.needNamePhone'));

    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/auth/find-email?nickname=${name}&phoneNumber=${phone}`);

      if (res.ok) {
        const data = await res.json();
        setFoundEmail(data.email ?? '');
        if (data.provider && data.provider !== 'LOCAL') {
          setProviderInfo(data.provider);
        } else {
          setProviderInfo('');
        }
      } else {
        notify(t('account.notFound'));
      }
    } catch (e) {
      console.error(e);
      notifyError(t('signup.serverError'));
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 1] 소셜 회원 차단 로직
  const handleSendEmailCode = async () => {
    if (!email || !name) return notify(t('account.needEmailName'));

    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/auth/email/send-for-pw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname: name }),
      });

      if (res.ok) {
        notify(t('account.codeSent'));
        setPwStep(2);
      } else {
        const msg = await res.text();

        if (msg.includes('SOCIAL_USER')) {
          // 예: "SOCIAL_USER:google" -> "GOOGLE" 추출
          const provider = msg.split(':')[1].toUpperCase();
          notify(`${provider}: ${t('account.socialNotice')}`);
        } else {
          notify(t('account.infoMismatch'));
        }
      }
    } catch (e) {
      notifyError(t('login.serverTitle'));
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 2] 인증번호 검증
  const handleVerifyCode = async () => {
    if (!authCode) return notify(t('account.needCode'));

    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: authCode, purpose: 'PASSWORD_RESET' }),
      });

      if (res.ok) {
        setPwStep(3);
      } else {
        notify(t('account.invalidCode'));
      }
    } catch (e) {
      notifyError(t('signup.verifyError'));
    } finally {
      setLoading(false);
    }
  };

  // 🔵 [비번 찾기 3] 비밀번호 변경
  const handleChangePassword = async () => {
    if (!newPassword) return notify(t('account.needNewPassword'));

    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      if (res.ok) {
        notify(t('account.passwordChanged'));
        router.push(localizedPath('/login', locale));
      } else {
        notifyError(t('account.changeFailed'));
      }
    } catch (e) {
      notifyError(t('signup.serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* 🚀 배경 글로우 효과 반응형 (모바일 사이즈 줄임) */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-lime-300/20 rounded-full blur-[80px] md:blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-lime-300/20 rounded-full blur-[80px] md:blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        // 🚀 메인 박스 반응형 조절 (모바일 여백 축소)
        className="w-full max-w-md bg-[#111] border border-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl relative z-10 mx-2 md:mx-0"
      >
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <ArrowLeft size={20} className="md:w-6 md:h-6" />
          </button>
          <h1 className="text-xl md:text-2xl font-black tracking-tight">{t('account.title')}</h1>
          <div className="w-6" />
        </div>

        {/* 탭 버튼 반응형 (크기 및 폰트 축소) */}
        <div className="flex bg-white/5 rounded-lg md:rounded-xl p-1 mb-6 md:mb-8">
          <button
            onClick={() => handleTabChange('id')}
            className={`flex-1 py-2.5 md:py-3 rounded-md md:rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 ${activeTab === 'id' ? 'bg-lime-300 text-ink-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
          >
            <User size={14} className="md:w-4 md:h-4" /> {t('account.findId')}
          </button>
          <button
            onClick={() => handleTabChange('pw')}
            className={`flex-1 py-2.5 md:py-3 rounded-md md:rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-1.5 md:gap-2 ${activeTab === 'pw' ? 'bg-lime-300 text-ink-900 shadow-lg' : 'text-white/50 hover:text-white'}`}
          >
            <KeyRound size={14} className="md:w-4 md:h-4" /> {t('account.findPassword')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'id' && !foundEmail && (
            <motion.div
              key="find-id-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3 md:space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs text-white/50 pl-1 font-bold">
                  {t('account.name')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('account.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white outline-none focus:border-lime-300 transition-colors"
                  />
                  <User className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs text-white/50 pl-1 font-bold">
                  {t('account.phone')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white outline-none focus:border-lime-300 transition-colors"
                  />
                  <Phone className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
              <button
                onClick={handleFindId}
                disabled={loading}
                className="w-full bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl transition-all disabled:opacity-50 mt-2 md:mt-4 text-sm md:text-base"
              >
                {loading ? t('account.searching') : t('account.findMyId')}
              </button>
            </motion.div>
          )}

          {activeTab === 'id' && foundEmail && (
            <motion.div
              key="find-id-result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 md:py-6 space-y-4 md:space-y-6"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-500/20">
                <Mail className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              <div>
                <p className="text-white/50 text-xs md:text-sm mb-1 md:mb-2">
                  {t('account.idLead')}
                </p>
                <h2 className="text-xl md:text-2xl font-black text-white break-all px-2">
                  {foundEmail}
                </h2>

                {/* 소셜 회원이면 뱃지 표시 */}
                {providerInfo && (
                  <div className="mt-2 md:mt-3 inline-flex items-center gap-1.5 md:gap-2 px-2.5 py-1 md:px-3 md:py-1 bg-white/10 rounded-full border border-white/20">
                    <span className="text-[10px] md:text-xs text-lime-300 font-bold uppercase">
                      {providerInfo}
                    </span>
                    <span className="text-[10px] md:text-xs text-white/60">
                      {t('account.socialAccount')}
                    </span>
                  </div>
                )}
                <p className="text-white/50 text-xs md:text-sm mt-3 md:mt-4">
                  {t('account.idTail')}
                </p>
              </div>
              <button
                onClick={() => router.push(localizedPath('/login', locale))}
                className="w-full bg-white text-black font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl hover:bg-white/90 transition-colors text-sm md:text-base"
              >
                {t('signup.goLogin')}
              </button>
            </motion.div>
          )}

          {/* 🔵 비밀번호 찾기 (이하 동일하게 반응형 적용) */}
          {activeTab === 'pw' && pwStep === 1 && (
            <motion.div
              key="pw-step1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3 md:space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs text-white/50 pl-1 font-bold">
                  {t('account.email')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white outline-none focus:border-lime-300"
                  />
                  <Mail className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs text-white/50 pl-1 font-bold">
                  {t('account.name')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('account.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white outline-none focus:border-lime-300"
                  />
                  <User className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
              <button
                onClick={handleSendEmailCode}
                disabled={loading}
                className="w-full bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl mt-2 md:mt-4 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {loading ? t('account.checking') : t('account.sendCode')}{' '}
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </motion.div>
          )}

          {activeTab === 'pw' && pwStep === 2 && (
            <motion.div
              key="pw-step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3 md:space-y-4"
            >
              <div className="text-center mb-2 md:mb-4">
                <p className="text-white/70 text-xs md:text-sm">{t('account.codeInstruction')}</p>
                <p className="text-lime-300 font-bold mt-1 text-sm md:text-base break-all px-2">
                  {email}
                </p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="123456"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 text-center text-white outline-none focus:border-lime-300 tracking-[0.3em] md:tracking-[0.5em] font-bold text-base md:text-lg"
                />
              </div>
              <button
                onClick={handleVerifyCode}
                disabled={loading}
                className="w-full bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl mt-2 text-sm md:text-base"
              >
                {loading ? t('account.checking') : t('account.verifyCode')}
              </button>
            </motion.div>
          )}

          {activeTab === 'pw' && pwStep === 3 && (
            <motion.div
              key="pw-step3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3 md:space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] md:text-xs text-white/50 pl-1 font-bold">
                  {t('account.newPassword')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={t('account.newPasswordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#222] border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 pl-10 md:pl-12 text-sm md:text-base text-white outline-none focus:border-lime-300"
                  />
                  <Lock className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 md:w-5 md:h-5" />
                </div>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="w-full bg-lime-300 hover:bg-lime-400 text-ink-900 font-bold py-3.5 md:py-4 rounded-lg md:rounded-xl mt-2 md:mt-4 text-sm md:text-base"
              >
                {loading ? t('account.changing') : t('account.changeDone')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
