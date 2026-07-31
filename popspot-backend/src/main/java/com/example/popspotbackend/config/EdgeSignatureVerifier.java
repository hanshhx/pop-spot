package com.example.popspotbackend.config;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 프론트(Vercel)를 거쳐 온 요청인지 <b>암호학적으로</b> 확인하고, 그 안에 담긴 접속자 IP를 꺼낸다.
 *
 * <p><b>왜 필요한가.</b> 레이트리밋은 "IP 하나당 몇 회" 로 세는데, 그 IP를 클라이언트가 보낸 헤더에서 읽으면 헤더만 바꿔 무한히 새 바구니를 만들 수 있다.
 * v2.41 감사에서 실증됐다 — 429 를 받은 직후 {@code X-Real-IP} 한 줄만 바꾸면 그대로 통과한다. 그렇다고 헤더를 아예 안 믿으면({@code
 * app.trust-proxy-headers=false}) 백엔드가 보는 주소는 Tailscale Funnel 내부 주소 하나뿐이라 <b>전 사용자가 바구니 하나를
 * 공유</b>해서 인증메일(시간당 5회)이 사실상 막힌다. 즉 믿어도 뚫리고 안 믿어도 망가진다.
 *
 * <p><b>해결.</b> 신뢰 여부를 헤더 <i>이름</i>이 아니라 <b>증명</b>으로 판단한다. Vercel 가장자리는 클라이언트가 보낸 IP 헤더를 버리고 진짜 접속
 * IP로 덮어쓴다(공식 문서: "we currently overwrite the X-Forwarded-For header and do not forward external
 * IPs. This restriction is in place to prevent IP spoofing"). 그 값에 양쪽만 아는 비밀키로 HMAC 서명을 붙여 보내면, 서명이
 * 맞는 요청의 IP만 믿을 수 있다. 비밀키가 없는 공격자는 임의의 IP에 대한 서명을 만들 수 없다.
 *
 * <p><b>서명이 없거나 틀리면 막지 않고 강등한다.</b> {@code remoteAddr} 로 떨어뜨린다. 차단(403)하지 않는 이유는 Vercel 을 거치지 않는 정상
 * 호출이 실재하기 때문이다 — 서버에서 직접 때리는 관리자 curl(번역 백필 등), 헬스체크. 강등의 부수 효과가 오히려 방어가 된다: Funnel 주소를 직접 때리는
 * 공격자들은 <b>전원이 바구니 하나</b>를 나눠 쓰게 되어 합쳐서 한도를 넘긴다.
 *
 * <p><b>비밀키가 비어 있으면 이 클래스는 통째로 비활성</b>이고 기존 동작이 그대로 유지된다. 배포와 활성화를 분리하기 위해서다 — 코드를 먼저 올려 아무것도 바뀌지
 * 않는 것을 확인한 뒤, 양쪽 환경변수를 채워 켠다. 되돌릴 때도 키만 지우면 된다.
 */
@Slf4j
@Component
public class EdgeSignatureVerifier {

    /** 프론트의 {@code proxy.ts} 가 붙이는 헤더. 이름을 바꾸면 양쪽을 같이 고쳐야 한다. */
    static final String HEADER_IP = "X-Edge-Ip";

    static final String HEADER_TS = "X-Edge-Ts";
    static final String HEADER_SIG = "X-Edge-Sig";

    /**
     * 프론트가 쓰는 비밀키의 <b>지문</b>. 키 자체가 아니라 SHA-256 앞 12자리라 값이 새어도 키를 복원할 수 없다.
     *
     * <p>이게 없으면 검증 실패의 원인을 로그만 보고는 가릴 수 없다 — "키가 다르다" 와 "키는 같은데 서명 방식이 어긋났다" 는 완전히 다른 문제인데 증상이 똑같기
     * 때문이다. 실제로 이걸 구분하지 못해 운영에서 두 시간을 썼다.
     */
    static final String HEADER_KID = "X-Edge-Kid";

    private static final String ALGORITHM = "HmacSHA256";

    /**
     * 서명 유효 시간.
     *
     * <p>서명이 영구적이면 한 번 받아 둔 값을 계속 재사용할 수 있다. 공격자가 자기 IP의 서명을 받으려면 어차피 그 IP로 접속해야 하므로 이득이 크진 않지만,
     * 서명이 어딘가(로그·프록시)에 남았을 때의 재사용을 막아 둔다.
     *
     * <p>10분은 <b>일부러 넉넉하게</b> 잡았다. 짧게 잡으면 Vercel 과 이 서버의 시계가 조금만 어긋나도 전 요청의 서명이 만료로 판정돼 모두 {@code
     * remoteAddr} 로 강등된다 — 즉 전 사용자가 바구니 하나를 공유하는 상태로 떨어진다. 보안상 얻는 것보다 잃는 게 크다.
     */
    private static final long MAX_SKEW_MS = Duration.ofMinutes(10).toMillis();

    /** IPv6 최대 표기 길이. 바구니 키에 비정상적으로 긴 값이 들어가지 않게 상한을 둔다. */
    private static final int MAX_IP_LENGTH = 45;

    /** 검증 실패 경고는 분당 한 번만. 공격받는 동안 로그가 디스크를 채우면 안 된다. */
    private static final long WARN_INTERVAL_MS = Duration.ofMinutes(1).toMillis();

    /** 지문 길이(16진수 글자 수). 셸에서 {@code sha256sum | cut -c1-12} 로 낸 값과 같아야 한다. */
    private static final int FINGERPRINT_LENGTH = 12;

    private final byte[] secret;
    private final String keyFingerprint;
    private final AtomicLong lastWarnAt = new AtomicLong(0);

    /**
     * 첫 성공을 한 번만 알리기 위한 표시.
     *
     * <p>성공이 아무 흔적도 남기지 않으면 운영자는 <b>"경고가 없다"</b> 로만 정상을 판단하게 되는데, 그건 트래픽이 아예 없을 때와 구분이 안 된다. 실제로 켜고
     * 나서 이게 없어 확신을 못 했다.
     */
    private final AtomicBoolean firstSuccessLogged = new AtomicBoolean(false);

    public EdgeSignatureVerifier(@Value("${app.edge-secret:}") String secret) {
        this.secret =
                (secret == null || secret.isBlank())
                        ? null
                        : secret.trim().getBytes(StandardCharsets.UTF_8);
        this.keyFingerprint = this.secret == null ? null : fingerprint(this.secret);

        if (this.secret == null) {
            log.info("[EdgeSig] 엣지 서명 검증 꺼짐 — app.edge-secret 미설정. 기존 IP 판별 방식을 사용한다.");
        } else {
            log.info(
                    "[EdgeSig] 엣지 서명 검증 켜짐 — 서명된 요청의 IP만 신뢰한다. (키 지문 {} — Vercel 값의"
                            + " sha256sum 앞 12자리와 같아야 한다)",
                    keyFingerprint);
        }
    }

    /**
     * 비밀키의 지문 — 키를 드러내지 않고 양쪽이 같은 키를 쓰는지 대조하기 위한 값.
     *
     * <p>셸에서 {@code printf '%s' "$KEY" | sha256sum | cut -c1-12} 로 낸 값과 일부러 똑같이 맞췄다. 운영자가 Vercel 에
     * 넣은 값을 그 명령으로 찍어 로그와 눈으로 비교할 수 있어야 하기 때문이다.
     */
    static String fingerprint(byte[] secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret);
            StringBuilder hex = new StringBuilder(FINGERPRINT_LENGTH);
            for (int i = 0; hex.length() < FINGERPRINT_LENGTH; i++) {
                hex.append(Character.forDigit((digest[i] >> 4) & 0xF, 16));
                hex.append(Character.forDigit(digest[i] & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 모든 JVM 에 있다. 진단용 값이라 없더라도 검증을 막지는 않는다.
            return "(지문 계산 실패)";
        }
    }

    /** 비밀키가 설정돼 있는가. 꺼져 있으면 호출부는 기존 로직을 그대로 쓴다. */
    public boolean isEnabled() {
        return secret != null;
    }

    /**
     * 서명이 유효하면 그 안의 접속자 IP를, 아니면 {@code null} 을 돌려준다.
     *
     * <p>{@code null} 은 "공격" 이 아니라 "이 요청은 프론트를 거쳤다고 증명하지 못했다" 는 뜻이다. 서버 내부 호출도 여기에 해당한다.
     */
    public String verifiedIp(HttpServletRequest request) {
        if (secret == null) return null;

        String ip = request.getHeader(HEADER_IP);
        String timestamp = request.getHeader(HEADER_TS);
        String signature = request.getHeader(HEADER_SIG);

        // 헤더가 아예 없는 것은 정상적인 경우가 많다(서버 내부 호출). 조용히 넘긴다.
        if (isBlank(ip) || isBlank(timestamp) || isBlank(signature)) return null;

        ip = ip.trim();
        if (ip.length() > MAX_IP_LENGTH) {
            warnThrottled("[EdgeSig] IP 값이 비정상적으로 김 — 무시");
            return null;
        }

        long signedAt;
        try {
            signedAt = Long.parseLong(timestamp.trim());
        } catch (NumberFormatException e) {
            warnThrottled("[EdgeSig] 타임스탬프 형식 오류 — 무시");
            return null;
        }

        if (Math.abs(System.currentTimeMillis() - signedAt) > MAX_SKEW_MS) {
            // 정상 트래픽에서 이게 뜨면 십중팔구 양쪽 시계가 어긋난 것이다(NTP 확인).
            warnThrottled("[EdgeSig] 서명 시각이 허용 범위를 벗어남 — 서버 시계를 확인할 것");
            return null;
        }

        if (!matches(ip, timestamp.trim(), signature.trim())) {
            warnThrottled(diagnoseMismatch(request.getHeader(HEADER_KID)));
            return null;
        }

        if (firstSuccessLogged.compareAndSet(false, true)) {
            log.info("[EdgeSig] 첫 정상 서명 확인 — 검증이 실제로 동작하고 있다. (키 지문 {})", keyFingerprint);
        }
        return ip;
    }

    /**
     * 서명이 안 맞을 때 <b>무엇을 고쳐야 하는지</b>까지 알려준다.
     *
     * <p>원인은 둘 중 하나인데 증상이 같다 — 키가 서로 다르거나, 키는 같은데 서명 만드는 방식이 어긋났거나. 프론트가 보낸 키 지문을 내 것과 대조하면 바로 갈린다.
     * "비밀키를 확인하라" 는 안내만 있으면 이미 맞는 키를 계속 다시 넣어 보게 된다.
     */
    private String diagnoseMismatch(String presentedKid) {
        String theirs = presentedKid == null ? null : presentedKid.trim();

        if (theirs == null || theirs.isEmpty()) {
            return "[EdgeSig] 서명 불일치 — 프론트/백엔드 비밀키가 같은지 확인할 것 (백엔드 키 지문 " + keyFingerprint + ")";
        }
        if (!theirs.equals(keyFingerprint)) {
            return "[EdgeSig] 비밀키가 서로 다르다 — 백엔드 "
                    + keyFingerprint
                    + " · 프론트 "
                    + theirs
                    + ". 한쪽을 다른 쪽 값으로 맞출 것";
        }
        return "[EdgeSig] 키 지문(" + keyFingerprint + ")은 같은데 서명이 다르다 — 양쪽 서명 방식이 어긋났다. 배포 버전을 확인할 것";
    }

    /** 서명 대조. 값 자체가 비밀은 아니지만, 어디까지 맞았는지 흘리지 않도록 전체 길이를 비교한다. */
    private boolean matches(String ip, String timestamp, String presented) {
        try {
            String expected = hexSignature(secret, ip, timestamp);
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    presented.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            warnThrottled("[EdgeSig] 서명 계산 실패 — " + e);
            return false;
        }
    }

    /**
     * 서명 계산 — <b>프론트 {@code proxy.ts} 와 글자 하나까지 같아야 한다.</b>
     *
     * <p>서명 대상은 {@code IP + 줄바꿈 + 밀리초타임스탬프}, 알고리즘은 HMAC-SHA256, 표기는 소문자 16진수다. 한쪽만 바꾸면 모든 검증이 실패하고
     * 전 요청이 {@code remoteAddr} 로 강등된다 — 즉 조용히 망가진다. 그래서 테스트에서 <b>실제 프론트가 만든 값</b>을 기준값으로 대조한다.
     */
    static String hexSignature(byte[] secret, String ip, String timestamp)
            throws GeneralSecurityException {
        Mac mac = Mac.getInstance(ALGORITHM);
        mac.init(new SecretKeySpec(secret, ALGORITHM));
        byte[] raw = mac.doFinal((ip + "\n" + timestamp).getBytes(StandardCharsets.UTF_8));

        StringBuilder hex = new StringBuilder(raw.length * 2);
        for (byte b : raw) {
            hex.append(Character.forDigit((b >> 4) & 0xF, 16));
            hex.append(Character.forDigit(b & 0xF, 16));
        }
        return hex.toString();
    }

    private void warnThrottled(String message) {
        long now = System.currentTimeMillis();
        long previous = lastWarnAt.get();
        if (now - previous >= WARN_INTERVAL_MS && lastWarnAt.compareAndSet(previous, now)) {
            log.warn("{} (이 경고는 분당 한 번만 남는다)", message);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
