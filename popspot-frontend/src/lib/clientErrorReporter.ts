import { API_BASE_URL } from '@/lib/api';

export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    message: error.message.slice(0, 500),
    path: window.location.pathname.slice(0, 255),
    digest: error.digest?.slice(0, 100),
    stack: error.stack?.slice(0, 8000),
  });

  void fetch(`${API_BASE_URL}/api/client-errors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'include',
  }).catch(() => {
    // 오류 보고 실패가 다시 오류 화면을 깨뜨리면 안 된다.
  });
}
