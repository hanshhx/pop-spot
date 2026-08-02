package com.example.popspotbackend.service.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 인증 앱을 못 쓸 때 쓰는 일회용 복구 코드.
 *
 * <p><b>이게 없으면 폰을 잃는 순간 영구 잠금이다.</b> 관리자가 한 명뿐이라 "다른 관리자에게 부탁" 같은 우회로도 없다. TOTP 를 켜기 전에 반드시 함께 있어야
 * 한다.
 *
 * <p><b>원문은 발급 때 한 번만 보여 준다.</b> 저장하는 것은 SHA-256 해시뿐이라, 나중에 다시 볼 수 없고 잃어버리면 새로 발급해야 한다.
 *
 * <p><b>왜 BCrypt 가 아니라 SHA-256 인가.</b> 느린 해시는 사람이 고른 저엔트로피 비밀번호를 무차별 대입으로부터 지키기 위한 것이다. 복구 코드는 우리가
 * 만든 50비트 이상 난수라 대입이 애초에 불가능하고, 로그인 한 번에 최대 10개를 대조해야 해서 느린 해시를 쓰면 그 자체가 부하가 된다.
 */
@Service
public class RecoveryCodeService {

    /** 10개면 충분하다. 하나 쓸 때마다 사라지고, 다 쓰면 새로 발급받는다. */
    private static final int CODE_COUNT = 10;

    /** 코드 하나의 글자 수. 알파벳 32자 기준 10자면 50비트로 대입이 불가능하다. */
    private static final int CODE_LENGTH = 10;

    /**
     * 사람이 옮겨 적는 값이라 <b>헷갈리는 글자를 뺀다</b> — 0/O, 1/I/L.
     *
     * <p>급할 때 손으로 입력하는 값이다. 여기서 한 글자 잘못 읽으면 마지막 입구가 막힌다.
     */
    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private static final String SEPARATOR = ",";
    private static final char GROUP_SEPARATOR = '-';

    private final SecureRandom random = new SecureRandom();

    /** 발급 결과 — 사용자에게 보여 줄 원문과, DB 에 넣을 해시 묶음. */
    public record Issued(List<String> plainCodes, String storedHashes) {}

    /** 새 복구 코드 한 벌. 기존 것이 있으면 호출부가 통째로 교체한다. */
    public Issued issue() {
        List<String> plain = new ArrayList<>(CODE_COUNT);
        List<String> hashes = new ArrayList<>(CODE_COUNT);

        for (int i = 0; i < CODE_COUNT; i++) {
            String code = randomCode();
            plain.add(code);
            hashes.add(hash(code));
        }
        return new Issued(plain, String.join(SEPARATOR, hashes));
    }

    /**
     * 입력한 코드가 남아 있는 것 중 하나인가.
     *
     * @return 맞으면 <b>그 코드를 뺀 나머지</b> 해시 묶음, 아니면 {@code null}
     *     <p>쓴 코드를 빼는 것까지 여기서 하는 이유는, 호출부가 "맞았다" 만 받고 지우는 것을 잊으면 같은 코드를 무한히 재사용할 수 있기 때문이다. 검증과 소모를
     *     한 번에 끝낸다.
     */
    public String consume(String storedHashes, String input) {
        if (storedHashes == null || storedHashes.isBlank() || input == null) return null;

        String normalized = normalize(input);
        if (normalized.isEmpty()) return null;

        String target = hash(normalized);
        List<String> remaining = new ArrayList<>();
        boolean matched = false;

        for (String stored : storedHashes.split(SEPARATOR)) {
            String trimmed = stored.trim();
            if (trimmed.isEmpty()) continue;
            // 이미 하나 맞았으면 나머지는 그대로 남긴다(같은 코드가 두 번 들어 있을 리 없다).
            if (!matched && constantTimeEquals(trimmed, target)) {
                matched = true;
                continue;
            }
            remaining.add(trimmed);
        }
        return matched ? String.join(SEPARATOR, remaining) : null;
    }

    /** 남은 개수. 화면에 "복구 코드 3개 남음" 을 띄워 미리 재발급을 유도한다. */
    public int remaining(String storedHashes) {
        if (storedHashes == null || storedHashes.isBlank()) return 0;
        return (int) Arrays.stream(storedHashes.split(SEPARATOR)).filter(s -> !s.isBlank()).count();
    }

    /**
     * 입력 정규화 — 대소문자·구분자·공백을 모두 흡수한다.
     *
     * <p>화면에는 {@code ABCDE-FGHJK} 로 보여 주지만 사용자가 하이픈을 빼고 치거나 소문자로 칠 수 있다. 마지막 입구에서 형식 때문에 막히면 안 된다.
     */
    private String normalize(String input) {
        StringBuilder out = new StringBuilder();
        for (char c : input.toUpperCase().toCharArray()) {
            if (ALPHABET.indexOf(c) >= 0) out.append(c);
        }
        return out.toString();
    }

    private String randomCode() {
        StringBuilder out = new StringBuilder(CODE_LENGTH + 1);
        for (int i = 0; i < CODE_LENGTH; i++) {
            // 보기 좋게 5자씩 끊는다.
            if (i == CODE_LENGTH / 2) out.append(GROUP_SEPARATOR);
            out.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return out.toString();
    }

    /** 저장·대조용 해시. 입력은 항상 정규화된 값이어야 한다. */
    private String hash(String code) {
        String normalized = normalize(code);
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(normalized.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다", e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
