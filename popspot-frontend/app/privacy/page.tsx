import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | POP-SPOT",
  description:
    "POP-SPOT 의 개인정보 수집·이용·보관·파기·제3자 제공·이용자 권리 안내. 개인정보 보호법(PIPA) 기준.",
};

/* ============================== 상수 ============================== */

const CONTACT_EMAIL = "reo4321@naver.com";
const POLICY_REVISION_DATE = "2026-05-18";
const POLICY_EFFECTIVE_DATE = "2026-05-18";

const DISPUTE_AGENCIES = [
  { name: "개인정보분쟁조정위원회", url: "https://kopico.go.kr", phone: "1833-6972" },
  { name: "개인정보침해신고센터", url: "https://privacy.kisa.or.kr", phone: "118" },
] as const;

/* ============================== 데이터 — 조항 본문 ============================== */

interface ColumnRow {
  cells: readonly string[];
}
interface PolicyTable {
  headers: readonly string[];
  rows: readonly ColumnRow[];
}

const COLLECTION_TABLE: PolicyTable = {
  headers: ["구분", "수집 항목", "수집 시점"],
  rows: [
    {
      cells: [
        "필수 (이메일 가입)",
        "이메일, 비밀번호(해시), 닉네임, 휴대전화번호",
        "회원가입 시",
      ],
    },
    {
      cells: [
        "필수 (소셜 로그인)",
        "OAuth 제공자(Google · Kakao · Naver) 프로필: 이메일, 닉네임, 프로필 사진, 제공자 고유 ID",
        "소셜 로그인 시",
      ],
    },
    {
      cells: [
        "자동 생성",
        "접속 IP, 브라우저/디바이스 정보, 접속 일시, 서비스 이용 기록 (열람한 팝업·재생한 곡·찜 목록·스탬프 기록)",
        "서비스 이용 중",
      ],
    },
    {
      cells: ["선택", "메이트(동행) 게시글 본문 및 채팅 메시지", "사용자가 작성 시"],
    },
  ],
};

const PROCESSOR_TABLE: PolicyTable = {
  headers: ["위탁 업체", "위탁 업무"],
  rows: [
    { cells: ["Google LLC", "소셜 로그인 인증"] },
    { cells: ["Kakao Corp.", "소셜 로그인 인증, 지도 정보 표시"] },
    { cells: ["NAVER Cloud Corp.", "소셜 로그인 인증, 검색 결과 제공"] },
    { cells: ["Vercel Inc.", "프론트엔드 호스팅"] },
    { cells: ["Sentry, Inc.", "에러 모니터링 (IP 일부 포함)"] },
    {
      cells: [
        "Groq, Inc.",
        "LLM 기반 음악 무드 분석 · 자동수집 정규화 (개인정보 미포함)",
      ],
    },
    {
      cells: [
        "Spotify · YouTube · Algolia",
        "음악 메타데이터 · 영상 재생 · 검색 인덱싱 (사용자 식별 정보 미전송)",
      ],
    },
  ],
};

/* ============================== 페이지 ============================== */

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
        <PageHeader />

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-10 leading-relaxed">
          <Section title="제1조 (수집하는 개인정보 항목 및 수집 방법)">
            <p className="mb-3">POP-SPOT 은 다음 항목을 수집합니다.</p>
            <DataTable table={COLLECTION_TABLE} />
            <Note>
              민감정보 (사상·신념·노조 가입·건강·성생활 등) 및 고유식별정보 (주민등록번호 등) 는 일체
              수집하지 않습니다.
            </Note>
          </Section>

          <Section title="제2조 (개인정보의 이용 목적)">
            <Ol
              items={[
                "회원 식별 · 로그인 인증 · 부정 이용 방지",
                "서비스 제공 (팝업 정보, 음악 매칭, 동행 게시판, 스탬프·등급 시스템)",
                "고객 문의 응답 및 takedown(권리자 신고) 처리",
                "서비스 품질 개선을 위한 통계 분석 (개인 식별 불가능한 형태)",
              ]}
            />
            <Note>
              위 목적 외의 용도로는 이용하지 않으며, 이용 목적이 변경되면 사전 동의를 구합니다.
            </Note>
          </Section>

          <Section title="제3조 (개인정보의 보유 및 이용 기간)">
            <Ul
              items={[
                "회원 계정 정보 — 회원 탈퇴 시 즉시 파기",
                "서비스 이용 기록 (찜·스탬프·음악 청취 기록) — 회원 탈퇴 시 즉시 파기",
                "접속 IP · 로그 기록 — 통신비밀보호법 제15조의2 에 따라 3개월간 보관 후 파기",
                "관련 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 별도 보관",
              ]}
            />
          </Section>

          <Section title="제4조 (개인정보의 제3자 제공)">
            <p>
              POP-SPOT 은 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 의해
              요구되거나 수사기관의 정당한 요청이 있는 경우는 예외로 합니다.
            </p>
          </Section>

          <Section title="제5조 (개인정보 처리의 위탁)">
            <p className="mb-3">
              기능 제공을 위해 다음 외부 사업자에게 일부 처리를 위탁합니다.
            </p>
            <DataTable table={PROCESSOR_TABLE} />
            <Note>
              위탁 시 개인정보 보호법 제26조에 따라 위탁업무 수행 목적 외 개인정보 처리 금지,
              안전성 확보 조치, 재위탁 제한 등을 계약에 반영합니다.
            </Note>
          </Section>

          <Section title="제6조 (이용자의 권리 및 행사 방법)">
            <p className="mb-3">이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <Ul
              items={[
                "개인정보 열람 요구",
                "오류 정정 요구",
                "삭제 요구 (회원 탈퇴)",
                "처리 정지 요구",
              ]}
            />
            <Note>
              마이페이지 또는 <ContactLink subject="POP-SPOT 개인정보 요청" /> 으로 요청하면 지체 없이
              처리합니다 (최대 10일 이내).
            </Note>
          </Section>

          <Section title="제7조 (개인정보 파기 절차 및 방법)">
            <Ul
              items={[
                "전자 파일 — 복구·재생이 불가능한 방법으로 영구 삭제",
                "종이 문서 — 분쇄기로 분쇄하거나 소각 (현재 종이 문서 보관 없음)",
              ]}
            />
          </Section>

          <Section title="제8조 (만 14세 미만 아동의 개인정보)">
            <p>
              POP-SPOT 은 <strong>만 14세 이상</strong>만 가입할 수 있습니다. 만 14세 미만 아동의
              회원가입은 허용하지 않으며, 만 14세 미만임이 확인되면 즉시 계정을 해지하고 관련
              개인정보를 파기합니다.
            </p>
          </Section>

          <Section title="제9조 (개인정보의 안전성 확보 조치)">
            <Ul
              items={[
                "비밀번호 일방향 암호화 저장 (BCrypt strength 12)",
                "전송 구간 HTTPS 암호화 (TLS 1.2 이상)",
                "접근 권한 최소화 및 로그 관리",
                "외부 공격 방어를 위한 요청 제한 (Rate Limit)",
              ]}
            />
          </Section>

          <Section title="제10조 (쿠키 및 분석 도구)">
            <p>
              로그인 유지를 위한 필수 쿠키와 서비스 품질 개선용 분석 도구 (Sentry, Vercel
              Analytics) 를 사용합니다. 광고용 추적 쿠키는 사용하지 않습니다. 분석 도구는 개인을
              식별할 수 없는 형태의 통계 정보만 수집합니다.
            </p>
          </Section>

          <Section title="제11조 (개인정보 보호책임자)">
            <div className="rounded-md border border-lime-400/40 bg-lime-300/10 p-4 my-3">
              <p className="font-bold text-foreground mb-2">
                개인정보 보호책임자 (DPO)
              </p>
              <Ul
                items={[
                  "직책 — POP-SPOT 서비스 운영 책임자",
                  <>대표 연락처 — <ContactLink subject="POP-SPOT 개인정보 문의" /></>,
                  "응답 시간 — 영업일 기준 3일 이내",
                ]}
              />
              <p className="text-xs text-muted-foreground mt-2">
                개인정보 처리 관련 문의 · 불만 · 권리 행사 요청은 위 연락처로 보내주시면 지체 없이 답변 드립니다.
              </p>
            </div>
            <p className="mt-4">
              <strong>분쟁 조정 기관:</strong>
            </p>
            <Ul
              items={DISPUTE_AGENCIES.map((a) => (
                <>
                  {a.name} —{" "}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-lime-500"
                  >
                    {a.url.replace("https://", "")}
                  </a>{" "}
                  / {a.phone}
                </>
              ))}
            />
          </Section>

          <Section title="제12조 (개정 고지)">
            <p>
              본 처리방침이 변경되면 시행일 7일 전부터 본 페이지 상단에 고지합니다. 중대한 변경
              시 가입된 이메일로 별도 안내합니다.
            </p>
          </Section>
        </article>

        <footer className="mt-12 pt-6 border-t border-[var(--color-border)]">
          <Link
            href="/terms"
            className="text-sm text-muted-foreground hover:text-lime-500 transition-colors"
          >
            ← 이용약관 보기
          </Link>
        </footer>
      </div>
    </main>
  );
}

/* ============================== 내부 컴포넌트 ============================== */

function PageHeader() {
  return (
    <header className="mb-10">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-lime-500 transition-colors"
      >
        ← 홈으로
      </Link>
      <h1 className="text-3xl lg:text-4xl font-black tracking-tight mt-4 text-foreground">
        POP-SPOT 개인정보 처리방침
      </h1>
      <p className="text-sm text-muted-foreground mt-2">
        최종 개정일: {POLICY_REVISION_DATE} · 시행일: {POLICY_EFFECTIVE_DATE}
      </p>
      <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
        POP-SPOT 은 개인정보 보호법 제30조에 따라 이용자의 개인정보를 보호하고 관련 고충을
        신속하게 처리하기 위해 다음 처리방침을 둡니다.
      </p>
    </header>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-3 text-foreground">{title}</h2>
      <div className="text-foreground/90">{children}</div>
    </section>
  );
}

function DataTable({ table }: { table: PolicyTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-[var(--color-border)]">
        <thead className="bg-foreground/5">
          <tr>
            {table.headers.map((h) => (
              <th key={h} className="p-2 text-left border-b border-[var(--color-border)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-foreground/80">
          {table.rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri < table.rows.length - 1 ? "border-b border-[var(--color-border)]" : ""}
            >
              {row.cells.map((cell, ci) => (
                <td key={ci} className="p-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ul({ items }: { items: readonly React.ReactNode[] }) {
  return (
    <ul className="list-disc list-inside space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Ol({ items }: { items: readonly React.ReactNode[] }) {
  return (
    <ol className="list-decimal list-inside space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground/70 mt-3">{children}</p>;
}

function ContactLink({ subject }: { subject: string }) {
  const encoded = encodeURIComponent(subject);
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}?subject=${encoded}`}
      className="underline text-lime-500"
    >
      {CONTACT_EMAIL}
    </a>
  );
}
