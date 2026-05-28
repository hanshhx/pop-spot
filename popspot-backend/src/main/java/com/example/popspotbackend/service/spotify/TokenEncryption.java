package com.example.popspotbackend.service.spotify;

import jakarta.annotation.PostConstruct;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * v2.21-S10 — Spotify access/refresh token AES-256 GCM 암호화.
 *
 * <p>Spotify Developer Policy + PIPA 모두 토큰을 평문 저장 금지. 키가 DB 와 분리돼 있어야 하므로
 * {@code spotify.token.encryption-key} 환경변수에서만 가져온다 (소스 / .properties 기본값에 박지 않음).
 *
 * <p>GCM 모드: 인증된 암호화 (변조 감지). nonce 는 매 암호화마다 새로 생성하여 ciphertext 앞에 prepend.
 * 해독 시 앞 12바이트 = nonce, 나머지 = 암호문 + tag.
 *
 * <p>키 분실 = 저장된 모든 토큰 무효. 사용자는 Spotify 재연결 필요.
 */
@Slf4j
@Component
public class TokenEncryption {

    private static final String ALGORITHM = "AES";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_LENGTH = 12;
    private static final int REQUIRED_KEY_BYTES = 32; // AES-256

    @Value("${spotify.token.encryption-key:}")
    private String encryptionKeyBase64;

    private SecretKeySpec keySpec;
    private final SecureRandom random = new SecureRandom();

    @PostConstruct
    void init() {
        if (encryptionKeyBase64 == null || encryptionKeyBase64.isBlank()) {
            log.warn(
                    "[TokenEncryption] spotify.token.encryption-key 미설정 — Spotify OAuth 기능 비활성."
                            + " 운영 환경에서는 반드시 32바이트 키 Base64 (예: openssl rand -base64 32) 를 환경변수로 주입.");
            return;
        }
        byte[] keyBytes = Base64.getDecoder().decode(encryptionKeyBase64);
        if (keyBytes.length != REQUIRED_KEY_BYTES) {
            throw new IllegalStateException(
                    "spotify.token.encryption-key 는 정확히 32바이트 (AES-256) 여야 함. 현재: "
                            + keyBytes.length
                            + " bytes");
        }
        keySpec = new SecretKeySpec(keyBytes, ALGORITHM);
        log.info("[TokenEncryption] AES-256 GCM 키 로드 완료");
    }

    /** 활성 여부 — Controller / Service 에서 키 미설정 시 503 반환 판단용. */
    public boolean isEnabled() {
        return keySpec != null;
    }

    /** 평문 → Base64(nonce ‖ ciphertext+tag). */
    public String encrypt(String plain) {
        ensureEnabled();
        try {
            byte[] nonce = new byte[NONCE_LENGTH];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(plain.getBytes("UTF-8"));
            byte[] out = new byte[nonce.length + ciphertext.length];
            System.arraycopy(nonce, 0, out, 0, nonce.length);
            System.arraycopy(ciphertext, 0, out, nonce.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("토큰 암호화 실패", e);
        }
    }

    /** Base64(nonce ‖ ciphertext+tag) → 평문. */
    public String decrypt(String encrypted) {
        ensureEnabled();
        try {
            byte[] in = Base64.getDecoder().decode(encrypted);
            byte[] nonce = new byte[NONCE_LENGTH];
            byte[] ciphertext = new byte[in.length - NONCE_LENGTH];
            System.arraycopy(in, 0, nonce, 0, NONCE_LENGTH);
            System.arraycopy(in, NONCE_LENGTH, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_BITS, nonce));
            return new String(cipher.doFinal(ciphertext), "UTF-8");
        } catch (Exception e) {
            throw new IllegalStateException("토큰 해독 실패 (키 불일치 또는 변조)", e);
        }
    }

    private void ensureEnabled() {
        if (!isEnabled()) {
            throw new IllegalStateException(
                    "spotify.token.encryption-key 미설정 — Spotify 기능 사용 불가");
        }
    }
}
