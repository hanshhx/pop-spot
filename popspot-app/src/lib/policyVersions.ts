import { apiFetch } from '@/lib/api';

/**
 * 지금 공개된 정책 버전을 <b>서버에서</b> 받아 온다.
 *
 * <p>전에는 이 파일에 '1.2' 를 상수로 박아 두고 가입 요청에 실어 보냈다. 그런데 서버는 자기가 아는
 * 공개 버전과 문자열이 정확히 같지 않으면 가입을 거절한다. 버전이라는 <b>하나의 사실을 두 곳에서
 * 관리</b>한 셈이라, 배포 순서가 어긋나는 순간(백엔드 env 는 1.1 인데 프론트만 1.2 로 나가면)
 * <b>신규 가입이 전부 실패</b>한다. 게다가 그때 뜨는 문구가 "정책이 변경되었습니다" 라 원인을
 * 찾기도 어렵다.
 *
 * <p>진실의 출처를 서버 하나로 모은다. 화면은 서버가 "지금 이게 최신" 이라고 알려 준 값을 그대로
 * 되돌려 보낸다. 서버의 검증은 그대로 살아 있어서, 화면을 열어 둔 사이에 정책이 바뀌면 여전히
 * 걸러진다 — 그게 원래 그 검증이 막으려던 것이다.
 */
export type PolicyVersions = { termsVersion: string; privacyVersion: string };

export async function fetchPolicyVersions(): Promise<PolicyVersions | null> {
  try {
    const res = await apiFetch('/api/v1/terms/status');
    if (!res.ok) return null;
    const data = (await res.json()) as {
      currentTermsVersion?: string;
      currentPrivacyVersion?: string;
    };
    if (!data.currentTermsVersion || !data.currentPrivacyVersion) return null;
    return {
      termsVersion: data.currentTermsVersion,
      privacyVersion: data.currentPrivacyVersion,
    };
  } catch {
    return null;
  }
}
