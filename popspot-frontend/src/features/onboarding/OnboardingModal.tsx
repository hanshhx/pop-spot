'use client';

import { useEffect, useState } from 'react';
import { Map as MapIcon, Route, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale, type MessageKey } from '@/lib/i18n';

/** 저장 키 — 화면에 보이지 않는 값이라 언어와 무관하게 고정한다. */
const STORAGE_KEY = 'popspot:onboarding-seen';

interface OnboardingStep {
  icon: React.ReactNode;
  /**
   * 문구가 아니라 <b>사전 키</b>를 담는다.
   *
   * <p>이 배열은 컴포넌트 밖에 있어 훅을 부를 수 없다 — 여기서 번역해 두면 첫 로드 언어로 굳어
   * 언어를 바꿔도 그대로 남는다. 실제 문구는 그리는 쪽에서 t() 로 꺼낸다.
   */
  titleKey: MessageKey;
  descKey: MessageKey;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <MapIcon className="size-10 text-lime-500" aria-hidden />,
    titleKey: 'onboard.step1Title',
    descKey: 'onboard.step1Desc',
  },
  {
    icon: <Route className="size-10 text-lime-500" aria-hidden />,
    titleKey: 'onboard.step2Title',
    descKey: 'onboard.step2Desc',
  },
  {
    icon: <MessageCircle className="size-10 text-lime-500" aria-hidden />,
    titleKey: 'onboard.step3Title',
    descKey: 'onboard.step3Desc',
  },
];

/**
 * v2.18 — 신규 사용자 온보딩. 첫 진입 시 1회만 노출, 이후 localStorage 로 차단.
 *
 * <p>로그인 / 게스트 무관 — 모든 첫 진입자에게 한 번. "다음" 버튼으로 3단계 순회, "건너뛰기" 로
 * 즉시 닫기. 닫히면 다시는 안 뜸.
 */
export function OnboardingModal() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setShowPrompt(true);
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setShowPrompt(false);
    setOpen(false);
  };

  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  return (
    <>
      {showPrompt && !open ? (
        <aside className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl border border-black/10 bg-white p-4 text-[#0a0a0a] shadow-2xl dark:border-white/15 dark:bg-[#151515] dark:text-white">
          <p className="text-sm font-black">{t('onboard.promptTitle')}</p>
          <p className="mt-1 text-xs leading-5 text-current/65">{t('onboard.promptDesc')}</p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setShowPrompt(false);
                setOpen(true);
              }}
            >
              {t('onboard.promptCta')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
              {t('common.close')}
            </Button>
          </div>
        </aside>
      ) : null}
      <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(true))}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="sr-only">{t('onboard.dialogTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('onboard.dialogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="rounded-full bg-lime-300/15 p-5">{step.icon}</div>
            <h3 className="text-lg font-bold text-foreground">{t(step.titleKey)}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t(step.descKey)}
            </p>

            {/* dots */}
            <div className="flex items-center gap-1.5 mt-2">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={
                    'size-2 rounded-full transition-colors ' +
                    (i === stepIndex ? 'bg-lime-500' : 'bg-muted-foreground/30')
                  }
                />
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
              {t('onboard.skip')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (isLastStep) dismiss();
                else setStepIndex((i) => i + 1);
              }}
            >
              {isLastStep ? t('onboard.start') : t('onboard.next')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
