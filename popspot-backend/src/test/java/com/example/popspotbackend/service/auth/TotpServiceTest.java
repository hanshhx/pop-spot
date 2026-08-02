package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * TOTP 구현이 <b>표준과 정확히 같은 코드를 내는지</b> 확인한다.
 *
 * <p>직접 구현한 암호 코드라 "돌아가는 것처럼 보이는" 것으로는 부족하다. 자릿수만 맞으면 화면에서는 정상으로 보이고, 정작 사용자의 인증 앱과 안 맞아 <b>아무도 로그인
 * 못 하는</b> 상태가 된다.
 *
 * <p>그래서 <a href="https://datatracker.ietf.org/doc/html/rfc6238#appendix-B">RFC 6238 부록 B</a> 의 공식
 * 시험값을 그대로 쓴다. 이게 맞으면 구글 OTP·Authy 등 어떤 앱과도 맞는다.
 */
class TotpServiceTest {

    private final TotpService totp = new TotpService();

    /** RFC 6238 시험용 비밀키 — ASCII "12345678901234567890". */
    private static final byte[] RFC_SECRET =
            "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    private static final int STEP = 30;

    @Test
    @DisplayName("RFC 6238 공식 시험값과 일치한다 — 이게 틀리면 어떤 인증 앱과도 안 맞는다")
    void matchesRfcTestVectors() {
        // RFC 는 8자리로 적혀 있다. 우리는 6자리를 쓰므로 뒤 6자리를 기대값으로 둔다.
        assertThat(totp.generate(RFC_SECRET, 59L / STEP)).isEqualTo("287082");
        assertThat(totp.generate(RFC_SECRET, 1111111109L / STEP)).isEqualTo("081804");
        assertThat(totp.generate(RFC_SECRET, 1111111111L / STEP)).isEqualTo("050471");
        assertThat(totp.generate(RFC_SECRET, 1234567890L / STEP)).isEqualTo("005924");
        assertThat(totp.generate(RFC_SECRET, 2000000000L / STEP)).isEqualTo("279037");
        assertThat(totp.generate(RFC_SECRET, 20000000000L / STEP)).isEqualTo("353130");
    }

    @Test
    @DisplayName("지금 시각의 코드는 통과한다")
    void acceptsCurrentCode() {
        long now = 1234567890L;
        String code = totp.generate(RFC_SECRET, now / STEP);

        assertThat(totp.verify(RFC_SECRET, code, now)).isTrue();
    }

    @Test
    @DisplayName("앞뒤 한 창(±30초)은 허용한다 — 폰과 서버 시계가 조금 어긋나도 로그인은 돼야 한다")
    void allowsOneStepDrift() {
        long now = 1234567890L;

        assertThat(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now / STEP - 1), now))
                .isTrue();
        assertThat(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now / STEP + 1), now))
                .isTrue();
    }

    @Test
    @DisplayName("두 창을 넘어가면 거부한다 — 훔친 코드의 수명이 길어지면 안 된다")
    void rejectsTwoStepDrift() {
        long now = 1234567890L;

        assertThat(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now / STEP - 2), now))
                .isFalse();
        assertThat(totp.verify(RFC_SECRET, totp.generate(RFC_SECRET, now / STEP + 2), now))
                .isFalse();
    }

    @Test
    @DisplayName("틀린 코드·빈 값·자릿수 안 맞는 값은 거부한다")
    void rejectsBadInput() {
        long now = 1234567890L;

        assertThat(totp.verify(RFC_SECRET, "000000", now)).isFalse();
        assertThat(totp.verify(RFC_SECRET, "", now)).isFalse();
        assertThat(totp.verify(RFC_SECRET, null, now)).isFalse();
        assertThat(totp.verify(RFC_SECRET, "12345", now)).describedAs("5자리").isFalse();
        assertThat(totp.verify(RFC_SECRET, "1234567", now)).describedAs("7자리").isFalse();
        assertThat(totp.verify(null, "123456", now)).isFalse();
        assertThat(totp.verify(new byte[0], "123456", now)).isFalse();
    }

    @Test
    @DisplayName("앞뒤 공백은 봐준다 — 복사해 붙이면 공백이 딸려 온다")
    void trimsWhitespace() {
        long now = 1234567890L;
        String code = totp.generate(RFC_SECRET, now / STEP);

        assertThat(totp.verify(RFC_SECRET, "  " + code + " ", now)).isTrue();
    }

    @Test
    @DisplayName("Base32 가 RFC 4648 과 같다 — 인증 앱은 이 표기만 읽는다")
    void base32MatchesRfc4648() {
        // RFC 4648 §10 시험값.
        assertThat(totp.toBase32("".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(totp.toBase32("f".getBytes(StandardCharsets.US_ASCII))).isEqualTo("MY");
        assertThat(totp.toBase32("fo".getBytes(StandardCharsets.US_ASCII))).isEqualTo("MZXQ");
        assertThat(totp.toBase32("foo".getBytes(StandardCharsets.US_ASCII))).isEqualTo("MZXW6");
        assertThat(totp.toBase32("foob".getBytes(StandardCharsets.US_ASCII))).isEqualTo("MZXW6YQ");
        assertThat(totp.toBase32("fooba".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("MZXW6YTB");
        assertThat(totp.toBase32("foobar".getBytes(StandardCharsets.US_ASCII)))
                .isEqualTo("MZXW6YTBOI");
    }

    @Test
    @DisplayName("QR 주소에 필요한 값이 다 들어간다")
    void otpauthUriIsComplete() {
        String uri = totp.otpauthUri("POP-SPOT", "admin@popspot.co.kr", RFC_SECRET);

        assertThat(uri)
                .startsWith("otpauth://totp/")
                .contains("secret=" + totp.toBase32(RFC_SECRET))
                .contains("issuer=POP-SPOT")
                .contains("digits=6")
                .contains("period=30");
        // 이메일의 @ 가 그대로 들어가면 URI 가 깨진다.
        assertThat(uri).doesNotContain("admin@popspot.co.kr");
    }

    @Test
    @DisplayName("비밀키는 매번 다르고 20바이트다")
    void secretsAreRandomAndCorrectLength() {
        byte[] a = totp.generateSecret();
        byte[] b = totp.generateSecret();

        assertThat(a).hasSize(20);
        assertThat(a).isNotEqualTo(b);
    }
}
