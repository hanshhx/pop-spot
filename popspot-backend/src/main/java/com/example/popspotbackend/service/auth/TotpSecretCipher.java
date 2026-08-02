package com.example.popspotbackend.service.auth;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * TOTP 비밀키를 DB 에 넣기 전에 암호화한다 — AES-256-GCM.
 *
 * <p><b>왜 암호화하나.</b> 평문으로 두면 DB 를 통째로 가져간 사람이 6자리 코드를 마음대로 만들 수 있다. 그러면 2단계 인증이 사실상 1단계로 내려앉는다 —
 * 비밀번호 해시도 같은 DB 에 있으니까. 키를 DB 밖(환경변수)에 두면 DB 만 새어도 코드를 만들 수 없다.
 *
 * <p><b>왜 TokenEncryption 을 재사용하지 않나.</b> 그쪽은 {@code spotify.token.encryption-key} 에 묶여 있다. 재사용하면
 * 스포티파이 키를 바꾸는 순간 관리자 TOTP 가 함께 깨져 <b>로그인 자체가 막힌다.</b> 용도가 다른 비밀은 키도 따로 두는 것이 맞다. 코드가 비슷해 보이지만 결합을
 * 만들지 않기 위한 의도적인 분리다.
 *
 * <p><b>키가 없으면 거부한다.</b> 평문 저장으로 조용히 물러나면 암호화한다고 믿는 상태로 운영된다. 등록 시점에 명확히 실패하는 편이 낫다.
 */
@Slf4j
@Component
public class TotpSecretCipher {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;
    private static final int REQUIRED_KEY_BYTES = 32;

    private final SecureRandom random = new SecureRandom();
    private final byte[] key;

    public TotpSecretCipher(@Value("${app.totp.encryption-key:}") String base64Key) {
        this.key = decodeKey(base64Key);
        if (key == null) {
            log.info("[TOTP] app.totp.encryption-key 미설정 — 2단계 인증 등록이 비활성 상태입니다.");
        }
    }

    /** 키가 준비돼 있는가. 거짓이면 TOTP 등록을 시작할 수 없다. */
    public boolean isReady() {
        return key != null;
    }

    /**
     * 암호화. nonce 를 앞에 붙여 한 문자열로 만든다.
     *
     * <p>nonce 는 매번 새로 만든다. 같은 nonce 로 두 번 암호화하면 GCM 은 평문을 복원할 수 있는 형태로 무너진다 — 여기서는 사용자마다 한 번씩만
     * 쓰지만, 재등록이 있으므로 고정하면 안 된다.
     */
    public String encrypt(byte[] plain) {
        requireKey();
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, ALGORITHM),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] encrypted = cipher.doFinal(plain);

            byte[] combined = new byte[nonce.length + encrypted.length];
            System.arraycopy(nonce, 0, combined, 0, nonce.length);
            System.arraycopy(encrypted, 0, combined, nonce.length, encrypted.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("TOTP 비밀키 암호화 실패", e);
        }
    }

    /**
     * 복호화. 값이 손상됐거나 키가 바뀌었으면 {@code null} 을 돌려준다.
     *
     * <p>예외를 올리지 않는 이유: 이 상황에서 할 수 있는 일은 "이 사용자는 TOTP 를 못 쓴다" 로 처리하는 것뿐이고, 로그인 경로에서 500 을 내면 원인을 알
     * 수 없는 장애가 된다. 호출부가 null 을 보고 판단하게 한다.
     */
    public byte[] decrypt(String stored) {
        if (key == null || stored == null || stored.isBlank()) return null;
        try {
            byte[] combined = Base64.getDecoder().decode(stored);
            if (combined.length <= NONCE_BYTES) return null;

            byte[] nonce = new byte[NONCE_BYTES];
            System.arraycopy(combined, 0, nonce, 0, NONCE_BYTES);
            byte[] encrypted = new byte[combined.length - NONCE_BYTES];
            System.arraycopy(combined, NONCE_BYTES, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, ALGORITHM),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce));
            return cipher.doFinal(encrypted);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // 키를 바꿨거나 값이 변조됐다. 어느 쪽이든 이 비밀키는 못 쓴다.
            log.warn("[TOTP] 비밀키 복호화 실패 — {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new IllegalStateException(
                    "app.totp.encryption-key 가 설정되지 않아 2단계 인증을 등록할 수 없습니다. "
                            + "openssl rand -base64 32 로 만들어 환경변수에 넣으세요.");
        }
    }

    private byte[] decodeKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) return null;
        try {
            byte[] decoded = Base64.getDecoder().decode(base64Key.trim());
            if (decoded.length != REQUIRED_KEY_BYTES) {
                log.error(
                        "[TOTP] 암호화 키 길이가 {}바이트입니다. AES-256 은 {}바이트가 필요합니다 —"
                                + " 2단계 인증을 비활성 상태로 둡니다.",
                        decoded.length,
                        REQUIRED_KEY_BYTES);
                return null;
            }
            return decoded;
        } catch (IllegalArgumentException e) {
            log.error("[TOTP] 암호화 키가 Base64 형식이 아닙니다 — 2단계 인증을 비활성 상태로 둡니다.");
            return null;
        }
    }
}
