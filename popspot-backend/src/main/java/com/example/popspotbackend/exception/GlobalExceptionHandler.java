package com.example.popspotbackend.exception;

import io.sentry.Sentry;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 글로벌 예외 처리.
 *
 * <p>표준 응답 규격: {@code { status, error, message, timestamp }}. 운영에서는 스택트레이스를 응답에 절대 노출하지 않으며, 예상치 못한
 * 5xx 는 일반화된 메시지만 돌려주고 원인은 Sentry 로만 추적한다. {@link SecurityException} 은 403, {@link
 * AuthenticationException} 은 401.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String MESSAGE_UNAUTHORIZED = "인증이 필요합니다.";
    private static final String MESSAGE_FORBIDDEN = "접근 권한이 없습니다.";
    private static final String MESSAGE_NOT_FOUND = "요청한 리소스가 없습니다.";
    private static final String MESSAGE_INTERNAL = "서버 내부 오류가 발생했습니다. 관리자에게 알림이 전송되었습니다.";

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthException(AuthenticationException ex) {
        return body(HttpStatus.UNAUTHORIZED, "Unauthorized", MESSAGE_UNAUTHORIZED);
    }

    /**
     * 정적 리소스 없음 — 백엔드는 API 만 제공하므로 누가 루트({@code /})로 들어오면 정상적으로 404 를 돌려준다. 스택트레이스는 남기지 않아 로그를 깔끔하게
     * 유지.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return body(HttpStatus.NOT_FOUND, "Not Found", MESSAGE_NOT_FOUND);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return body(HttpStatus.FORBIDDEN, "Forbidden", MESSAGE_FORBIDDEN);
    }

    /**
     * Spring Security 6.x 부터 {@code @PreAuthorize} 거부 시 던지는 새 예외 타입. 옛
     * {@link AccessDeniedException} 과 의미는 같지만 클래스 위치가 다르다.
     *
     * <p>v2.13.3: 일반 유저가 어드민 엔드포인트 (대시보드 / 메트릭 / SSE 로그) 를 호출하면 매 요청마다
     * 100+ 줄 stack trace 가 Tomcat 단까지 propagate 되어 운영 로그 / Sentry 가 도배되던 문제 해결.
     * 본 핸들러가 잡아 한 줄 WARN + 403 응답으로 단순화한다. SSE/비동기 응답이 이미 commit 된 후
     * 발생하던 "response already committed" 후속 에러도 함께 해소.
     */
    @ExceptionHandler(AuthorizationDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAuthorizationDenied(
            AuthorizationDeniedException ex) {
        log.warn("AccessDenied: {}", ex.getMessage());
        return body(HttpStatus.FORBIDDEN, "Forbidden", MESSAGE_FORBIDDEN);
    }

    /**
     * 도메인 리소스(User · PopupStore · MatePost 등)를 못 찾았을 때. 404 로 변환.
     *
     * <p>{@code RuntimeException("유저 없음")} 패턴을 {@link ResourceNotFoundException} 으로 격상한 결과 — 잘못된 ID
     * 요청 시 일관된 404 응답을 보장하고, 운영 로그 노이즈를 줄인다.
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        log.debug("ResourceNotFound: {}", ex.getMessage());
        return body(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage());
    }

    /** 위변조 결제 등 보안 정책 위반. */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurity(SecurityException ex) {
        log.warn("SecurityException: {}", ex.getMessage());
        Sentry.captureException(ex);
        return body(HttpStatus.FORBIDDEN, "Forbidden", ex.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        return body(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
        return body(HttpStatus.CONFLICT, "Conflict", ex.getMessage());
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeExceptions(RuntimeException ex) {
        Sentry.captureException(ex);
        log.warn("RuntimeException: {}", ex.getMessage());
        return body(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAllExceptions(Exception ex) {
        Sentry.captureException(ex);
        log.error("UnhandledException: {}", ex.getClass().getName(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", MESSAGE_INTERNAL);
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
