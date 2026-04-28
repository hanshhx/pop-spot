import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | POP-SPOT",
  description: "POP-SPOT 서비스 이용약관 — 자동수집/정보 정확성/권리자 신고 절차",
};

/**
 * POP-SPOT 이용약관 페이지.
 *
 * 자동수집 기능을 운영하기 위한 법적 안전장치:
 *  §10 자동수집 출처 명시 + 정확성 면책
 *  §11 권리자 takedown 절차 (24시간 내 조치)
 *  §12 정보 보존 정책
 *
 * 이 페이지의 텍스트는 deploy/TERMS_OF_SERVICE_CLAUSE.md 와 동일하게
 * 유지되어야 합니다 (운영 정책 일치).
 */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-lime-500 transition-colors"
          >
            ← 홈으로
          </Link>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight mt-4 text-foreground">
            POP-SPOT 이용약관
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            최종 개정일: 2026-04-28
          </p>
        </header>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-10 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제10조 (팝업스토어 정보의 출처 및 자동수집)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본 서비스의 팝업스토어 정보 일부는 운영자의 직접 등록 외에 다음
                공개된 외부 소스를 기반으로 자동 또는 수동으로 수집·정리될 수
                있습니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>
                    네이버 검색 API (블로그·뉴스,{" "}
                    <a
                      href="https://developers.naver.com/products/service-api/search/search.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lime-500 hover:underline"
                    >
                      공식 약관
                    </a>
                    )
                  </li>
                  <li>
                    카카오 검색 API (웹·블로그,{" "}
                    <a
                      href="https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lime-500 hover:underline"
                    >
                      공식 약관
                    </a>
                    )
                  </li>
                  <li>회원의 자발적 제보</li>
                </ul>
              </li>
              <li>
                자동수집 정보에는 항상 원본 출처 링크가 함께 표시되며, 회사는
                본문을 임의로 대량 복제·재배포하지 않습니다.
              </li>
              <li>
                회사는 수집된 정보의 정확성·최신성·완전성을 보장하지 않으며, AI
                신뢰도 점수가 기준치 이상인 경우에 한해 자동 게시되고 그 외에는
                운영자의 검수 후 게시됩니다.
              </li>
              <li>
                이용자는 잘못된 정보를 발견한 경우 각 팝업 상세페이지의 신고
                버튼을 통해 회사에 알릴 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제11조 (권리자 정보 삭제 요청 / Takedown)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본인이 운영하는 팝업스토어 또는 본인이 저작권을 보유한 콘텐츠가
                본 서비스에 부정확하게 표시되었거나 본인의 동의 없이 게시되었다고
                판단하는 경우, 권리자는 각 팝업스토어 상세페이지의{" "}
                <strong className="text-red-500">「정보 삭제·수정 요청」</strong>{" "}
                버튼을 통해 삭제 또는 수정을 요청할 수 있습니다.
              </li>
              <li>
                신고 접수 시 회사는 즉시 해당 정보의 노출을 차단한 후 24시간
                이내에 검토하여 다음 중 하나의 조치를 취합니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>정보 영구 삭제</li>
                  <li>정보 수정 후 재공개</li>
                  <li>
                    정당한 권리자가 아니거나 신고 사유가 부적절한 경우 노출 복구
                  </li>
                </ul>
              </li>
              <li>
                신고 시 다음 정보가 필요합니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>신고자 이메일</li>
                  <li>
                    신고 사유 (저작권 침해 / 정보 오류 / 본인 동의 없는 게시 등)
                  </li>
                </ul>
              </li>
              <li>
                허위 신고로 정상 콘텐츠의 노출을 방해한 경우, 신고자에게 손해배상
                책임이 있을 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제12조 (정보의 보존)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본 서비스는 종료된 팝업스토어 정보를 이력 보존 목적으로
                캘린더·랭킹·신상 목록에서는 자동으로 숨기되, 데이터베이스
                상으로는 일정 기간 보관할 수 있습니다.
              </li>
              <li>
                권리자가 영구 삭제를 요청한 경우 제11조 절차에 따라 즉시
                삭제됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제13조 (개인정보의 수집·이용)
            </h2>
            <p className="text-foreground/90 mb-4">
              회사는 개인정보보호법 제15조 및 정보통신망법 제22조에 따라 다음과
              같이 회원의 개인정보를 수집·이용합니다. 회원가입 시 본 조항에
              동의함으로써 효력이 발생합니다.
            </p>

            <div className="overflow-x-auto rounded-md border border-[var(--color-border)] mb-4">
              <table className="w-full text-sm">
                <thead className="bg-surface/50">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-3 py-2 text-left font-bold text-foreground w-32">
                      구분
                    </th>
                    <th className="px-3 py-2 text-left font-bold text-foreground">
                      내용
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ① 수집 항목
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      이메일(아이디), 비밀번호(암호화 저장), 이름(닉네임),
                      생년월일, 성별, 휴대전화번호
                      <br />
                      <span className="text-xs text-muted-foreground">
                        SNS 간편가입의 경우: 해당 플랫폼이 제공하는 식별자, 이메일,
                        프로필 이름·이미지
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ② 수집·이용 목적
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원 식별 및 본인 확인, 부정 이용 방지, 서비스 제공
                      (스탬프·찜·메이트 매칭 등), 고객 문의 응대, 약관 변경 등
                      필수 고지사항 전달
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ③ 보유·이용 기간
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원 탈퇴 시까지. 단, 관계법령(전자상거래법, 통신비밀보호법
                      등)에 따라 보존이 필요한 경우 해당 기간 동안 보관 후 파기.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ④ 동의 거부 권리
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원은 본 동의를 거부할 권리가 있습니다. 다만, 위 수집
                      항목은 서비스 이용에 필수적이므로 동의를 거부하시면 회원
                      가입 및 서비스 이용이 제한됩니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 위 기간이 경과하거나 수집·이용 목적이 달성된 개인정보를
                지체 없이 파기합니다.
              </li>
              <li>
                회원은 언제든지 마이페이지를 통해 본인 정보를 열람·수정할 수
                있으며, 회원 탈퇴를 통해 모든 개인정보의 삭제를 요청할 수
                있습니다.
              </li>
              <li>
                회사는 회원의 개인정보를 본인의 동의 없이 제3자에게 제공하거나
                목적 외 용도로 이용하지 않습니다. 단, 법령에 의해 요구되는 경우는
                예외로 합니다.
              </li>
              <li>
                회사는 회원의 비밀번호를 단방향 해시(BCrypt strength 12)로
                저장하며 평문 형태로 보관하지 않습니다.
              </li>
            </ol>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-surface/50 p-5">
            <h2 className="text-lg font-bold mb-2 text-foreground">
              문의 및 신고
            </h2>
            <p className="text-sm text-muted-foreground">
              위 조항과 관련된 문의 또는 신고는 다음 메일로 보내주시기 바랍니다.
            </p>
            <p className="mt-2 text-sm">
              Contact:{" "}
              <a
                href="mailto:reo4321@naver.com?subject=POP-SPOT 정보 삭제·수정 요청"
                className="text-lime-500 hover:underline font-bold"
              >
                reo4321@naver.com
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
