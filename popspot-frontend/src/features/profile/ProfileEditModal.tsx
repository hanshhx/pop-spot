'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Check, Loader2, User as UserIcon } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { notifyError, notifySuccess } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { User } from '@/types/popup';

interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  /** 저장 성공 후 호출 — 부모가 user state + localStorage 동기화. */
  onSaved?: (next: { nickname: string; picture: string | null }) => void;
}

const DEBOUNCE_MS = 350;
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const MAX_AVATAR_MB = 5;

type NicknameStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; selfSame?: boolean }
  | { state: 'taken'; reason: string };

/**
 * 프로필 편집 모달 — 사진 + 닉네임 변경.
 *
 * <p>닉네임 실시간 중복 검사 (350ms debounce). 사진은 5MB 이하 jpg/png/webp.
 * 저장 시 PATCH /api/v1/users/me + POST /api/v1/users/me/avatar 두 단계.
 */
export function ProfileEditModal({ open, onOpenChange, user, onSaved }: ProfileEditModalProps) {
  const [nickname, setNickname] = useState(user.nickname);
  const [picturePreview, setPicturePreview] = useState<string | null>(user.picture ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>({
    state: 'ok',
    selfSame: true,
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달 열릴 때 초기값 동기화.
  useEffect(() => {
    if (open) {
      setNickname(user.nickname);
      setPicturePreview(user.picture ?? null);
      setPendingFile(null);
      setNicknameStatus({ state: 'ok', selfSame: true });
    }
  }, [open, user.nickname, user.picture]);

  // 닉네임 debounce 중복 검사.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = nickname.trim();
    if (trimmed === user.nickname) {
      setNicknameStatus({ state: 'ok', selfSame: true });
      return;
    }
    if (trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX) {
      setNicknameStatus({
        state: 'taken',
        reason: `${NICKNAME_MIN}~${NICKNAME_MAX}자 사이여야 합니다.`,
      });
      return;
    }

    setNicknameStatus({ state: 'checking' });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/v1/users/check-nickname?value=${encodeURIComponent(trimmed)}`,
        );
        if (!res.ok) {
          setNicknameStatus({ state: 'ok' });
          return;
        }
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
        };
        if (data.available) {
          setNicknameStatus({ state: 'ok' });
        } else {
          setNicknameStatus({
            state: 'taken',
            reason: data.reason ?? '이미 사용 중입니다.',
          });
        }
      } catch {
        // 네트워크 실패 시 통과 — 서버가 최종 검증.
        setNicknameStatus({ state: 'ok' });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nickname, open, user.nickname]);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      notifyError(`파일 크기는 ${MAX_AVATAR_MB}MB 이하만 가능합니다.`);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      notifyError('jpg / png / webp 형식만 업로드할 수 있습니다.');
      return;
    }
    setPendingFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (saving) return;
    if (nicknameStatus.state === 'checking') {
      notifyError('닉네임 확인이 끝날 때까지 잠시 기다려 주세요.');
      return;
    }
    if (nicknameStatus.state === 'taken') {
      notifyError(nicknameStatus.reason);
      return;
    }
    setSaving(true);

    try {
      let nextPicture: string | null = user.picture ?? null;

      // 1. 사진 새로 선택된 경우 먼저 업로드.
      if (pendingFile) {
        const formData = new FormData();
        formData.append('file', pendingFile);
        const upRes = await apiFetch('/api/v1/users/me/avatar', {
          method: 'POST',
          body: formData,
        });
        if (!upRes.ok) {
          const message = await readMessage(upRes);
          throw new Error(message || '사진 업로드에 실패했습니다.');
        }
        const upData = (await upRes.json()) as { url: string };
        nextPicture = upData.url;
      }

      // 2. 닉네임 / picture 메타 갱신.
      const patchRes = await apiFetch('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          nickname: nickname.trim(),
          picture: nextPicture,
        }),
      });
      if (!patchRes.ok) {
        const message = await readMessage(patchRes);
        throw new Error(message || '프로필 저장에 실패했습니다.');
      }
      const patchData = (await patchRes.json()) as {
        nickname: string;
        picture: string | null;
      };

      notifySuccess('프로필이 업데이트되었습니다.');
      onSaved?.({
        nickname: patchData.nickname,
        picture: patchData.picture ?? null,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '프로필 저장에 실패했습니다.';
      notifyError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>프로필 수정</DialogTitle>
          <DialogDescription>프로필 사진과 닉네임을 변경할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 사진 영역 */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handlePickFile}
              className="relative group w-20 h-20 rounded-full overflow-hidden border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 flex items-center justify-center"
              aria-label="프로필 사진 변경"
            >
              {picturePreview ? (
                <Image
                  src={picturePreview}
                  alt="프로필"
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <UserIcon className="size-8 text-muted-foreground" />
              )}
              <div className="absolute inset-0 bg-ink-900/0 group-hover:bg-ink-900/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Camera className="size-6 text-white" />
              </div>
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">프로필 사진</p>
              <p className="text-xs text-muted-foreground mt-1">최대 {MAX_AVATAR_MB}MB</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handlePickFile}
              >
                사진 선택
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 닉네임 영역 */}
          <Field label="닉네임" required helper={renderNicknameHelper(nicknameStatus)}>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX}
              placeholder="2~20자"
              invalid={nicknameStatus.state === 'taken'}
            />
          </Field>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={saving}
            onClick={handleSave}
            disabled={nicknameStatus.state === 'taken' || nicknameStatus.state === 'checking'}
          >
            저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderNicknameHelper(status: NicknameStatus) {
  if (status.state === 'checking') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> 사용 가능 여부 확인 중
      </span>
    );
  }
  if (status.state === 'taken') {
    return <span className="text-danger">{status.reason}</span>;
  }
  if (status.state === 'ok' && status.selfSame) {
    return <span className="text-muted-foreground">현재 닉네임입니다.</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-lime-500">
      <Check className="size-3" /> 사용 가능한 닉네임
    </span>
  );
}

async function readMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.message === 'string') return data.message;
    if (typeof data === 'string') return data;
  } catch {
    /* fallback */
  }
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}
