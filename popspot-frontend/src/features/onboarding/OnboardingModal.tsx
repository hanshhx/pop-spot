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

const STORAGE_KEY = 'popspot:onboarding-seen';

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <MapIcon className="size-10 text-lime-500" aria-hidden />,
    title: '서울 팝업을 한 화면에서',
    description: '지도 탭에서 오늘 열린 팝업을 카테고리별로 찾아볼 수 있습니다.',
  },
  {
    icon: <Route className="size-10 text-lime-500" aria-hidden />,
    title: '나만의 코스를 만들어 보세요',
    description: '마음에 드는 팝업을 코스에 담아 동선을 미리 계획할 수 있습니다.',
  },
  {
    icon: <MessageCircle className="size-10 text-lime-500" aria-hidden />,
    title: '의견을 자유롭게 보내 주세요',
    description: '버그 / 제안 / 좋은 점 모두 의견 탭으로 받습니다. 게스트도 보낼 수 있어요.',
  },
];

/**
 * v2.18 — 신규 사용자 온보딩. 첫 진입 시 1회만 노출, 이후 localStorage 로 차단.
 *
 * <p>로그인 / 게스트 무관 — 모든 첫 진입자에게 한 번. "다음" 버튼으로 3단계 순회, "건너뛰기" 로
 * 즉시 닫기. 닫히면 다시는 안 뜸.
 */
export function OnboardingModal() {
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
          <p className="text-sm font-black">POP-SPOT이 처음이라면</p>
          <p className="mt-1 text-xs leading-5 text-current/65">
            지도·코스·의견 기능을 30초 안에 확인할 수 있음.
          </p>
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
              둘러보기
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
              닫기
            </Button>
          </div>
        </aside>
      ) : null}
      <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(true))}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="sr-only">POP-SPOT 둘러보기</DialogTitle>
            <DialogDescription className="sr-only">POP-SPOT 의 주요 기능 안내</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="rounded-full bg-lime-300/15 p-5">{step.icon}</div>
            <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {step.description}
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
              건너뛰기
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
              {isLastStep ? '시작하기' : '다음'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
