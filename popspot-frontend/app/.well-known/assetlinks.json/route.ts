/**
 * Android App Links 검증 파일.
 *
 * <p>안드로이드가 이 파일을 읽어 <b>{@code https://popspot.co.kr/app/auth} 를 열 자격이 있는 앱</b>을
 * 정한다. 여기 적힌 서명 지문과 같은 키로 서명된 앱만 그 링크를 받는다 — 커스텀 스킴
 * ({@code popspot://})과 달리 <b>다른 앱이 가로챌 수 없다.</b> 소셜 로그인의 1회성 교환 코드가
 * 그 링크로 돌아오므로, 이 파일이 곧 그 코드의 자물쇠다.
 *
 * <h3>왜 정적 파일이 아니라 라우트인가</h3>
 *
 * <p>지문이 <b>둘</b> 필요하고, 그중 하나는 아직 존재하지 않는다.
 *
 * <ul>
 *   <li><b>업로드 키</b> — EAS 가 만든 키스토어. 지금 폰에 깔린 개발/preview 빌드가 이걸로 서명된다.
 *   <li><b>Play 앱 서명 키</b> — Play Console 에 처음 올린 <b>뒤에</b> 구글이 만든다. 스토어에서 받은
 *       앱은 이 키로 서명돼 있으므로, 이게 없으면 <b>스토어 사용자만</b> 링크가 안 열린다.
 * </ul>
 *
 * <p>정적 파일로 두면 두 번째 지문을 채우려고 배포를 다시 해야 한다. 환경변수로 읽으면 Play Console
 * 에서 값을 확인한 뒤 Vercel 변수만 고치면 된다 — 코드 배포 없이.
 *
 * <p>{@code ANDROID_CERT_FINGERPRINTS} 에 쉼표로 여러 개를 넣는다. 비어 있으면 아래 기본값(현재
 * EAS 키스토어)만 나간다.
 */

export const dynamic = 'force-dynamic';

/**
 * 지금 EAS 키스토어의 SHA-256.
 *
 * <p>2026-08-30 에 폰에 설치된 개발 빌드({@code kr.co.popspot})의 APK 서명 블록에서 직접 뽑았다.
 * 이 값이 바뀌는 경우는 하나뿐이다 — 키스토어를 새로 만들 때. 그때는 <b>기존 설치본이 업데이트를
 * 못 받으므로</b> 애초에 하면 안 되는 일이고, 그래서 여기 박아 두어도 안전하다.
 */
const EAS_UPLOAD_KEY_SHA256 =
  '38:28:CA:98:DF:58:64:28:11:67:26:E2:88:CC:45:58:C5:44:5C:5C:5A:47:8A:F9:63:63:D5:5D:B4:A5:EF:21';

/** 앱 패키지명. {@code popspot-app/app.json} 의 {@code android.package} 와 같아야 한다. */
const PACKAGE_NAME = 'kr.co.popspot';

/** {@code AA:BB:...} 모양만 통과시킨다 — 환경변수에 잘못 붙여넣은 값이 조용히 나가지 않게. */
const FINGERPRINT_SHAPE = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fingerprints(): string[] {
  const extra = (process.env.ANDROID_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter((v) => FINGERPRINT_SHAPE.test(v));
  /* 중복은 지운다 — 같은 지문이 두 번 있으면 안드로이드가 파일을 거부하지는 않지만, 값이 어디서
     왔는지 읽는 사람이 헷갈린다. */
  return [...new Set([EAS_UPLOAD_KEY_SHA256, ...extra])];
}

export async function GET(): Promise<Response> {
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints(),
      },
    },
  ];

  return Response.json(body, {
    headers: {
      /* 안드로이드가 설치 직후 한 번 읽고 그 뒤로도 주기적으로 확인한다. 오래 캐시하면 Play 지문을
         추가했을 때 반영이 늦어지므로 짧게 둔다. */
      'Cache-Control': 'public, max-age=300',
      /* 규격이 요구하는 타입. text/plain 으로 나가면 검증이 조용히 실패한다. */
      'Content-Type': 'application/json',
    },
  });
}
