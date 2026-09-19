import type { Metadata } from 'next';

/**
 * v2.15 — 의견 보내기 페이지는 검색엔진 색인 차단.
 *
 * <p>사용자가 보낸 의견 본문 / 답변 / 게스트 이메일 등 PII 성격의 데이터가 동일 페이지에서
 * 함께 렌더링되므로 검색에 노출되어선 안 된다. 페이지 본문이 클라이언트 렌더링이라 어차피
 * 봇은 본문을 가져가지 못하지만 명시적으로 noindex 처리.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
