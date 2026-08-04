import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 | POP-SPOT',
  description:
    'POP-SPOT 서비스 이용약관 — 계정, 회원 콘텐츠, 외부 서비스, 자동수집, 정보 정확성, 권리자 신고 및 검색 노출 정책',
};

/**
 * POP-SPOT 이용약관 페이지.
 *
 * 계정과 서비스 이용에 관한 기본 조항 및 자동수집 기능을 운영하기 위한 기준:
 *  §1~9 서비스·계정·회원 콘텐츠·외부 서비스·유료 기능·책임·분쟁
 *  §10   자동수집 출처 명시 + 정확성 면책
 *  §10-2 외부 검색 API 사용 형태 / 저작권 / 약관 준수 (v2.13.2 신규)
 *  §11   권리자 takedown 절차 (24시간 내 조치)
 *  §12   정보 보존 정책
 *  §13   개인정보의 수집·이용
 *  §14   검색엔진 노출 정책 (v2.15 신규)
 *
 * §10~12의 자동수집·신고·보존 문구는 deploy/TERMS_OF_SERVICE_CLAUSE.md 와
 * 같은 기준으로 유지합니다 (운영 정책 일치).
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
            최종 개정일: 2026-08-04 · 시행일: 2026-08-11
          </p>

          {/* 제15조 제1항이 요구하는 사전 공지. 시행일까지 이 자리에 둔다.
              이번 변경은 회사가 정리한 공개 팝업 정보의 검색 노출 범위에 관한 것이라
              이용자에게 불리하거나 개인정보 처리에 영향을 주는 변경이 아니다. 그래서
              7일 공지 대상이고, 30일 공지나 재동의 대상이 아니다. */}
          <div className="mt-5 rounded-xl border border-lime-400/40 bg-lime-300/10 p-4">
            <p className="text-sm font-bold text-foreground">약관 변경 안내 (2026-08-11 시행)</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              제14조 제4항을 바꿉니다. 지금까지는 자동수집된 개별 팝업스토어 상세 페이지를 모두
              검색엔진 색인에서 제외했습니다. 앞으로는{' '}
              <strong>운영 종료일과 찾아갈 수 있는 위치가 모두 확인된 팝업</strong>에 한해 색인을
              허용합니다.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              <strong>변경 이유</strong> — 팝업 정보를 찾는 분들이 실제로 검색하는 것은 &ldquo;○○
              팝업 위치&rdquo;, &ldquo;○○ 팝업 기간&rdquo; 처럼 개별 팝업입니다. 그 질문에 답할 수
              있는 페이지가 검색 결과에 나오지 않아, 정보를 찾는 분들이 우리 페이지에 닿지 못하고
              있었습니다.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              <strong>바뀌지 않는 것</strong> — 회원이 작성한 동행 모집글 · 의견 · 채팅은 제14조
              제5항에 따라 <strong>계속 검색엔진에서 차단</strong>합니다. 수집한 원문을 그대로
              재현하지 않는 원칙도 그대로입니다. 이번 변경은 개인정보 처리 방식과 무관합니다.
            </p>
          </div>
        </header>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-10 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제1조 (목적과 적용 범위)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                이 약관은 POP-SPOT이 제공하는 팝업스토어 탐색, 지도, 일정 저장, 커뮤니티, 음악 추천
                및 관련 기능의 이용 조건을 정합니다.
              </li>
              <li>
                개별 화면에서 별도로 안내한 운영 기준이 이 약관과 다르면 해당 기능에 대해서는 개별
                안내가 우선합니다. 개인정보 처리에는 개인정보 처리방침이 함께 적용됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제2조 (가입과 계정 관리)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회원가입은 만 14세 이상만 가능하며, 이용자는 사실에 맞는 정보를 입력해야 합니다.
              </li>
              <li>
                이용자는 비밀번호와 로그인 수단을 안전하게 관리해야 하며, 도용이나 무단 사용을 알게
                된 경우 즉시 회사에 알려야 합니다.
              </li>
              <li>
                회사는 가입 및 중요한 약관 변경 시 이용약관·개인정보 처리방침 각각의 동의 여부,
                동의한 버전과 시각, 만 14세 이상 확인 시각을 기록합니다.
              </li>
              <li>
                회원은 마이페이지에서 탈퇴할 수 있습니다. 법령상 보존 의무가 있는 결제·분쟁 기록은
                정해진 기간 동안 다른 정보와 분리하여 보관합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제3조 (서비스의 내용과 변경)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 팝업 정보 검색·지도·캘린더, 찜·스탬프, 동행 모집·채팅, 음악 추천 등 화면에
                표시된 기능을 제공합니다.
              </li>
              <li>
                점검, 장애, 외부 제공자의 정책 변경, 천재지변 또는 보안상 긴급한 사유가 있으면
                서비스 전부나 일부를 일시 중단할 수 있습니다. 예측 가능한 중대한 변경은 시행 전에
                알립니다.
              </li>
              <li>
                서비스가 의존하는 지도·검색·로그인·음악·예약 등 외부 제공자의 기능은 해당 제공자의
                사정에 따라 변경되거나 중단될 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제4조 (이용자의 의무)</h2>
            <p className="text-foreground/90 mb-2">이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ul className="list-disc list-inside space-y-2 text-foreground/90">
              <li>타인의 계정·개인정보·저작물·상표권 등 권리를 침해하는 행위</li>
              <li>허위 정보, 불법·위협·혐오·성적 착취·괴롭힘 콘텐츠를 게시하는 행위</li>
              <li>
                자동 요청, 취약점 악용, 우회 접속 등으로 서비스나 다른 이용자의 이용을 방해하는 행위
              </li>
              <li>신고·결제·스탬프·랭킹 등 서비스 기능을 속이거나 반복적으로 악용하는 행위</li>
              <li>관련 법령, 이 약관 또는 화면에 안내된 운영 기준을 위반하는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제5조 (회원이 작성한 콘텐츠)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                동행 모집글, 의견, 채팅, 사진 등 회원이 작성한 콘텐츠의 권리와 책임은 작성자에게
                있습니다.
              </li>
              <li>
                회원은 서비스를 운영하고 다른 이용자에게 해당 콘텐츠를 보여주는 데 필요한 범위에서
                회사가 저장·표시·전송하도록 허락합니다. 회사는 광고물 제작 등 다른 목적으로
                이용하려면 별도 동의를 받습니다.
              </li>
              <li>
                불법 또는 권리 침해가 명백하거나 다른 이용자의 안전을 해칠 우려가 있는 콘텐츠는 사전
                통지 없이 임시 제한할 수 있으며, 확인 후 복구·수정·삭제할 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제6조 (외부 사이트와 예약)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                출처, 공식 홈페이지, 지도, 블로그 후기, 예약 버튼은 외부 사이트로 연결될 수
                있습니다. 링크의 운영 주체·주소를 확인한 뒤 이용하시기 바랍니다.
              </li>
              <li>
                외부 사이트에서 이루어지는 예약, 구매, 취소, 환불, 개인정보 처리는 해당 사이트의
                운영자와 이용자 사이의 거래이며 해당 사이트의 약관과 정책이 적용됩니다.
              </li>
              <li>
                POP-SPOT은 외부 사이트의 재고·가격·예약 가능 여부를 보증하지 않으며, 확인되지 않은
                주소를 공식 또는 예약 링크로 추측하여 표시하지 않습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제7조 (결제와 환불)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                POP-SPOT이 직접 판매하는 유료 상품이 있는 경우 가격, 제공 내용, 이용 기간, 취소·환불
                조건을 결제 전에 표시하며 전자상거래 관련 법령을 따릅니다.
              </li>
              <li>
                결제는 화면에 표시된 결제대행사를 통해 처리됩니다. 카드번호 등 결제수단의 상세
                정보는 POP-SPOT이 직접 저장하지 않습니다.
              </li>
              <li>
                외부 예약 사이트에서 결제한 상품은 제6조에 따라 해당 판매자의 환불 기준이
                적용됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제8조 (이용 제한과 책임)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 이 약관 위반, 계정 도용, 반복적인 악용 또는 서비스 안전 침해가 확인되면 경고,
                기능 제한, 게시물 숨김, 계정 정지 또는 해지를 할 수 있습니다. 긴급하지 않은 경우
                사유와 이의 제기 방법을 안내합니다.
              </li>
              <li>
                회사는 고의 또는 중대한 과실이 없는 한 외부 사이트의 행위, 이용자가 입력한 잘못된
                정보, 예측할 수 없는 통신 장애로 발생한 손해를 책임지지 않습니다. 법률상 배제할 수
                없는 책임은 이 조항으로 제한하지 않습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제9조 (외부 음악·영상 서비스)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                음악 검색·표지·미리듣기·재생에는 Spotify, Apple iTunes 및 YouTube의 기능과 자료가
                사용될 수 있습니다. 각 곡에는 가능한 경우 원 서비스로 이동하는 링크와 출처를
                표시합니다.
              </li>
              <li>
                YouTube 영상을 재생하면{' '}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime-500 hover:underline"
                >
                  YouTube 이용약관
                </a>{' '}
                및{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime-500 hover:underline"
                >
                  Google 개인정보 처리방침
                </a>
                이 적용됩니다. POP-SPOT은 재생 전에 외부 영상 연결 사실을 알리고 동의를 받습니다.
              </li>
              <li>
                Spotify 계정 연결과 재생에는{' '}
                <a
                  href="https://www.spotify.com/legal/end-user-agreement/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime-500 hover:underline"
                >
                  Spotify 이용약관
                </a>{' '}
                및{' '}
                <a
                  href="https://www.spotify.com/legal/privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lime-500 hover:underline"
                >
                  Spotify 개인정보 처리방침
                </a>
                이 적용됩니다. 이용자는 연결 해제 기능으로 접근 권한을 철회할 수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제10조 (팝업스토어 정보의 출처 및 자동수집)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본 서비스의 팝업스토어 정보 일부는 운영자의 직접 등록 외에 다음 공개된 외부 소스를
                기반으로 자동 또는 수동으로 수집·정리될 수 있습니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>
                    네이버 검색 API (블로그·뉴스,{' '}
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
                    카카오 검색 API (웹·블로그,{' '}
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
                자동수집 정보의 원본 출처 링크는 각 팝업 상세페이지에 표시되며, 회사는 원문 본문을
                직접 수집하거나 임의로 복제·재배포하지 않습니다.
              </li>
              <li>
                회사는 수집된 정보의 정확성·최신성·완전성을 보장하지 않으며, AI 신뢰도 점수가 기준치
                이상인 경우에 한해 자동 게시되고 그 외에는 운영자의 검수 후 게시됩니다.
              </li>
              <li>
                이용자는 잘못된 정보를 발견한 경우 각 팝업 상세페이지의 신고 버튼을 통해 회사에 알릴
                수 있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제10조의2 (외부 검색 API 의 사용 형태와 약관 준수)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 제10조에 따른 자동수집을 위해 <strong>네이버 검색 API</strong> 및{' '}
                <strong>카카오 검색 API</strong> (이하 「외부 검색 API」) 를 정식 개발자 계정으로
                호출합니다. 각 API 제공자의 일일 호출 한도 및 사용 정책을 준수합니다.
              </li>
              <li>
                외부 검색 API 로 수집되는 항목은 검색 결과의 제목·요약(snippet)·원문 링크·게시일에
                한합니다. 회사는 위 항목을 다음 형태로 가공·이용합니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>
                    LLM (대규모 언어 모델) 을 통해 팝업스토어의 이름·위치·기간· 카테고리만을 추출한
                    구조화 데이터로 변형하며,{' '}
                    <strong>원문 텍스트를 그대로 복제·저장·노출하지 않습니다.</strong>
                  </li>
                  <li>
                    추출된 데이터에는 원본 출처 (제공자명 + 원문 링크) 가 항상 함께 보관되며,
                    팝업스토어 상세페이지에서 이용자가 원문으로 이동할 수 있도록 출처 링크를
                    노출합니다.
                  </li>
                  <li>
                    회사는 외부 검색 API 의 응답 결과를 제3자에게 재배포하거나 검색 결과 페이지
                    자체를 본 서비스에서 재현하지 않습니다.
                  </li>
                </ul>
              </li>
              <li>
                외부 검색 API 의 약관·이용정책이 변경되어 본 조와 충돌하는 경우, 회사는 즉시 본 조를
                개정하고 충돌하는 수집·이용 동작을 중단합니다.
              </li>
              <li>
                네이버·카카오 등 외부 검색 API 제공자 또는 원 콘텐츠의 저작권자가 자사 데이터의 본
                서비스 사용 중단을 요청하는 경우, 회사는 별도 고지 없이 해당 데이터의 수집 및 노출을
                즉시 중단합니다.
              </li>
              <li>
                원 콘텐츠에 대한 권리는 해당 게시자와 권리자에게 있습니다. 회사는 API 제공자가
                허용한 항목과 이용 방식 안에서 출처를 표시하고, 팝업스토어 정보 안내에 필요한
                구조화된 사실 정보만 제공합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제11조 (권리자 정보 삭제 요청 / Takedown)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본인이 운영하는 팝업스토어 또는 본인이 저작권을 보유한 콘텐츠가 본 서비스에
                부정확하게 표시되었거나 본인의 동의 없이 게시되었다고 판단하는 경우, 권리자는 각
                팝업스토어 상세페이지의{' '}
                <strong className="text-red-500">「정보 삭제·수정 요청」</strong> 버튼을 통해 삭제
                또는 수정을 요청할 수 있습니다.
              </li>
              <li>
                신고 접수 시 회사는 해당 요청을 관리자 검증 대기 상태로 기록하고, 24시간 이내에 권리
                관계와 신고 내용을 검토합니다. 명백한 권리 침해 또는 긴급한 피해가 확인된 경우에는
                검토 중 임시로 노출을 차단할 수 있으며, 검토 결과에 따라 다음 중 하나의 조치를
                취합니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>정보 영구 삭제</li>
                  <li>정보 수정 후 재공개</li>
                  <li>
                    정당한 권리자가 아니거나 신고 사유가 부적절한 경우 기존 노출 유지 또는 복구
                  </li>
                </ul>
              </li>
              <li>
                신고 시 다음 정보가 필요합니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>신고자 이메일</li>
                  <li>신고 사유 (저작권 침해 / 정보 오류 / 본인 동의 없는 게시 등)</li>
                </ul>
              </li>
              <li>
                허위 신고로 정상 콘텐츠의 노출을 방해한 경우, 신고자에게 손해배상 책임이 있을 수
                있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제12조 (정보의 보존)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                본 서비스는 종료된 팝업스토어 정보를 이력 보존 목적으로 캘린더·랭킹·신상 목록에서는
                자동으로 숨기되, 데이터베이스 상으로는 일정 기간 보관할 수 있습니다.
              </li>
              <li>권리자의 영구 삭제 요청은 제11조 절차에 따라 정당성을 확인한 후 삭제됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제13조 (개인정보의 수집·이용)
            </h2>
            <p className="text-foreground/90 mb-4">
              회사는 개인정보 보호법 등 관계 법령에 따라 다음과 같이 회원의 개인정보를
              수집·이용합니다. 회원가입 시 본 조항에 동의함으로써 효력이 발생합니다.
            </p>

            <div className="overflow-x-auto rounded-md border border-[var(--color-border)] mb-4">
              <table className="w-full text-sm">
                <thead className="bg-surface/50">
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-3 py-2 text-left font-bold text-foreground w-32">구분</th>
                    <th className="px-3 py-2 text-left font-bold text-foreground">내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ① 수집 항목
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      이메일(아이디), 비밀번호(암호화 저장), 이름(닉네임), 휴대전화번호, 동의한
                      이용약관·개인정보 처리방침 버전과 동의 시각, 만 14세 이상 확인 시각
                      <br />
                      <span className="text-xs text-muted-foreground">
                        SNS 간편가입의 경우: 해당 플랫폼이 제공하는 식별자, 이메일, 프로필
                        이름·이미지
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ② 수집·이용 목적
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원 식별 및 본인 확인, 부정 이용 방지, 서비스 제공 (스탬프·찜·메이트 매칭
                      등), 고객 문의 응대, 약관 변경 등 필수 고지사항 전달
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ③ 보유·이용 기간
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원 탈퇴 시까지. 단, 관계법령(전자상거래법, 통신비밀보호법 등)에 따라 보존이
                      필요한 경우 해당 기간 동안 보관 후 파기.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-bold text-foreground/80 align-top">
                      ④ 동의 거부 권리
                    </td>
                    <td className="px-3 py-2 text-foreground/80">
                      회원은 본 동의를 거부할 권리가 있습니다. 다만, 위 수집 항목은 서비스 이용에
                      필수적이므로 동의를 거부하시면 회원 가입 및 서비스 이용이 제한됩니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 위 기간이 경과하거나 수집·이용 목적이 달성된 개인정보를 지체 없이 파기합니다.
              </li>
              <li>
                회원은 언제든지 마이페이지를 통해 본인 정보를 열람·수정할 수 있으며, 회원 탈퇴를
                통해 모든 개인정보의 삭제를 요청할 수 있습니다.
              </li>
              <li>
                회사는 회원의 개인정보를 본인의 동의 없이 제3자에게 제공하거나 목적 외 용도로
                이용하지 않습니다. 단, 법령에 의해 요구되는 경우는 예외로 합니다.
              </li>
              <li>
                회사는 회원의 비밀번호를 단방향 해시(BCrypt strength 12)로 저장하며 평문 형태로
                보관하지 않습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">제14조 (검색엔진 노출 정책)</h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 본 서비스를 네이버 · 구글 등 검색엔진에 사이트맵 등록하여 일반 사용자가
                검색을 통해 본 사이트의 공개 페이지에 접근할 수 있도록 합니다.
              </li>
              <li>
                사이트맵에는 운영자가 작성한 정적 안내 페이지와, 공개 팝업 정보를 지역·시점·분류별로
                정리한 검색 안내 페이지를 포함할 수 있습니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>서비스 메인 (지도 / 캘린더 진입)</li>
                  <li>서비스 소개 (/about)</li>
                  <li>이용약관 (/terms)</li>
                  <li>개인정보 처리방침 (/privacy)</li>
                  <li>지역·시점·브랜드·분류별 팝업 안내 페이지 (/popups/* 및 다국어 경로)</li>
                </ul>
              </li>
              <li>
                다음 경로는 사이트맵에서 명시적으로 제외되며 <code>robots.txt</code> 와 페이지의{' '}
                <code>noindex</code> 메타 태그를 통해 검색엔진 색인이 차단됩니다.
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-foreground/80">
                  <li>회원가입 / 로그인 / 계정 찾기 / OAuth 콜백</li>
                  <li>어드민 콘솔 및 모든 어드민 API</li>
                  <li>의견 보내기 페이지 (사용자 콘텐츠 노출 차단)</li>
                  <li>작전 회의실 (방 ID 가 URL 에 포함되는 협업 페이지)</li>
                </ul>
              </li>
              <li>
                <strong>자동수집된 개별 팝업스토어 상세 페이지</strong>는{' '}
                <strong>운영 종료일과 찾아갈 수 있는 위치가 모두 확인된 경우에 한해</strong>{' '}
                검색엔진 색인을 허용합니다. 그 밖의 경우 — 이미 종료된 팝업, 종료일을 확인하지 못한
                팝업, 위치가 구체적이지 않은 팝업 — 는 사이트맵에서 제외하고 페이지 응답의{' '}
                <code>noindex</code> 메타 태그로 색인을 차단합니다. 색인이 허용된 경우에도 회사가
                정리한 사실 정보(이름 · 운영 기간 · 위치 · 분류)만 제공하며{' '}
                <strong>수집한 원문을 그대로 재현하지 않습니다</strong>. 지역 · 시점 · 분류별 안내
                페이지는 공개 정보의 분류와 집계만 제공합니다.
              </li>
              <li>
                회원이 작성한 동행 모집글 · 의견 · 채팅 등의 게시물은 페이지 메타 태그와 API 응답의
                <code>X-Robots-Tag</code> 헤더로 검색엔진 색인을 명시적으로 차단합니다. 이 정책을
                변경해 검색 노출 범위를 넓히는 경우에는 사전에 공지하고 필요한 동의 절차를
                진행합니다.
              </li>
              <li>
                권리자가 제11조에 따라 정보 삭제를 요청하여 회사가 해당 정보를 삭제한 경우, 회사는
                합리적 기간 안에 네이버 · 구글 등 주요 검색엔진에 캐시 삭제 및 색인 제거를 함께
                요청합니다.
              </li>
              <li>
                회원은 본인이 작성한 닉네임 · 게시물 등이 검색엔진 외부에 노출되는 것을 원하지 않는
                경우 마이페이지의 게시물 삭제 또는 회원 탈퇴를 통해 노출 가능성을 차단할 수
                있습니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-foreground">
              제15조 (약관 변경과 분쟁 해결)
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-foreground/90">
              <li>
                회사는 약관을 바꾸는 경우 시행일과 변경 이유를 시행 7일 전부터 알립니다. 이용자에게
                불리하거나 개인정보 처리에 중대한 영향을 주는 변경은 30일 전에 알리고 필요한 경우
                다시 동의를 받습니다.
              </li>
              <li>
                이 약관에는 대한민국 법률이 적용됩니다. 분쟁이 생기면 회사와 이용자는 먼저 성실히
                협의하며, 해결되지 않으면 민사소송법이 정한 법원에서 해결합니다.
              </li>
            </ol>
          </section>

          <section className="rounded-lg border border-[var(--color-border)] bg-surface/50 p-5">
            <h2 className="text-lg font-bold mb-2 text-foreground">문의 및 신고</h2>
            <p className="text-sm text-muted-foreground">
              위 조항과 관련된 문의 또는 신고는 다음 메일로 보내주시기 바랍니다.
            </p>
            <p className="mt-2 text-sm">
              Contact:{' '}
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
