package com.example.popspotbackend.exception;

import com.example.popspotbackend.config.LogSafe;
import io.sentry.Sentry;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 글로벌 예외 처리.
 *
 * <p>표준 응답 규격: {@code { status, error, message, timestamp }}. 운영에서는 스택트레이스를 응답에 절대 노출하지 않으며, 예상치 못한
 * 5xx 는 일반화된 메시지만 돌려주고 원인은 Sentry 로만 추적한다. {@link SecurityException} 은 403, {@link
 * AuthenticationException} 은 401.
 *
 * <p>예외 메시지를 그대로 클라이언트에 실어주는 핸들러는 <b>우리가 문구를 직접 쓴 예외</b>({@link IllegalArgumentException}, {@link
 * IllegalStateException}, {@link ResourceNotFoundException} 등)로 한정한다. 라이브러리(JPA · Redis)가 던지는 예외는
 * 메시지에 내부 구조가 담기므로 고정 문구로 덮는다.
 *
 * <p><b>상태코드는 사실이어야 한다.</b> 한동안 이 규칙이 양쪽으로 뒤집혀 있었다 — 서버 결함(DB 스키마 오류·Redis 장애)은 400 으로 나가 감시 장치에
 * 잡히지 않았고, 반대로 남이 파라미터 하나 빼고 부른 것은 500 + 알림이 됐다. 진짜 문제는 숨고 남의 오타는 울리는 상태라, 알림을 무시하게 되고 그러면 알림이 있으나
 * 마나가 된다. 그래서 지금은 이렇게 나눈다:
 *
 * <ul>
 *   <li><b>5xx — 우리 문제</b>: DB 접근 실패 500, 저장소 연결 실패 503, 외부 API 실패 502, 분류 안 되는 것 500. 전부 Sentry 로
 *       올린다.
 *   <li><b>4xx — 보낸 쪽 문제</b>: 메서드 405, 형식 415, 파라미터·본문 400. 알림을 울리지 않는다.
 * </ul>
 *
 * <p>어느 쪽이든 <b>본문 문구는 고정</b>이라 내부 구조가 새어 나가는 양은 늘지 않는다. 바뀌는 것은 상태코드와 알림 여부뿐이다.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String MESSAGE_UNAUTHORIZED = "인증이 필요합니다.";
    private static final String MESSAGE_FORBIDDEN = "접근 권한이 없습니다.";
    private static final String MESSAGE_NOT_FOUND = "요청한 리소스가 없습니다.";
    private static final String MESSAGE_INTERNAL = "서버 내부 오류가 발생했습니다. 관리자에게 알림이 전송되었습니다.";
    private static final String MESSAGE_CONFLICT = "이미 사용 중인 값입니다.";
    private static final String MESSAGE_BAD_REQUEST = "요청을 처리할 수 없습니다.";
    private static final String MESSAGE_UNAVAILABLE = "잠시 후 다시 시도해 주세요.";
    private static final String MESSAGE_UPSTREAM = "외부 서비스를 불러오지 못했습니다.";

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
     * Spring Security 6.x 부터 {@code @PreAuthorize} 거부 시 던지는 새 예외 타입. 옛 {@link
     * AccessDeniedException} 과 의미는 같지만 클래스 위치가 다르다.
     *
     * <p>v2.13.3: 일반 유저가 어드민 엔드포인트 (대시보드 / 메트릭 / SSE 로그) 를 호출하면 매 요청마다 100+ 줄 stack trace 가 Tomcat
     * 단까지 propagate 되어 운영 로그 / Sentry 가 도배되던 문제 해결. 본 핸들러가 잡아 한 줄 WARN + 403 응답으로 단순화한다. SSE/비동기
     * 응답이 이미 commit 된 후 발생하던 "response already committed" 후속 에러도 함께 해소.
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

    /**
     * DB 제약 위반(UNIQUE · FK · NOT NULL). 409 + 고정 문구.
     *
     * <p>전용 핸들러가 없어 {@link RuntimeException} 핸들러로 떨어졌고, 예외 메시지에 담긴 제약 이름 · 테이블 · 컬럼 · 위반한 값이 그대로
     * 400 본문에 실렸다. 특히 전화번호 UNIQUE 위반 메시지는 "이 번호가 이미 가입돼 있다"를 알려주는 조회 도구가 된다(가입 여부 열거). 원인은 로그로만
     * 남긴다.
     *
     * <p>중복 가입 시도처럼 사용자가 만드는 정상적인 실패가 대부분이라 Sentry 로는 올리지 않는다 — 올리면 알림이 노이즈로 묻힌다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(
            DataIntegrityViolationException ex) {
        // 값 부분은 지우고 제약 이름만 남긴다. PostgreSQL 은 "Key (email)=(victim@example.com)" 처럼
        // 위반한 값을 메시지에 그대로 실어 보내, 그대로 찍으면 가입 이메일·전화번호가 로그에 쌓인다.
        log.warn(
                "DataIntegrityViolation: {}",
                LogSafe.constraintViolation(ex.getMostSpecificCause().getMessage()));
        return body(HttpStatus.CONFLICT, "Conflict", MESSAGE_CONFLICT);
    }

    /* =============================================================
     *  서버 결함 — 5xx. 상태코드가 사실을 말해야 하는 구간.
     * ============================================================= */

    /**
     * DB 접근 실패 — 스키마 오류, 문법 오류, 매핑 오류. <b>500 이다.</b>
     *
     * <p>예전엔 이것이 {@link RuntimeException} 핸들러로 떨어져 400 이 나갔다. 400 은 "네가 잘못 보냈다" 는 뜻이라, 상태코드를 보는 어떤
     * 감시 장치도 이것을 장애로 세지 않는다. 실제로 그 때문에 관리자 통계 하나가 <b>몇 주 동안 죽은 채로</b> 있었다 — 네이티브 SQL 이 없는 칼럼을
     * 참조했는데(p.id), 서버는 400 을 돌려주고 화면은 그것을 "아직 기록이 없어요" 로 그렸다.
     *
     * <p>본문은 고정 문구다. 예외 메시지에는 테이블·칼럼명과 실패한 SQL 이 통째로 담기므로 절대 내보내지 않는다. 바뀌는 것은 상태코드뿐이다.
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccess(DataAccessException ex) {
        Sentry.captureException(ex);
        log.error("DataAccess 실패: {}", ex.getClass().getSimpleName(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", MESSAGE_INTERNAL);
    }

    /**
     * DB·Redis 에 연결하지 못함 — <b>503</b>. 코드가 잘못된 게 아니라 지금 붙지 않는 것이라, 잠시 뒤 다시 하면 될 수 있다.
     *
     * <p>{@code RedisConnectionFailureException} 도 이 타입을 상속하므로 함께 걸린다. 500(코드 결함)과 나누는 이유는 대응이 다르기
     * 때문이다 — 500 은 배포가 필요하고 503 은 인프라를 봐야 한다.
     */
    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessUnavailable(
            DataAccessResourceFailureException ex) {
        Sentry.captureException(ex);
        log.error("데이터 저장소 연결 실패: {}", ex.getClass().getSimpleName(), ex);
        return body(HttpStatus.SERVICE_UNAVAILABLE, "Service Unavailable", MESSAGE_UNAVAILABLE);
    }

    /** 우리가 부른 외부 API 가 실패 — <b>502</b>. 우리 잘못도 사용자 잘못도 아니다. */
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, Object>> handleRestClient(RestClientException ex) {
        Sentry.captureException(ex);
        log.error("외부 API 호출 실패: {}", ex.getClass().getSimpleName(), ex);
        return body(HttpStatus.BAD_GATEWAY, "Bad Gateway", MESSAGE_UPSTREAM);
    }

    /* =============================================================
     *  요청이 잘못된 것 — 4xx. 알림을 울리면 안 되는 구간.
     * ============================================================= */

    /**
     * 잘못된 메서드·형식·파라미터 — 각각 405 · 415 · 400.
     *
     * <p>이것들은 {@code ServletException} 계열이라 {@link RuntimeException} 핸들러를 비껴가 맨 아래 {@code
     * Exception} 핸들러까지 내려갔고, 그래서 <b>500 + Sentry 알림</b>이 됐다. 아무나 파라미터 하나 빼고 호출하면 장애 알림이 하나 생기는
     * 상태였다는 뜻이다. 그렇게 쌓인 알림은 곧 무시하게 되고, 그러면 진짜 장애도 같이 묻힌다.
     *
     * <p>{@code @ExceptionHandler(Exception.class)} 가 존재하는 한 스프링의 기본 매핑({@code
     * DefaultHandlerExceptionResolver})은 실행될 기회가 없다. 그래서 여기서 직접 되살린다.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex) {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "Method Not Allowed", MESSAGE_BAD_REQUEST);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMediaTypeNotSupported(
            HttpMediaTypeNotSupportedException ex) {
        return body(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported Media Type", MESSAGE_BAD_REQUEST);
    }

    /** 파라미터 누락·바인딩 실패·타입 불일치·본문 파싱 실패 — 전부 보낸 쪽 문제라 400 이고, 알림을 울리지 않는다. */
    @ExceptionHandler({
        ServletRequestBindingException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    public ResponseEntity<Map<String, Object>> handleMalformedRequest(Exception ex) {
        log.debug("잘못된 요청: {}", ex.getClass().getSimpleName());
        return body(HttpStatus.BAD_REQUEST, "Bad Request", MESSAGE_BAD_REQUEST);
    }

    /**
     * 컨트롤러가 상태코드를 직접 정해 던진 예외 — 그 상태코드를 존중한다.
     *
     * <p>{@code ResponseStatusException} 이 이 타입을 상속한다. 이 핸들러가 없으면 컨트롤러가 404 나 409 를 의도해 던져도 아래
     * {@link RuntimeException} 핸들러가 가져가 전혀 다른 코드로 나간다 — 의도를 적었는데 무시되는 것이라, 코드를 읽는 사람이 속는다.
     */
    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<Map<String, Object>> handleErrorResponse(ErrorResponseException ex) {
        HttpStatus status =
                HttpStatus.resolve(ex.getStatusCode().value()) == null
                        ? HttpStatus.INTERNAL_SERVER_ERROR
                        : HttpStatus.valueOf(ex.getStatusCode().value());
        if (status.is5xxServerError()) {
            Sentry.captureException(ex);
            log.error("ErrorResponseException({}): {}", status.value(), ex.getMessage(), ex);
        } else {
            log.debug("ErrorResponseException({}): {}", status.value(), ex.getMessage());
        }
        // 이 예외는 우리 코드가 상태와 문구를 직접 정해 던진 것이다. 그 문구는 라이브러리가
        // 만든 게 아니라 사람이 쓴 것이라 그대로 전달한다 — 없으면 고정 문구로 채운다.
        String detail = ex.getBody() == null ? null : ex.getBody().getDetail();
        String fallback = status.is5xxServerError() ? MESSAGE_INTERNAL : MESSAGE_BAD_REQUEST;
        return body(status, status.getReasonPhrase(), detail == null ? fallback : detail);
    }

    /**
     * 위 어디에도 분류되지 않은 런타임 예외 — <b>500</b>.
     *
     * <p>기본값이 400 이었다. 그런데 "분류에 실패했다" 는 것은 우리가 예상하지 못한 일이 벌어졌다는 뜻이지, 사용자가 잘못 보냈다는 뜻이 아니다. 예상 못 한 것을
     * 사용자 탓으로 돌리면 서버 결함이 통계에서 사라진다.
     *
     * <p>본문은 고정 문구다. 예전엔 {@code ex.getMessage()} 를 그대로 실어서 Redis 장애 때 "Error in execution" 이 사용자
     * 화면까지 나갔고 DB 예외에서는 테이블·칼럼명이 새어나갔다. 원인은 로그와 Sentry 에만 남긴다.
     *
     * <p>의도적으로 메시지를 전달하던 경로는 영향받지 않는다: 프론트가 분기하는 {@code SOCIAL_USER:} 는 {@code AuthController} 가 자체
     * try/catch 로 잡아 응답을 만들고, 검증 문구는 더 구체적인 {@link IllegalArgumentException} · {@link
     * IllegalStateException} 핸들러가 먼저 가져간다.
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeExceptions(RuntimeException ex) {
        Sentry.captureException(ex);
        log.error("분류되지 않은 RuntimeException: {}", ex.getClass().getName(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", MESSAGE_INTERNAL);
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
