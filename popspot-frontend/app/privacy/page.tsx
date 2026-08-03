import Link from 'next/link';
import type { Metadata } from 'next';
import { ExternalMediaConsentControl } from '@/components/legal/ExternalMediaConsentControl';

export const metadata: Metadata = {
  title: '개인정보 처리방침 | POP-SPOT',
  description:
    'POP-SPOT 의 개인정보 수집·이용·보관·파기·제3자 제공·국외 이전·이용자 권리 안내. 개인정보 보호법(PIPA) 기준.',
};

/* ============================== 상수 ============================== */

const CONTACT_EMAIL = 'reo4321@naver.com';
// 개인정보 보호책임자의 '성명' 은 개인정보 보호법 시행령 제31조가 요구하는 법정 필수 기재사항이라
// 직책·연락처만으로는 방침이 성립하지 않는다. 담당자 교체 시 이 상수만 고치면 되도록 분리한다.
const DPO_NAME = '김동현';
const POLICY_REVISION_DATE = '2026-08-03';
// 제13조가 '시행일 7일 전 고지' 를 약속하므로 개정일 + 7일을 시행일로 둔다 (방침이 스스로를 어기지 않도록).
const POLICY_EFFECTIVE_DATE = '2026-08-10';

const DISPUTE_AGENCIES = [
  { name: '개인정보분쟁조정위원회', url: 'https://kopico.go.kr', phone: '1833-6972' },
  { name: '개인정보침해신고센터', url: 'https://privacy.kisa.or.kr', phone: '118' },
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
  headers: ['구분', '수집 항목', '수집 시점'],
  rows: [
    {
      cells: ['필수 (이메일 가입)', '이메일, 비밀번호(해시), 닉네임, 휴대전화번호', '회원가입 시'],
    },
    {
      cells: [
        '필수 동의 증적',
        '이용약관 버전, 개인정보 처리방침 버전, 동의 일시, 만 14세 이상 확인 일시 — 생년월일과 성별은 수집하지 않음',
        '회원가입·소셜 첫 로그인 및 정책 재동의 시',
      ],
    },
    {
      cells: [
        '필수 (소셜 로그인)',
        'OAuth 제공자(Google · Kakao · Naver) 프로필: 이메일, 닉네임, 프로필 사진, 제공자 고유 ID',
        '소셜 로그인 시',
      ],
    },
    {
      cells: [
        '자동 생성',
        '접속 IP, 브라우저/디바이스 정보, 접속 일시, 서비스 이용 기록 (열람한 팝업·재생한 곡·찜 목록·스탬프 기록)',
        '서비스 이용 중',
      ],
    },
    // 방문 통계 로그는 IP 를 안 받는 대신 User-Agent 와 회원/게스트 구분을 실제로 저장한다.
    // 저장하는 항목은 전부 방침에 적혀 있어야 하므로 자동 생성 항목에서 따로 떼어 명시한다.
    {
      cells: [
        '자동 생성 (방문 통계)',
        '익명 방문자 ID (브라우저가 생성한 무작위 값), 방문한 페이지 경로, 브라우저·기기 종류(User-Agent), 회원/게스트 구분, 방문 일시 — 접속 IP 와 회원 개인정보는 저장하지 않음',
        '페이지 방문 시',
      ],
    },
    {
      cells: [
        '유료 결제 시',
        '주문번호, 결제 승인번호, 상품명, 결제 금액, 결제 일시 (카드번호 등 결제수단 정보는 결제대행사가 처리하며 POP-SPOT 은 보관하지 않음)',
        '유료 상품 결제 시',
      ],
    },
    {
      cells: ['선택', '메이트(동행) 게시글 본문 및 채팅 메시지', '사용자가 작성 시'],
    },
  ],
};

// Algolia 는 자체 AI 검색으로 대체돼 이용자 개인정보를 다루는 경로가 남아 있지 않으므로 목록에서 제외한다.
// (팝업 정보 색인은 개인정보 처리 위탁이 아니다.)
const PROCESSOR_TABLE: PolicyTable = {
  headers: ['외부 사업자', '이용 목적'],
  rows: [
    {
      cells: [
        'Google LLC',
        '소셜 로그인 인증, 음악 검색어 자동완성, YouTube 영상 재생, Gmail을 통한 인증·안내 메일 발송',
      ],
    },
    { cells: ['Kakao Corp.', '소셜 로그인 인증, 공개 검색 결과 제공'] },
    { cells: ['NAVER Cloud Corp.', '소셜 로그인 인증, 검색 결과 제공'] },
    {
      cells: [
        'SK텔레콤 주식회사 (TMAP)',
        '사용자가 보행 경로를 요청한 경우 출발·도착 좌표를 이용한 경로 계산',
      ],
    },
    {
      cells: ['(주)코리아포트원 (PortOne · 구 아임포트)', '결제 승인 · 결제 내역 검증 · 결제 취소'],
    },
    { cells: ['Vercel Inc.', '프론트엔드 호스팅, 익명 접속·성능 통계 수집'] },
    {
      cells: ['Functional Software, Inc. (Sentry)', '오류 모니터링 (개인정보 전송 옵션 비활성화)'],
    },
    {
      cells: ['Groq, Inc.', 'LLM 기반 음악 무드 분석 · 자동수집 정규화 (개인정보 미포함)'],
    },
    {
      cells: ['Spotify AB', '음악 메타데이터 조회 · 재생 제어 (계정 연동 시에 한함)'],
    },
    {
      cells: [
        'Canva Germany GmbH (Pexels)',
        '스톡 이미지 제공 (이미지 요청 시 접속 정보가 전달될 수 있음)',
      ],
    },
    { cells: ['Apple Inc.', 'iTunes 음악 메타데이터 · 앨범 표지 · 미리듣기 제공'] },
    { cells: ['GitHub, Inc.', '지도에 필요한 공개 글꼴 데이터 제공'] },
    { cells: ['FOSSGIS e.V. (OSRM 공개 서버)', '사용자가 선택한 출발·도착 좌표의 경로 계산'] },
  ],
};

/**
 * 국외 이전 고지 (개인정보 보호법 제28조의8).
 *
 * <p>위 외부 사업자 중 국내 사업자(Kakao · NAVER · SK텔레콤 · 코리아포트원) 를 뺀 나머지는 전부 국외 사업자라, 외부 서비스 표만으로는 고지 의무가 채워지지 않는다.
 * 법이 요구하는 5개 항목(이전받는 자·국가·항목·목적·기간·방법) 을 업체별로 적는다.
 */
const OVERSEAS_TRANSFER_TABLE: PolicyTable = {
  headers: ['이전받는 자 (이전 국가)', '이전 항목', '이전 목적', '이전 일시 및 방법', '보유 기간'],
  rows: [
    {
      cells: [
        'Google LLC (미국)',
        '이메일, 닉네임, 프로필 사진, 제공자 고유 ID',
        'Google 소셜 로그인 인증',
        '이용자가 Google 로그인을 선택한 시점에 HTTPS 로 전송',
        '회원 탈퇴 또는 연동 해제 시까지',
      ],
    },
    {
      cells: [
        'Google LLC — YouTube (미국)',
        '접속 IP, 브라우저 정보, 재생 요청 영상 식별자',
        '팝업 소개 영상 재생',
        '영상을 재생하는 시점에 HTTPS 로 전송',
        '이전받는 자의 로그 보관 정책에 따름',
      ],
    },
    {
      cells: [
        'Google LLC — 검색어 자동완성 (미국)',
        '이용자가 입력 중인 음악 검색어',
        '음악 검색어 자동완성 후보 제공',
        '음악 검색란에 입력한 시점에 서버를 거쳐 HTTPS로 전송',
        '서비스 제공자의 로그 보관 정책에 따름',
      ],
    },
    {
      cells: [
        'Vercel Inc. (미국)',
        '접속 IP, 브라우저 정보, 요청한 페이지 경로, 페이지 성능 지표',
        '웹사이트 호스팅 및 익명 접속·성능 통계 집계',
        '페이지를 요청하는 시점에 HTTPS 로 전송',
        '위탁 계약 종료 시까지 (접속 로그는 사업자 정책에 따라 자동 삭제)',
      ],
    },
    {
      cells: [
        'Functional Software, Inc. — Sentry (미국)',
        '오류 발생 일시, 요청 경로, 오류 스택트레이스, 브라우저·서버 환경 정보',
        '서비스 오류 원인 분석 및 장애 대응',
        '오류가 발생한 시점에 HTTPS 로 전송',
        '위탁 계약 종료 또는 보관 기간 경과 시까지',
      ],
    },
    {
      cells: [
        'Groq, Inc. (미국)',
        '팝업 소개문 · 음악 제목 등 서비스 콘텐츠 텍스트 (이용자 개인정보 미포함)',
        'LLM 기반 음악 무드 분석 및 수집 데이터 정규화',
        '분석이 필요한 시점에 API(HTTPS) 로 전송',
        '이전 목적 달성 즉시 파기',
      ],
    },
    {
      cells: [
        'Spotify AB (스웨덴)',
        'Spotify 계정 연동 시 발급되는 접근 토큰, 재생 요청 정보',
        '음악 메타데이터 조회 및 재생 제어',
        '계정 연동 · 재생 요청 시점에 HTTPS 로 전송',
        '연동 해제 또는 회원 탈퇴 시까지',
      ],
    },
    {
      cells: [
        'Google LLC — Gmail (미국)',
        '수신 이메일 주소, 인증번호·서비스 안내 등 메일 내용',
        '회원 인증, 계정 복구 및 사용자가 신청한 알림 메일 발송',
        '메일 발송 시점에 TLS로 전송',
        '메일 제공자의 정책 및 발송 기록 보관 기간에 따름',
      ],
    },
    {
      cells: [
        'Canva Germany GmbH — Pexels (독일; 미국·호주·싱가포르·EU·영국·필리핀·뉴질랜드 등에서 처리 가능)',
        '접속 IP, 브라우저 정보, 요청한 이미지 주소',
        '팝업 상세·목록의 스톡 이미지 제공',
        '이미지가 표시되는 시점에 HTTPS로 전송',
        '이미지 제공자의 로그 보관 정책에 따름',
      ],
    },
    {
      cells: [
        'Apple Inc. — iTunes (미국)',
        '접속 IP, 브라우저 정보, 음악 검색·미리듣기 요청 정보',
        '음악 메타데이터, 앨범 표지 및 미리듣기 제공',
        '음악 기능을 이용하는 시점에 HTTPS로 전송',
        '서비스 제공자의 로그 보관 정책에 따름',
      ],
    },
    {
      cells: [
        'GitHub, Inc. — GitHub Pages (미국)',
        '접속 IP, 브라우저 정보, 지도 글꼴 요청 정보',
        '지도 라벨 표시에 필요한 공개 글꼴 제공',
        '지도를 표시하는 시점에 HTTPS로 전송',
        '서비스 제공자의 로그 보관 정책에 따름',
      ],
    },
    {
      cells: [
        'FOSSGIS e.V. — OSRM 공개 서버 (독일)',
        '접속 IP, 브라우저 정보, 사용자가 선택한 출발·도착 좌표',
        '작전지도 도보 경로 계산',
        '경로 계산을 요청한 시점에 HTTPS로 전송',
        '서비스 제공자의 로그 보관 정책에 따름',
      ],
    },
  ],
};

/** 법정 보존 항목 — 이용자가 탈퇴해도 지울 수 없는 데이터가 무엇인지 근거와 함께 밝힌다. */
const LEGAL_RETENTION_TABLE: PolicyTable = {
  headers: ['보존 항목', '보존 기간', '근거 법령'],
  rows: [
    {
      cells: [
        '계약 또는 청약철회 등에 관한 기록',
        '5년',
        '전자상거래 등에서의 소비자보호에 관한 법률 제6조',
      ],
    },
    {
      cells: [
        '대금 결제 및 재화 등의 공급에 관한 기록',
        '5년',
        '전자상거래 등에서의 소비자보호에 관한 법률 제6조',
      ],
    },
    {
      cells: [
        '소비자의 불만 또는 분쟁 처리에 관한 기록',
        '3년',
        '전자상거래 등에서의 소비자보호에 관한 법률 제6조',
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
              민감정보 (사상·신념·노조 가입·건강·성생활 등) 및 고유식별정보 (주민등록번호 등) 는
              일체 수집하지 않습니다.
            </Note>
          </Section>

          <Section title="제2조 (개인정보의 이용 목적)">
            <Ol
              items={[
                '회원 식별 · 로그인 인증 · 부정 이용 방지',
                '서비스 제공 (팝업 정보, 음악 매칭, 동행 게시판, 스탬프·등급 시스템)',
                '고객 문의 응답 및 takedown(권리자 신고) 처리',
                '서비스 품질 개선을 위한 통계 분석 (개인 식별 불가능한 형태)',
              ]}
            />
            <Note>
              통계 분석에는 Vercel Web Analytics · Vercel Speed Insights (모두 쿠키리스 · 익명) 와
              자체 익명 방문 로그 (랜덤 방문자 ID · 페이지 경로 · 봇 식별용 브라우저
              정보(User-Agent) · 회원/게스트 구분을 기록하며, IP와 회원 개인정보는 수집하지 않음) 를
              사용합니다.
            </Note>
            <Note>
              위 목적 외의 용도로는 이용하지 않으며, 이용 목적이 변경되면 사전 동의를 구합니다.
            </Note>
          </Section>

          <Section title="제3조 (개인정보의 보유 및 이용 기간)">
            <Ul
              items={[
                '회원 계정 정보 — 회원 탈퇴 시 이메일 · 닉네임 · 휴대전화번호 · 프로필 사진 등 개인을 알아볼 수 있는 항목을 즉시 삭제하거나 복원할 수 없는 무작위 값으로 대체합니다. 결제 기록과의 연결을 유지하기 위한 내부 식별자(무작위 문자열)만 남으며, 이 값만으로는 이용자를 특정할 수 없습니다.',
                '서비스 이용 기록 (찜 · 스탬프 · 음악 청취 기록 · 작성한 동행 게시글과 채팅) — 회원 탈퇴 시 함께 삭제',
                '익명 방문 로그 (방문자 ID · 경로 · User-Agent · 회원/게스트 구분) — 90일간 보관 후 매일 자동 삭제',
                '데이터베이스 백업본 — 7일간 보관 후 자동 삭제 (삭제 직전 데이터가 백업본에 최대 7일간 남을 수 있습니다)',
                '아래 법령이 보존을 의무화한 항목 — 탈퇴 여부와 관계없이 해당 기간 동안 다른 용도로는 쓰지 않고 별도 보관',
              ]}
            />
            <div className="mt-3">
              <DataTable table={LEGAL_RETENTION_TABLE} />
            </div>
            <Note>
              결제 기록은 전자상거래 등에서의 소비자보호에 관한 법률이 사업자에게 보존을 의무로
              정하고 있어, 이용자가 삭제를 요청하더라도 보존 기간이 끝나기 전에는 파기할 수
              없습니다. 보존 기간이 지나면 지체 없이 파기합니다.
            </Note>
          </Section>

          <Section title="제4조 (개인정보의 제3자 제공)">
            <p>
              POP-SPOT 은 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 의해
              요구되거나 수사기관의 정당한 요청이 있는 경우는 예외로 합니다.
            </p>
          </Section>

          <Section title="제5조 (외부 서비스 제공자 및 처리 위탁)">
            <p className="mb-3">
              기능 제공을 위해 다음 외부 사업자의 API·호스팅·콘텐츠를 이용합니다. 사업자에 따라
              POP-SPOT의 지시에 따라 처리하는 수탁자이거나, 이용자가 선택한 외부 기능을 독립적으로
              제공하는 사업자일 수 있습니다.
            </p>
            <DataTable table={PROCESSOR_TABLE} />
            <Note>
              백엔드, 데이터베이스와 회원이 올린 파일은 대한민국 내 전용 서버에서 운영·보관합니다.
              서버의 물리적 운영자 등 제3자가 개인정보에 접근할 수 있는 구조로 바뀌는 경우, 회사는
              해당 운영자를 수탁자로 공개하고 필요한 계약과 접근 통제를 먼저 적용합니다.
            </Note>
            <Note>
              개인정보 처리 위탁 관계에 해당하는 사업자와는 개인정보 보호법 제26조에 따라 목적 외
              처리 금지, 안전성 확보 조치, 재위탁 관리 등을 계약과 설정에 반영합니다. 외부 사업자가
              독립적으로 처리하는 기능은 해당 사업자의 약관·개인정보 처리방침이 함께 적용됩니다.
            </Note>
          </Section>

          <Section title="제6조 (개인정보의 국외 이전)">
            <p className="mb-3">
              위 수탁 업체 중 일부는 국외에 소재하므로, 해당 업체의 서비스를 이용하는 과정에서
              개인정보가 국외로 이전됩니다. 개인정보 보호법 제28조의8에 따라 다음과 같이 알려
              드립니다.
            </p>
            <DataTable table={OVERSEAS_TRANSFER_TABLE} />
            <Note>
              Kakao Corp. · NAVER Cloud Corp. · SK텔레콤 · (주)코리아포트원은 국내 사업자로,
              이들에게 제공되는 개인정보는 국외로 이전되지 않습니다.
            </Note>
            <Note>
              이용자는 개인정보의 국외 이전을 거부할 수 있습니다. 다만 이전은 해당 기능을 제공하기
              위한 필수 절차이므로, 거부하시는 경우 소셜 로그인 · 음악 재생 · 영상 재생 등 관련 기능
              이용이 제한될 수 있습니다. 거부를 원하시면{' '}
              <ContactLink subject="POP-SPOT 국외 이전 거부 요청" /> 으로 알려 주십시오.
            </Note>
            <Note>
              국외 이전 시에도 개인정보 보호법 제28조의8 제4항에 따라 암호화 전송(TLS), 접근 권한
              최소화 등 보호 조치를 적용하며, 이전받는 자에게 이전 목적 외 이용 금지를 계약으로
              요구합니다.
            </Note>
          </Section>

          <Section title="제7조 (이용자의 권리 및 행사 방법)">
            <p className="mb-3">이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <Ul
              items={[
                '개인정보 열람 요구',
                '오류 정정 요구',
                '삭제 요구 (회원 탈퇴)',
                '처리 정지 요구',
              ]}
            />
            <Note>
              마이페이지 또는 <ContactLink subject="POP-SPOT 개인정보 요청" /> 으로 요청하면 지체
              없이 처리합니다 (최대 10일 이내).
            </Note>
          </Section>

          <Section title="제8조 (개인정보 파기 절차 및 방법)">
            <Ul
              items={[
                '파기 시점 — 회원 탈퇴, 보유 기간 경과, 처리 목적 달성 시 지체 없이 (제3조의 법정 보존 항목은 제외)',
                '전자 파일 — 복구·재생이 불가능한 방법으로 영구 삭제',
                '식별정보 대체 — 법정 보존 의무 때문에 레코드 자체를 지울 수 없는 경우, 이메일·닉네임 등 개인을 알아볼 수 있는 항목을 복원 불가능한 무작위 값으로 바꿔 더 이상 이용자를 특정할 수 없게 만든 뒤 보관합니다',
                '종이 문서 — 분쇄기로 분쇄하거나 소각 (현재 종이 문서 보관 없음)',
              ]}
            />
            <Note>
              파기 또는 식별정보 대체가 끝난 뒤에도 장애 복구용 데이터베이스 백업본에는 최대 7일간
              해당 데이터가 남아 있을 수 있으며, 백업본은 7일이 지나면 자동으로 삭제됩니다. 백업본은
              장애 복구 외의 목적으로는 사용하지 않습니다.
            </Note>
          </Section>

          <Section title="제9조 (만 14세 미만 아동의 개인정보)">
            <p>
              POP-SPOT 은 <strong>만 14세 이상</strong>만 가입할 수 있습니다. 만 14세 미만 아동의
              회원가입은 허용하지 않으며, 만 14세 미만임이 확인되면 즉시 계정을 해지하고 관련
              개인정보를 파기합니다.
            </p>
          </Section>

          <Section title="제10조 (개인정보의 안전성 확보 조치)">
            <Ul
              items={[
                '비밀번호 일방향 암호화 저장 (BCrypt strength 12)',
                '전송 구간 HTTPS 암호화 (TLS 1.2 이상)',
                '접근 권한 최소화 및 로그 관리',
                '외부 공격 방어를 위한 요청 제한 (Rate Limit)',
              ]}
            />
          </Section>

          <Section title="제11조 (쿠키 및 분석 도구)">
            <p>
              로그인 토큰은 브라우저 탭을 닫으면 사라지는 <code>sessionStorage</code>에 저장합니다.
              화면 언어·최근 본 팝업·온보딩 여부 같은 기기 설정과 익명 방문자 ID는
              <code>localStorage</code>에 저장합니다. 외부 영상 연결 동의를 한 경우 그 동의 버전도
              같은 저장소에 기록합니다. 익명 방문자 ID는 90일이 지나면 새 값으로 교체되며, 사용자가
              브라우저 사이트 데이터를 지우면 즉시 삭제됩니다. 광고용 추적 쿠키는 사용하지 않습니다.
              Vercel Web Analytics와 Speed Insights는 쿠키를 사용하지 않으며, 개인을 직접 식별하지
              않는 접속 통계와 페이지 성능 지표를 수집합니다. Sentry는 오류 진단에 사용하며 개인정보
              자동 전송 옵션을 비활성화합니다. 국외 사업자에 대한 내용은 제6조가 함께 적용됩니다.
            </p>
            <Note>
              YouTube 영상은 이용자가 재생에 동의한 뒤에만 연결합니다. 재생 시 Google이 접속 정보와
              영상 요청 정보를 처리할 수 있으며,{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-lime-500"
              >
                Google 개인정보 처리방침
              </a>{' '}
              및{' '}
              <a
                href="https://myaccount.google.com/data-and-privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-lime-500"
              >
                Google 개인정보 관리 화면
              </a>
              에서 처리 내용과 설정을 확인할 수 있습니다.
            </Note>
            <Note>
              Google 캘린더 또는 Kakao 지도 버튼을 누르면 이용자가 선택한 팝업의 이름·일정·장소나
              좌표가 해당 외부 서비스 주소에 포함되어 전송됩니다. iOS용 캘린더 파일은 브라우저에서
              직접 만들어 내려받으며 POP-SPOT 서버나 외부 캘린더로 자동 전송하지 않습니다.
            </Note>
            <ExternalMediaConsentControl />
          </Section>

          <Section title="제12조 (개인정보 보호책임자)">
            <div className="rounded-md border border-lime-400/40 bg-lime-300/10 p-4 my-3">
              <p className="font-bold text-foreground mb-2">개인정보 보호책임자 (DPO)</p>
              <Ul
                items={[
                  `성명 — ${DPO_NAME}`,
                  '직책 — POP-SPOT 서비스 운영 책임자',
                  <>
                    대표 연락처 — <ContactLink subject="POP-SPOT 개인정보 문의" />
                  </>,
                  '응답 시간 — 영업일 기준 3일 이내',
                ]}
              />
              <p className="text-xs text-muted-foreground mt-2">
                개인정보 처리 관련 문의 · 불만 · 권리 행사 요청은 위 연락처로 보내주시면 지체 없이
                답변 드립니다.
              </p>
            </div>
            <p className="mt-4">
              <strong>분쟁 조정 기관:</strong>
            </p>
            <Ul
              items={DISPUTE_AGENCIES.map((a) => (
                <>
                  {a.name} —{' '}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-lime-500"
                  >
                    {a.url.replace('https://', '')}
                  </a>{' '}
                  / {a.phone}
                </>
              ))}
            />
          </Section>

          <Section title="제13조 (개정 고지)">
            <p>
              본 처리방침이 변경되면 시행일 7일 전부터 본 페이지 상단에 고지합니다. 중대한 변경 시
              가입된 이메일로 별도 안내합니다.
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
        POP-SPOT 은 개인정보 보호법 제30조에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게
        처리하기 위해 다음 처리방침을 둡니다.
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
              className={ri < table.rows.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
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
    <a href={`mailto:${CONTACT_EMAIL}?subject=${encoded}`} className="underline text-lime-500">
      {CONTACT_EMAIL}
    </a>
  );
}
