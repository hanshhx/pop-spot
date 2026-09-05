package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.service.AuthService;
import com.example.popspotbackend.service.EmailService;
import com.example.popspotbackend.service.auth.OAuthFlowMetrics;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.ResponseEntity;

/**
 * 소셜 로그인 교환 코드를 <b>요청자에게 묶는다</b>.
 *
 * <p>앱이 만드는 nonce 는 정상 앱이 <b>위조된</b> 콜백을 걸러내는 장치다. 그런데 그 검사는 서버가 아니라 정상 앱이 자기 기기에서 한다 — 그래서 콜백을
 * <b>가로챈</b> 앱은 nonce 검사를 건너뛰고 {@code code} 만 서버에 보내면 됐다. 서버가 code 만 보고 access + refresh 토큰을 내줬기
 * 때문이다.
 *
 * <p>이제 서버가 코드 자체를 시작한 클라이언트에 묶는다(RFC 7636). 판정은 <b>요청이 무엇을 보냈느냐가 아니라 발급된 코드의 속성</b>으로 한다 — 요청 기반이면
 * 공격자는 verifier 필드를 빼기만 하면 된다.
 */
class OAuthCodeBindingTest {

    private StringRedisTemplate redis;
    private AuthController controller;
    private OAuthFlowMetrics metrics;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        metrics = mock(OAuthFlowMetrics.class);
        controller =
                new AuthController(
                        mock(AuthService.class), mock(EmailService.class), redis, metrics);
    }

    private void luaReturns(String result) {
        when(redis.execute(any(RedisScript.class), anyList(), any())).thenReturn(result);
    }

    private ResponseEntity<?> exchange(String code, String verifier) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("code", code);
        if (verifier != null) body.put("code_verifier", verifier);
        return controller.exchangeOAuthCode(body);
    }

    /* ==================== S256 변환 ==================== */

    /**
     * RFC 7636 부록 B 의 시험값. 우리 구현이 규격과 같은 값을 내는지 본다 — 여기가 어긋나면 정상 클라이언트가 만든 verifier 가 전부 불일치로 떨어진다.
     */
    @Test
    @DisplayName("S256 은 RFC 7636 시험값과 같은 결과를 낸다")
    void s256MatchesRfcVector() {
        String verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

        assertThat(AuthController.sha256Base64Url(verifier))
                .isEqualTo("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    /** 패딩이 붙으면 저장된 챌린지와 글자수가 달라져 영원히 불일치한다. */
    @Test
    @DisplayName("S256 결과에 base64 패딩이 붙지 않는다")
    void s256HasNoPadding() {
        assertThat(AuthController.sha256Base64Url("a".repeat(43))).doesNotContain("=");
    }

    /* ==================== verifier 형식 ==================== */

    @Test
    @DisplayName("RFC 7636 의 unreserved 43~128자만 verifier 로 받는다")
    void verifierShape() {
        assertThat(AuthController.isWellFormedVerifier("a".repeat(43))).isTrue();
        assertThat(AuthController.isWellFormedVerifier("a".repeat(128))).isTrue();
        assertThat(AuthController.isWellFormedVerifier("aA0-._~".repeat(7))).isTrue();

        assertThat(AuthController.isWellFormedVerifier("a".repeat(42))).isFalse();
        assertThat(AuthController.isWellFormedVerifier("a".repeat(129))).isFalse();
        // 짧은 verifier 는 대입으로 맞힐 수 있어 규격이 43자를 하한으로 둔다.
        assertThat(AuthController.isWellFormedVerifier("short")).isFalse();
        // base64url 이 아닌 문자는 규격 밖이다.
        assertThat(AuthController.isWellFormedVerifier("a".repeat(42) + "!")).isFalse();
    }

    /* ==================== 교환 판정 ==================== */

    /**
     * 이 검사가 이 변경의 핵심이다. 저장된 코드가 묶여 있으면 서버는 verifier 를 요구하고, 맞지 않으면 거부한다 — 스크립트가 그렇게 답했을 때 우리가 토큰을
     * 내주지 않는지 본다.
     */
    @Test
    @DisplayName("묶인 코드에 verifier 가 맞지 않으면 토큰을 안 준다")
    void boundCodeRejectsWrongVerifier() {
        luaReturns("NEEDV");

        ResponseEntity<?> res = exchange("code-1", "v".repeat(43));

        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    /**
     * 강등 차단. 묶이지 않은 코드에 verifier 가 붙어 오면 거부한다 — 신방식 클라이언트가 구코드를 신방식 응답으로 받아들이는 경로를 막는다(RFC 9700
     * §4.8.2).
     */
    @Test
    @DisplayName("구방식 코드에 verifier 가 붙어 오면 거부한다")
    void legacyCodeRejectsVerifier() {
        luaReturns("NODOWN");

        ResponseEntity<?> res = exchange("code-1", "v".repeat(43));

        assertThat(res.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    @DisplayName("만료·사용된 코드는 401")
    void missingCode() {
        luaReturns("MISS");

        assertThat(exchange("code-1", null).getStatusCode().value()).isEqualTo(401);
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("검증을 통과하면 토큰을 준다")
    void okReturnsTokens() {
        luaReturns("OKB\naccess-token\nrefresh-token");

        ResponseEntity<?> res = exchange("code-1", "v".repeat(43));

        assertThat(res.getStatusCode().value()).isEqualTo(200);
        Map<String, String> body = (Map<String, String>) res.getBody();
        assertThat(body).containsEntry("token", "access-token");
        assertThat(body).containsEntry("refreshToken", "refresh-token");
    }

    /** 2단계 인증이 남은 계정은 토큰 대신 표만 나간다. 묶기 전과 동작이 같아야 한다. */
    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("TOTP 가 남아 있으면 토큰 대신 표를 준다")
    void totpStillChallenges() {
        luaReturns("OKB\nTOTP:challenge-token");

        ResponseEntity<?> res = exchange("code-1", "v".repeat(43));

        Map<String, String> body = (Map<String, String>) res.getBody();
        assertThat(body).containsEntry("totpRequired", "true");
        assertThat(body).containsEntry("challengeToken", "challenge-token");
        assertThat(body).doesNotContainKey("token");
    }

    /** Redis 가 죽었을 때 토큰을 내주면 안 된다. 업로드 한도의 호환 경로가 정확히 이 실수(장애 시 통과)로 열려 있었다. */
    @Test
    @DisplayName("Redis 장애 시 토큰을 내주지 않는다")
    void redisDownDoesNotIssueTokens() {
        when(redis.execute(any(RedisScript.class), anyList(), any()))
                .thenThrow(new IllegalStateException("redis down"));

        ResponseEntity<?> res = exchange("code-1", "v".repeat(43));

        assertThat(res.getStatusCode().value()).isEqualTo(503);
    }

    /** 형식이 틀린 verifier 는 Redis 까지 가기 전에 걸러진다. */
    @Test
    @DisplayName("형식이 틀린 verifier 는 스크립트를 부르지도 않는다")
    void malformedVerifierRejectedEarly() {
        ResponseEntity<?> res = exchange("code-1", "too-short");

        assertThat(res.getStatusCode().value()).isEqualTo(400);
    }

    /* ==================== 스크립트 텍스트 ==================== */

    /**
     * Lua 는 홑따옴표 문자열 안의 <b>실제 개행</b>을 문법 오류로 본다. 그래서 Redis 가 컴파일 단계에서 스크립트를 거부하고, 우리는 원인을 알 수 없는
     * {@code RedisSystemException} 만 보게 된다.
     *
     * <p>2026-09-05 에 실제로 그렇게 나갔다. 이스케이프가 heredoc → 자바 → Lua 로 세 겹인데 한 겹을 잃어 자바가 {@code '\n'} 을 진짜
     * 개행으로 컴파일했다. <b>소스를 읽어서는 안 보인다</b> — 컴파일된 상수를 꺼내 봐야 드러났다.
     *
     * <p>그래서 개행은 {@code string.char(10)} 으로 만든다. 이 검사가 그 규칙을 지킨다.
     */
    @Test
    @DisplayName("Redis 스크립트에 진짜 개행이 들어가지 않는다")
    void scriptsHaveNoRawNewline() {
        assertThat(
                        ((DefaultRedisScript<String>) AuthController.OAUTH_EXCHANGE_SCRIPT)
                                .getScriptAsString())
                .doesNotContain("\n");
        assertThat(((DefaultRedisScript<String>) AuthController.GET_DEL_SCRIPT).getScriptAsString())
                .doesNotContain("\n");
    }

    /**
     * 구방식 교환을 언제 끊을지 정하려면 아직 누가 쓰는지 알아야 한다. 이 계측이 그 재료다.
     *
     * <p>다만 교환 0건이 구방식 사용자 0명은 아니다 — 이미 로그인한 사람은 갱신 토큰으로 계속 쓰고, 공격자가 구방식 호출을 계속 만들면 0 이 안 온다. 실제
     * 종료는 발급 쪽에서 끊는다.
     */
    @Test
    @DisplayName("교환이 어느 가지로 났는지 센다")
    void countsExchangeKind() {
        luaReturns("OKB\naccess\nrefresh");
        exchange("code-1", "v".repeat(43));
        verify(metrics).count(OAuthFlowMetrics.EXCHANGED_BOUND);

        luaReturns("OKL\naccess\nrefresh");
        exchange("code-2", null);
        verify(metrics).count(OAuthFlowMetrics.EXCHANGED_LEGACY);
    }

    /** 알 수 없는 응답에 토큰을 내주면 안 된다. 스크립트를 고치다 규약이 어긋나는 경우다. */
    @Test
    @DisplayName("모르는 스크립트 응답에는 토큰을 안 준다")
    void unknownScriptResultIssuesNothing() {
        luaReturns("WHAT");

        assertThat(exchange("code-1", null).getStatusCode().value()).isEqualTo(500);
    }
}
