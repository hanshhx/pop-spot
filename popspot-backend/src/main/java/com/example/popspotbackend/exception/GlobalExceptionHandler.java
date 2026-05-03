package com.example.popspotbackend.exception;

import io.sentry.Sentry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 글로벌 예외 처리.
 *
 * 표준 응답 규격: { status, error, message, timestamp }
 *  - 운영에서 스택트레이스 절대 노출 X
 *  - 5xx 는 사용자에게는 일반화된 메시지만 (Sentry 에서 추적)
 *  - SecurityException → 403, AuthenticationException → 401
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 인증 실패 (잘못된 토큰 등) */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthException(AuthenticationException ex) {
        return body(HttpStatus.UNAUTHORIZED, "Unauthorized", "인증이 필요합니다.");
    }

    /**
     * 정적 리소스 없음 (예: 누가 백엔드 도메인 루트(/) 직접 접속).
     * 백엔드는 API 만 제공하므로 정적 리소스 없는 게 정상 → 조용히 404 반환.
     * 스택트레이스 안 찍어서 로그 깔끔하게 유지.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "Not Found", "요청한 리소스가 없습니다.");
    }

    /** 인가 실패 (권한 부족) */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return body(HttpStatus.FORBIDDEN, "Forbidden", "접근 권한이 없습니다.");
    }

    /** 보안 위반 (위변조 결제 등) */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurity(SecurityException ex) {
        log.warn("⚠️ SecurityException: {}", ex.getMessage());
        Sentry.captureException(ex);
        return body(HttpStatus.FORBIDDEN, "Forbidden", ex.getMessage());
    }

    /** 잘못된 요청 데이터 */
    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    /** 도메인 정책 위반 / 상태 불일치 */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return body(HttpStatus.CONFLICT, "Conflict", ex.getMessage());
    }

    /** 비즈니스 로직 중 개발자가 의도적으로 던진 RuntimeException */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeExceptions(RuntimeException ex) {
        Sentry.captureException(ex);
        log.warn("RuntimeException: {}", ex.getMessage());
        return body(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    /** 예상치 못한 서버 에러 — 응답에 내부 정보 절대 노출 X */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAllExceptions(Exception ex) {
        Sentry.captureException(ex);
        log.error("UnhandledException: {}", ex.getClass().getName(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error",
                "서버 내부 오류가 발생했습니다. 관리자에게 알림이 전송되었습니다.");
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus status, String error, String msg) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", status.value());
        resp.put("error", error);
        resp.put("message", msg == null ? error : msg);
        resp.put("timestamp", OffsetDateTime.now().toString());
        return ResponseEntity.status(status).body(resp);
    }
}
