import type { Metadata } from "next";

/**
 * 팝업 상세 — 검색엔진 색인 차단.
 *
 * <p><b>왜 막는가.</b> 이 URL 에는 팝업 정보만 있는 게 아니라 회원이 남긴 글이 같이 산다
 * (page.tsx 의 "다녀온 사람들의 한 줄" → ChatRoom). 이용약관 §14 는 회원 콘텐츠(동행·의견·채팅)를
 * 검색엔진에 색인하지 않겠다고 공표했다. 약속을 지키는 방법은 둘뿐인데 — 채팅을 이 URL 에서 떼거나,
 * 이 URL 을 색인하지 않거나 — 후자가 지금 당장 가능한 쪽이다.
 *
 * <p><b>왜 데이터를 보고 판단하지 않는가.</b> "크롤 원문 기반 팝업만 막고 나머지는 색인" 같은 조건부
 * 정책을 검토했지만, 채팅이 같은 URL 에 있는 한 어떤 데이터 조건에서도 index 를 켤 수 없다. 도달하지
 * 못하는 분기를 위해 상세 요청마다 백엔드를 한 번 더 부르고 그 호출이 실패하면 상세가 500 이 되는
 * 위험까지 떠안게 된다. 결론이 하나면 조건도 하나여야 한다.
 *
 * <p><b>되돌리려면.</b> ChatRoom 을 별도 URL 로 옮기거나 로그인 사용자에게만 마운트하는 것이 선행이다.
 * 그 전에 여기만 풀면 약관 위반이 된다. 팝업 상세는 이 서비스에서 유기적 유입이 가장 클 수 있는 면이라
 * 채팅 분리는 별도 과제로 남겨둘 값어치가 있다.
 *
 * <p><b>robots.txt 로 막지 않는 이유.</b> Disallow 를 걸면 크롤러가 이 meta 를 읽지 못해 URL 만 색인된
 * 채로 남는다. 색인을 지우려면 크롤러가 페이지에 들어와 noindex 를 읽어야 한다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    robots: { index: false, follow: false },
    // 루트 layout 이 모든 페이지에 홈 canonical 을 물려준다. noindex 여도 자기 URL 을 가리키는 편이
    // 정확하고, 홈을 가리키는 canonical 이 남으면 홈 평가에까지 잡음이 섞인다.
    alternates: /^\d+$/.test(id)
      ? { canonical: `https://popspot.co.kr/popup/${id}` }
      : undefined,
  };
}

export default function PopupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
