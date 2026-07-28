'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, Check, Loader2, User as UserIcon } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useLocale, type MessageKey } from '@/lib/i18n';
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

/**
 * 닉네임을 쓸 수 없는 이유 — <b>완성된 문장이 아니라 사유만</b> 담는다.
 *
 * <p>번역된 문구를 상태에 넣으면 언어를 바꿔도 이미 만들어진 문장이 그대로 남는다. 사유만 들고
 * 있다가 그리는 쪽에서 그때의 언어로 문장을 만든다. 서버가 준 사유(금지어 등)는 사전에 없는
 * 문장이라 원문 그대로 넘긴다.
 */
type NicknameReason = { kind: 'length' } | { kind: 'taken' } | { kind: 'server'; message: string };

type NicknameStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; selfSame?: boolean }
  | { state: 'taken'; reason: NicknameReason };

/**
 * 프로필 편집 모달 — 사진 + 닉네임 변경.
 *
 * <p>닉네임 실시간 중복 검사 (350ms debounce). 사진은 5MB 이하 jpg/png/webp.
 * 저장 시 PATCH /api/v1/users/me + POST /api/v1/users/me/avatar 두 단계.
 */
export function ProfileEditModal({ open, onOpenChange, user, onSaved }: ProfileEditModalProps) {
  const { t } = useLocale();
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
      setNicknameStatus({ state: 'taken', reason: { kind: 'length' } });
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
            reason: data.reason ? { kind: 'server', message: data.reason } : { kind: 'taken' },
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
      notifyError(`${t('profile.sizeErrorPrefix')}${MAX_AVATAR_MB}${t('profile.sizeErrorSuffix')}`);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      notifyError(t('profile.typeError'));
      return;
    }
    setPendingFile(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (saving) return;
    if (nicknameStatus.state === 'checking') {
      notifyError(t('profile.waitCheck'));
      return;
    }
    if (nicknameStatus.state === 'taken') {
      notifyError(nicknameReasonText(nicknameStatus.reason, t));
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
          throw new Error(message || t('profile.uploadFailed'));
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
        throw new Error(message || t('profile.saveFailed'));
      }
      const patchData = (await patchRes.json()) as {
        nickname: string;
        picture: string | null;
      };

      notifySuccess(t('profile.saved'));
      onSaved?.({
        nickname: patchData.nickname,
        picture: patchData.picture ?? null,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.saveFailed');
      notifyError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('profile.title')}</DialogTitle>
          <DialogDescription>{t('profile.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 사진 영역 */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handlePickFile}
              className="relative group w-20 h-20 rounded-full overflow-hidden border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 flex items-center justify-center"
              aria-label={t('profile.photoChange')}
            >
              {picturePreview ? (
                <Image
                  src={picturePreview}
                  alt={t('profile.photoAlt')}
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
              <p className="text-sm font-semibold text-foreground">{t('profile.photoLabel')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('profile.photoMaxPrefix')}
                {MAX_AVATAR_MB}MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handlePickFile}
              >
                {t('profile.photoPick')}
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
          <Field
            label={t('profile.nickname')}
            required
            helper={renderNicknameHelper(nicknameStatus, t)}
          >
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX}
              placeholder={`${nicknameRange(t)}${t('profile.nicknameUnit')}`}
              invalid={nicknameStatus.state === 'taken'}
            />
          </Field>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button type="button" variant="outline" size="md" onClick={() => onOpenChange(false)}>
            {t('profile.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={saving}
            onClick={handleSave}
            disabled={nicknameStatus.state === 'taken' || nicknameStatus.state === 'checking'}
          >
            {t('profile.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Translate = (key: MessageKey) => string;

/**
 * 글자 수 범위 — 사전에는 치환자가 없어 숫자를 사이에 끼워 조립한다.
 *
 * <p>"2~20" 을 사전에 그대로 적어 두면 {@link NICKNAME_MIN}·{@link NICKNAME_MAX} 를 고쳤을 때
 * 세 언어가 조용히 어긋난다. 구분 기호만 언어별로 두고(한국어 ~ · 영어 – · 일본어 〜) 숫자는 코드에 남긴다.
 */
function nicknameRange(t: Translate): string {
  return `${NICKNAME_MIN}${t('profile.rangeJoin')}${NICKNAME_MAX}`;
}

function nicknameReasonText(reason: NicknameReason, t: Translate): string {
  if (reason.kind === 'length') {
    return `${t('profile.nicknameLenPrefix')}${nicknameRange(t)}${t('profile.nicknameLenSuffix')}`;
  }
  if (reason.kind === 'server') return reason.message;
  return t('profile.nicknameTaken');
}

// 컴포넌트가 아니라 렌더 도우미라 훅을 쓸 수 없다 — t 를 넘겨받는다.
function renderNicknameHelper(status: NicknameStatus, t: Translate) {
  if (status.state === 'checking') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> {t('profile.nicknameChecking')}
      </span>
    );
  }
  if (status.state === 'taken') {
    return <span className="text-danger">{nicknameReasonText(status.reason, t)}</span>;
  }
  if (status.state === 'ok' && status.selfSame) {
    return <span className="text-muted-foreground">{t('profile.nicknameCurrent')}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-lime-500">
      <Check className="size-3" /> {t('profile.nicknameAvailable')}
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
