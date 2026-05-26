"use client";

import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { SearchZone } from "./SearchBox";

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * v2.18 — 헤더의 돋보기 버튼으로 호출되는 글로벌 검색 모달.
 *
 * <p>지도 페이지의 SearchBox 와 동일한 검색 컴포넌트를 그대로 재사용한다 (결합도 낮게). 모달 형태라
 * 어느 페이지에서든 같은 검색 경험 제공.
 *
 * <p>키보드 단축키: Ctrl+K (또는 Cmd+K) 로 열기 / ESC 로 닫기 (Radix Dialog 기본 동작).
 */
export function GlobalSearchModal({ open, onOpenChange }: GlobalSearchModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>팝업 검색</DialogTitle>
          <DialogDescription>
            지역 · 팝업 이름 · 카테고리 어느 키워드로든 검색할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <SearchZone />
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
      const isMacCmd = e.metaKey && e.key.toLowerCase() === "k";
      const isCtrl = e.ctrlKey && e.key.toLowerCase() === "k";
      if (isMacCmd || isCtrl) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
