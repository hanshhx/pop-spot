'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { saveHomeReturnState } from '@/lib/homeReturnScroll';
import type { PopupStore } from '@/types/popup';

import { SearchZone } from './SearchBox';

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 이름 즉시검색용 팝업 목록. 없으면 SearchZone 이 이름 드롭다운을 띄우지 못하고
   * 자연어 AI 검색만 남는다 — 이 모달이 "무엇을 쳐도 0건" 이던 원인이었다.
   */
  popups?: PopupStore[];
}

/**
 * v2.18 — 헤더의 돋보기 버튼으로 호출되는 글로벌 검색 모달.
 *
 * <p>지도 페이지의 SearchBox 와 동일한 검색 컴포넌트를 그대로 재사용한다 (결합도 낮게). 모달 형태라
 * 어느 페이지에서든 같은 검색 경험 제공.
 *
 * <p>키보드 단축키: Ctrl+K (또는 Cmd+K) 로 열기 / ESC 로 닫기 (Radix Dialog 기본 동작).
 */
export function GlobalSearchModal({ open, onOpenChange, popups }: GlobalSearchModalProps) {
  const { t, locale } = useLocale();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('pmodal.search.title')}</DialogTitle>
          <DialogDescription>{t('pmodal.search.desc')}</DialogDescription>
        </DialogHeader>
        {/*
          지도가 없는 모달이므로 고른 팝업은 상세 페이지로 보낸다(지도 모드에선 해당 핀으로 이동).
          popups 를 넘겨야 SearchZone 의 canSuggest 가 켜져 이름 부분일치 드롭다운이 뜬다.
        */}
        <SearchZone
          popups={popups}
          onSelectPopup={(hit) => {
            // 홈 → 상세 경로라 다른 홈 카드들과 같은 스크롤 복원 규칙을 따른다.
            saveHomeReturnState();
            onOpenChange(false);
            router.push(localizedPath(`/popup/${hit.objectID}`, locale));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ctrl+K / Cmd+K 단축키 hook — 부모 컴포넌트가 setOpen 을 받아 모달 열기.
 *
 * <p>이미 모달이 열려 있을 때 다시 누르면 닫힘.
 */
export function useGlobalSearchHotkey(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMacCmd = e.metaKey && e.key.toLowerCase() === 'k';
      const isCtrl = e.ctrlKey && e.key.toLowerCase() === 'k';
      if (isMacCmd || isCtrl) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}
