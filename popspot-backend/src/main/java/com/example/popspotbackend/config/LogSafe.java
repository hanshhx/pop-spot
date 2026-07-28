package com.example.popspotbackend.config;

import java.util.regex.Pattern;

/**
 * 로그에 개인정보가 그대로 남지 않도록 걸러 준다.
 *
 * <p>로그는 파일·수집기·백업으로 퍼지고 보존 기간도 길다. 화면에 안 내보내는 값이라도 로그에 남으면
 * 결국 같은 것이 유출된다.
 *
 * <p>마스킹 규칙이 {@code AuthController} 와 {@code EmailService} 에 각각 복사돼 있었다. 한곳에 모아
 * 규칙이 갈리지 않게 한다.
 */
public final class LogSafe {

    private LogSafe() {}

    /** {@code hong@example.com} → {@code h***@example.com}. 도메인은 남긴다(장애 분석에 쓰인다). */
    public static String email(String email) {
        if (email == null || email.isBlank()) return "(none)";
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }

    /**
     * PostgreSQL 이 값을 그대로 실어 보내는 부분을 지운다.
     *
     * <p>UNIQUE 위반 메시지는 이런 형태다.
     *
     * <pre>
     * duplicate key value violates unique constraint "users_email_key"
     *   Detail: Key (email)=(victim@example.com) already exists.
     * </pre>
     *
     * <p>{@code Detail} 줄에 <b>위반한 값이 통째로</b> 들어간다. 그대로 로그에 남기면 가입한 이메일·
     * 전화번호가 로그 파일에 쌓이고, 로그를 볼 수 있는 사람에게는 "이 번호가 가입돼 있는가" 를 확인하는
     * 조회 도구가 된다.
     *
     * <p>제약 이름은 남긴다 — 어느 제약이 깨졌는지는 원인 파악에 필요하고 그 자체로는 개인정보가 아니다.
     */
    public static String constraintViolation(String message) {
        if (message == null || message.isBlank()) return "(no message)";
        // "Key (컬럼)=(값)" 의 값 부분만 지운다.
        String masked = KEY_VALUE.matcher(message).replaceAll("Key ($1)=(***)");
        // 그 밖에 Detail 절이 남아 있으면 통째로 자른다(형식이 드라이버·버전마다 다르다).
        int detail = masked.indexOf("Detail:");
        if (detail >= 0 && masked.indexOf("***") < 0) {
            masked = masked.substring(0, detail).trim() + " (상세 생략)";
        }
        return masked;
    }

    private static final Pattern KEY_VALUE = Pattern.compile("Key \\(([^)]*)\\)=\\([^)]*\\)");
}
