/**
 * 의견 보내기 백엔드 호출 모음.
 *
 * <p>컴포넌트가 직접 {@code apiFetch} 를 부르지 않고 이 파일을 거치게 해서, URL/JSON 직렬화/에러 변환을
 * 한 곳에서 관리한다.
 */

import { apiFetch } from '@/lib/api';
import type {
  Feedback,
  FeedbackCreatePayload,
  FeedbackReplyPayload,
  FeedbackStatus,
  FeedbackStatusCounts,
} from '@/types/feedback';

const BASE = '/api/feedback';
const ADMIN_BASE = '/api/admin/feedback';

/** 응답이 ok 가 아니면 메시지 추출 후 throw. 컴포넌트에서 catch 한 번으로 처리. */
async function readJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const message = await readMessage(res);
    throw new Error(message);
  }
  return (await res.json()) as T;
}

async function readMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.message === 'string') return data.message;
  } catch {
    /* JSON 이 아니면 status text 로 폴백 */
  }
  return res.statusText || '요청을 처리하지 못했습니다.';
}

/** 새 의견 보내기. 로그인/게스트 모두 같은 엔드포인트. */
export async function createFeedback(payload: FeedbackCreatePayload): Promise<Feedback> {
  const res = await apiFetch(BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow<Feedback>(res);
}

/** 로그인 사용자 본인이 보낸 의견 목록. */
export async function fetchMyFeedback(): Promise<Feedback[]> {
  const res = await apiFetch(`${BASE}/me`);
  return readJsonOrThrow<Feedback[]>(res);
}

/* ============================== Admin ============================== */

export interface AdminListParams {
  status?: FeedbackStatus;
  page?: number;
  size?: number;
}

export async function fetchAdminFeedback(params: AdminListParams = {}): Promise<Feedback[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));
  const qs = query.toString();
  const res = await apiFetch(`${ADMIN_BASE}${qs ? `?${qs}` : ''}`);
  return readJsonOrThrow<Feedback[]>(res);
}

export async function fetchAdminFeedbackMetrics(): Promise<FeedbackStatusCounts> {
  const res = await apiFetch(`${ADMIN_BASE}/metrics`);
  return readJsonOrThrow<FeedbackStatusCounts>(res);
}

export async function replyFeedback(id: number, payload: FeedbackReplyPayload): Promise<Feedback> {
  const res = await apiFetch(`${ADMIN_BASE}/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return readJsonOrThrow<Feedback>(res);
}

export async function deleteFeedback(id: number): Promise<void> {
  const res = await apiFetch(`${ADMIN_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await readMessage(res));
  }
}
