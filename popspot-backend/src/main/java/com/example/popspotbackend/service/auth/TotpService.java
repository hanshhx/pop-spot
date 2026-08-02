package com.example.popspotbackend.service.auth;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

/**
 * 인증 앱(구글 OTP 등)이 쓰는 6자리 코드 — RFC 6238 TOTP.
 *
 * <p><b>왜 직접 구현하나.</b> 알고리즘이 짧고(HMAC-SHA1 + 자리 자르기) 명세가 고정돼 있다. 라이브러리를 하나 더 들이면 취약점 스캔 대상과 업데이트 부담이
 * 그만큼 늘어난다. 대신 <b>RFC 의 공식 시험값</b>으로 검증한다 — 그게 맞으면 구글 OTP 와도 맞는다.
 *
 * <p>Base32 도 직접 쓴다. 필요한 것은 인코딩 하나뿐이고, 쓸 수 있는 라이브러리(commons-codec)가 우리가 직접 선언한 의존성이 아니라 전이 의존성이라 언제
 * 사라져도 이상하지 않다.
 *
 * <p>이 클래스는 <b>비밀키를 저장하지 않는다.</b> 만들어 주고 검증만 한다. 보관은 호출부의 몫이다.
 */
@Service
public class TotpService {

    /** RFC 6238 기본값. 인증 앱들이 이 값을 전제로 동작하므로 바꾸면 안 된다. */
    private static final int TIME_STEP_SECONDS = 30;

    private static final int CODE_DIGITS = 6;
    private static final String HMAC_ALGORITHM = "HmacSHA1";

    /**
     * 앞뒤로 허용할 시간 창.
     *
     * <p>1이면 ±30초다. 사용자 폰과 서버 시계가 조금 어긋나거나 코드를 입력하는 사이에 창이 넘어가는 경우를 흡수한다. 넓히면 훔친 코드의 유효 시간이 그만큼
     * 길어지므로 1을 넘기지 않는다.
     */
    private static final int ALLOWED_DRIFT_STEPS = 1;

    /** RFC 4288 권장. 20바이트면 SHA-1 블록에 맞고 인증 앱들이 모두 받아들인다. */
    private static final int SECRET_BYTES = 20;

    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private final SecureRandom random = new SecureRandom();

    /** 새 비밀키. 사용자마다 하나씩 만들어 저장한다. */
    public byte[] generateSecret() {
        byte[] secret = new byte[SECRET_BYTES];
        random.nextBytes(secret);
        return secret;
    }

    /**
     * 인증 앱이 읽는 QR 내용.
     *
     * <p>{@code otpauth://totp/발급자:계정?secret=...&issuer=발급자} 형식이다. 사용자가 QR 을 못 찍을 때를 대비해 {@link
     * #toBase32}) 값을 화면에 함께 보여 주면 손으로 입력할 수 있다.
     */
    public String otpauthUri(String issuer, String account, byte[] secret) {
        String label = encode(issuer) + ":" + encode(account);
        return "otpauth://totp/"
                + label
                + "?secret="
                + toBase32(secret)
                + "&issuer="
                + encode(issuer)
                + "&algorithm=SHA1&digits="
                + CODE_DIGITS
                + "&period="
                + TIME_STEP_SECONDS;
    }

    /**
     * 사용자가 입력한 코드가 맞는지.
     *
     * <p>앞뒤 한 창씩 함께 본다({@link #ALLOWED_DRIFT_STEPS}). 비교는 {@link MessageDigest#isEqual} 로 한다 — 일반
     * 문자열 비교는 앞자리부터 틀린 지점에서 멈춰, 걸린 시간으로 정답을 한 자리씩 알아낼 수 있다.
     */
    public boolean verify(byte[] secret, String code, long epochSeconds) {
        if (secret == null || secret.length == 0 || code == null) return false;

        String trimmed = code.trim();
        if (trimmed.length() != CODE_DIGITS) return false;

        long counter = epochSeconds / TIME_STEP_SECONDS;
        for (int drift = -ALLOWED_DRIFT_STEPS; drift <= ALLOWED_DRIFT_STEPS; drift++) {
            String expected = generate(secret, counter + drift);
            if (MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.US_ASCII),
                    trimmed.getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }
        return false;
    }

    /** 특정 시간 창의 코드. 테스트에서 RFC 시험값과 대조하기 위해 공개한다. */
    public String generate(byte[] secret, long counter) {
        byte[] message = new byte[8];
        for (int i = 7; i >= 0; i--) {
            message[i] = (byte) (counter & 0xFF);
            counter >>>= 8;
        }

        byte[] hash;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            hash = mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("TOTP 계산 실패", e);
        }

        // RFC 4226 동적 절단 — 마지막 바이트의 하위 4비트가 시작 위치를 가리킨다.
        int offset = hash[hash.length - 1] & 0x0F;
        int binary =
                ((hash[offset] & 0x7F) << 24)
                        | ((hash[offset + 1] & 0xFF) << 16)
                        | ((hash[offset + 2] & 0xFF) << 8)
                        | (hash[offset + 3] & 0xFF);

        int otp = binary % (int) Math.pow(10, CODE_DIGITS);
        return String.format("%0" + CODE_DIGITS + "d", otp);
    }

    /**
     * RFC 4648 Base32. 인증 앱이 이 표기만 받아들인다.
     *
     * <p>패딩(=)은 붙이지 않는다 — {@code otpauth} URI 에서는 생략이 관례이고, 붙이면 URL 인코딩이 필요해 손으로 입력할 때 헷갈린다.
     */
    public String toBase32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;

        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(BASE32_ALPHABET.charAt((buffer >> (bitsLeft - 5)) & 0x1F));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            out.append(BASE32_ALPHABET.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }
        return out.toString();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
