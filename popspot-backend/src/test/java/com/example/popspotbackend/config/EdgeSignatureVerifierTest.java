package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 엣지 서명 검증 — <b>위조된 IP를 걸러내고 진짜만 통과시키는지</b> 확인한다.
 *
 * <p>이 검증이 뚫리면 레이트리밋 전체가 무력해진다. 반대로 이 검증이 <b>지나치게</b> 막으면 전 사용자가 버킷 하나를 공유해 인증메일이 막힌다. 양쪽 다 화면으로는 안
 * 보이는 고장이라 테스트로 고정한다.
 */
class EdgeSignatureVerifierTest {

    private static final String SECRET = "test-secret-123";

    /**
     * <b>실제로 돌아가는 {@code proxy.ts} 가 만들어 낸 값</b>이다.
     *
     * <p>Next dev 를 띄우고 요청을 흘려서 백엔드 자리에 도착한 헤더를 그대로 받아 적었다. 손으로 계산한 값이 아니라 프론트가 쓰는 Web Crypto 구현이 낸
     * 값이므로, 이 대조가 통과하면 <b>JS 와 Java 두 구현이 실제로 같은 서명을 만든다</b>는 뜻이다.
     *
     * <p>서명 방식(구분자·인코딩·알고리즘)을 한쪽만 바꾸면 여기서 깨진다. 그게 이 상수의 존재 이유다 — 안 그러면 배포 후 모든 검증이 조용히 실패하고, 증상은
     * "왜인지 레이트리밋이 전 사용자에게 같이 걸림" 으로만 나타난다.
     */
    private static final String PROXY_IP = "203.0.113.77";

    private static final String PROXY_TIMESTAMP = "1785460374973";
    private static final String PROXY_SIGNATURE =
            "4692ed3706bda7f5296f8cfc444b4d5488ab822c5010003fffc90fdbac3d2c47";

    private static HttpServletRequest request(String ip, String timestamp, String signature) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader(EdgeSignatureVerifier.HEADER_IP)).thenReturn(ip);
        when(request.getHeader(EdgeSignatureVerifier.HEADER_TS)).thenReturn(timestamp);
        when(request.getHeader(EdgeSignatureVerifier.HEADER_SIG)).thenReturn(signature);
        return request;
    }

    /** 지금 시각으로 정상 서명된 요청. */
    private static HttpServletRequest signedNow(String secret, String ip) throws Exception {
        String timestamp = Long.toString(System.currentTimeMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                        secret.getBytes(StandardCharsets.UTF_8), ip, timestamp);
        return request(ip, timestamp, signature);
    }

    @Test
    @DisplayName("프론트(proxy.ts)가 만든 서명과 글자 하나까지 같다 — 두 언어 구현 대조")
    void matchesSignatureProducedByFrontend() throws Exception {
        String computed =
                EdgeSignatureVerifier.hexSignature(
                        SECRET.getBytes(StandardCharsets.UTF_8), PROXY_IP, PROXY_TIMESTAMP);

        assertThat(computed)
                .describedAs("proxy.ts 의 서명 방식이 바뀌었거나 백엔드 계산이 어긋났다")
                .isEqualTo(PROXY_SIGNATURE);
    }

    @Test
    @DisplayName("정상 서명이면 그 IP를 돌려준다")
    void acceptsValidSignature() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);

        assertThat(verifier.verifiedIp(signedNow(SECRET, "1.2.3.4"))).isEqualTo("1.2.3.4");
    }

    @Test
    @DisplayName("비밀키가 다르면 거부한다 — 공격자는 서명을 만들 수 없다")
    void rejectsSignatureFromDifferentSecret() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);

        assertThat(verifier.verifiedIp(signedNow("attacker-guessed-secret", "1.2.3.4"))).isNull();
    }

    @Test
    @DisplayName("서명은 그대로 두고 IP만 바꾸면 거부한다 — 핵심 방어")
    void rejectsTamperedIp() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);
        String timestamp = Long.toString(System.currentTimeMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                        SECRET.getBytes(StandardCharsets.UTF_8), "1.2.3.4", timestamp);

        // 429 를 받고 IP만 갈아 끼우는 바로 그 동작.
        assertThat(verifier.verifiedIp(request("5.6.7.8", timestamp, signature))).isNull();
    }

    @Test
    @DisplayName("오래된 서명은 거부한다 — 주워 온 서명 재사용 차단")
    void rejectsStaleSignature() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);
        String old = Long.toString(System.currentTimeMillis() - Duration.ofMinutes(11).toMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                        SECRET.getBytes(StandardCharsets.UTF_8), "1.2.3.4", old);

        assertThat(verifier.verifiedIp(request("1.2.3.4", old, signature))).isNull();
    }

    @Test
    @DisplayName("시계가 조금 앞서도 통과한다 — 좁게 잡으면 전원이 버킷 하나로 뭉친다")
    void toleratesModestClockSkew() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);
        String future =
                Long.toString(System.currentTimeMillis() + Duration.ofMinutes(2).toMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                        SECRET.getBytes(StandardCharsets.UTF_8), "1.2.3.4", future);

        assertThat(verifier.verifiedIp(request("1.2.3.4", future, signature))).isEqualTo("1.2.3.4");
    }

    @Test
    @DisplayName("헤더가 없거나 망가져도 예외 없이 null — 서버 내부 호출을 죽이면 안 된다")
    void returnsNullForMissingOrMalformedHeaders() {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);

        assertThat(verifier.verifiedIp(request(null, null, null))).isNull();
        assertThat(verifier.verifiedIp(request("1.2.3.4", null, "abc"))).isNull();
        assertThat(verifier.verifiedIp(request("1.2.3.4", "not-a-number", "abc"))).isNull();
        assertThat(verifier.verifiedIp(request("1.2.3.4", "1", ""))).isNull();
        assertThat(verifier.verifiedIp(request("", "1", "abc"))).isNull();
    }

    @Test
    @DisplayName("비정상적으로 긴 IP는 거부한다 — 버킷 키 오염 방지")
    void rejectsOverlongIp() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);
        String longIp = "1".repeat(200);

        assertThat(verifier.verifiedIp(signedNow(SECRET, longIp))).isNull();
    }

    @Test
    @DisplayName("비밀키를 안 넣으면 통째로 꺼진다 — 배포와 활성화를 분리하기 위한 조건")
    void disabledWithoutSecret() throws Exception {
        for (String unset : new String[] {null, "", "   "}) {
            EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(unset);

            assertThat(verifier.isEnabled()).isFalse();
            // 서명이 유효하더라도 꺼져 있으면 쓰지 않는다(호출부가 기존 로직으로 간다).
            assertThat(verifier.verifiedIp(signedNow(SECRET, "1.2.3.4"))).isNull();
        }
    }

    @Test
    @DisplayName("대문자 16진수도 받아들인다 — 표기 차이로 전면 실패하지 않게")
    void acceptsUppercaseHex() throws Exception {
        EdgeSignatureVerifier verifier = new EdgeSignatureVerifier(SECRET);
        String timestamp = Long.toString(System.currentTimeMillis());
        String signature =
                EdgeSignatureVerifier.hexSignature(
                                SECRET.getBytes(StandardCharsets.UTF_8), "1.2.3.4", timestamp)
                        .toUpperCase(java.util.Locale.ROOT);

        assertThat(verifier.verifiedIp(request("1.2.3.4", timestamp, signature)))
                .isEqualTo("1.2.3.4");
    }
}
