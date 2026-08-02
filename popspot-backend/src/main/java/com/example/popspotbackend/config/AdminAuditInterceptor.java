package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.service.admin.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.AsyncHandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * 관리자 행위를 감사 표에 남긴다. 컨트롤러는 한 줄도 건드리지 않는다.
 *
 * <p><b>무엇을 남기는가.</b> 상태를 바꾸는 요청(GET 이 아닌 것)은 <b>전부</b> 남긴다. 새 엔드포인트가 생겨도 자동으로 걸리도록 하기 위해서다 — 목록을
 * 손으로 관리하면 언젠가 빠뜨리고, 빠뜨린 것은 아무도 모른다.
 *
 * <p>반대로 조회(GET)는 {@link #AUDITED_READS} 에 적힌 것만 남긴다. 관리자 화면이 대시보드 지표를 <b>3초마다</b> 폴링하기 때문이다. 조회를
 * 전부 남기면 하루 2만 행이 지표 조회로만 쌓여, 정작 봐야 할 삭제 기록이 그 속에 묻힌다. 조회 중에서도 <b>개인정보를 대량으로 훑는 것</b>만 골라 남긴다.
 *
 * <p><b>{@code afterCompletion} 에서 기록하는 이유.</b> 이 시점에는 응답이 이미 나갔다. 그래서 감사 기록이 느리거나 실패해도 사용자가 보는
 * 응답에는 영향이 없다. 요청 시작 시점에 기록하면 결과(성공/실패)를 알 수 없고, 응답 직전에 기록하면 DB 가 느릴 때 그만큼 응답이 늦어진다.
 */
@Component
@RequiredArgsConstructor
public class AdminAuditInterceptor implements AsyncHandlerInterceptor {

    /** 익명 사용자의 이름. 이 프로젝트에서 익명도 {@code isAuthenticated()} 는 참이라 이름으로 걸러야 한다. */
    private static final String ANONYMOUS_USER = "anonymousUser";

    /**
     * 조회 중에 남길 것 — 개인정보를 대량으로 훑는 경로.
     *
     * <p>무엇을 봤는지가 아니라 <b>'봤다'는 사실</b>만 남는다. 조회한 회원 목록을 그대로 기록하면 감사 로그가 회원 명부 사본이 된다.
     */
    private static final Set<String> AUDITED_READS =
            Set.of("/api/admin/users", "/api/admin/visits/visitors", "/api/admin/logs/stream");

    /**
     * 이미 기록했음을 표시하는 요청 속성.
     *
     * <p>서버가 밀어 주는 스트림(SSE)은 요청 하나가 <b>두 번</b> 인터셉터를 탄다 — 스트림이 열릴 때 한 번, 닫힐 때 다시 한 번. 표시가 없으면 로그 열람
     * 한 번이 두 줄로 남는다.
     */
    private static final String RECORDED = AdminAuditInterceptor.class.getName() + ".recorded";

    /**
     * 컨트롤러가 처리 건수를 덧붙이는 통로.
     *
     * <p>일괄 처리는 "무엇을 했는가" 만으로 부족하다 — 되돌릴 수 없는 삭제에서 <b>몇 건이었는지</b>가 피해 규모를 말해 준다. 그 숫자는 작업이 끝나야 알 수
     * 있어서 인터셉터 혼자서는 구할 수 없다. 컨트롤러가 {@link #addDetail} 로 남겨 두면 기록할 때 함께 붙는다.
     */
    private static final String EXTRA_DETAIL = AdminAuditInterceptor.class.getName() + ".detail";

    /** {@code detail} 에 담을 파라미터와 각각의 허용 형식. 이름만 거르고 값을 그대로 넣으면 결국 아무거나 들어온다. */
    private static final Map<String, Pattern> DETAIL_PARAMS =
            Map.of(
                    "limit", Pattern.compile("^\\d{1,6}$"),
                    "size", Pattern.compile("^\\d{1,6}$"),
                    "days", Pattern.compile("^\\d{1,6}$"),
                    "page", Pattern.compile("^\\d{1,6}$"),
                    "retryMissing", Pattern.compile("^(true|false)$"),
                    "status", Pattern.compile("^[A-Za-z_]{1,20}$"));

    private final AdminAuditService auditService;

    /** 일괄 처리 컨트롤러가 처리 건수를 남길 때 쓴다. 예: {@code addDetail(request, "삭제=12")} */
    public static void addDetail(HttpServletRequest request, String text) {
        if (request == null || text == null || text.isBlank()) return;
        Object prev = request.getAttribute(EXTRA_DETAIL);
        request.setAttribute(EXTRA_DETAIL, prev == null ? text : prev + " " + text);
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex) {
        if (!shouldRecord(request)) return;

        int status = response.getStatus();
        boolean failed = ex != null || status >= 400;

        // 핸들러 밖으로 예외가 새어 나갔는데 상태가 200 이면, 그 200 은 사실이 아니다.
        // 없는 것보다 틀린 기록이 나쁘다 — 차라리 500 으로 적는다.
        if (ex != null && status < 400) status = 500;

        auditService.record(
                currentActorId(),
                action(request),
                targetType(request),
                targetId(request),
                !failed,
                status,
                detail(request));
    }

    /**
     * 스트림이 열린 시점. 여기서 남기지 않으면 <b>연결이 끊길 때까지</b> 기록이 없다.
     *
     * <p>서버 로그 스트림은 몇 시간씩 열려 있을 수 있어서, 닫힐 때만 기록하면 그 사이에 무슨 일이 있어도 "아직 아무도 안 봤다" 로 보인다.
     */
    @Override
    public void afterConcurrentHandlingStarted(
            HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!shouldRecord(request)) return;

        int status = response.getStatus();
        auditService.record(
                currentActorId(),
                action(request),
                targetType(request),
                targetId(request),
                status < 400 && !response.isCommitted(),
                status,
                "스트림 열림");
    }

    /** 기록 대상인지 판단하고, 대상이면 '기록함' 표시를 남긴다(중복 방지). */
    private boolean shouldRecord(HttpServletRequest request) {
        if (request.getAttribute(RECORDED) != null) return false;

        boolean readOnly = "GET".equalsIgnoreCase(request.getMethod());
        if (readOnly && !AUDITED_READS.contains(pattern(request))) return false;

        request.setAttribute(RECORDED, Boolean.TRUE);
        return true;
    }

    private String currentActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return "(anonymous)";
        String name = auth.getName();
        return name == null || name.isBlank() || ANONYMOUS_USER.equals(name) ? "(anonymous)" : name;
    }

    /** {@code "POST /api/admin/popups/{id}/approve"} — 실제 URI 가 아니라 매핑 패턴이다. */
    private String action(HttpServletRequest request) {
        return request.getMethod() + " " + pattern(request);
    }

    /**
     * 매핑 패턴. 못 구하면 URI 로 물러선다.
     *
     * <p>URI 로 물러서는 경우는 핸들러를 못 찾은 404 뿐이라, 경로에 id 가 섞여 들어와도 집계를 망치지 않는다.
     */
    private String pattern(HttpServletRequest request) {
        Object best = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return best != null ? best.toString() : request.getRequestURI();
    }

    private String targetType(HttpServletRequest request) {
        String path = pattern(request);
        if (path.contains("/popups") || path.contains("/popup/")) return AdminAuditLog.TARGET_POPUP;
        if (path.contains("/chat")) return AdminAuditLog.TARGET_CHAT;
        if (path.contains("/mate-posts")) return AdminAuditLog.TARGET_MATE_POST;
        if (path.contains("/feedback")) return AdminAuditLog.TARGET_FEEDBACK;
        if (path.contains("/totp") || path.contains("/session")) {
            return AdminAuditLog.TARGET_ADMIN_SELF;
        }
        if (path.contains("/users") || path.contains("/visitors")) {
            return AdminAuditLog.TARGET_MEMBER_DATA;
        }
        if (path.contains("/logs")) return AdminAuditLog.TARGET_SERVER_LOG;
        return AdminAuditLog.TARGET_SYSTEM;
    }

    /**
     * 경로에 박힌 대상 식별자.
     *
     * <p>여기서 꺼낸 값은 <b>검증하지 않는다</b> — {@code AdminAuditService} 가 숫자나 UUID 형식일 때만 저장한다. 검증을 저장 직전 한
     * 곳에 모아야 새 호출자가 생겨도 빠져나갈 구멍이 없다.
     */
    @SuppressWarnings("unchecked")
    private String targetId(HttpServletRequest request) {
        Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (!(vars instanceof Map)) return null;

        Map<String, String> map = (Map<String, String>) vars;
        for (String key : new String[] {"id", "userId", "popupId", "postId"}) {
            String value = map.get(key);
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    /** 허용 목록에 있고 <b>형식까지 맞는</b> 파라미터만. 요청 본문은 읽지 않는다. */
    private String detail(HttpServletRequest request) {
        StringBuilder sb = new StringBuilder();
        Object extra = request.getAttribute(EXTRA_DETAIL);
        if (extra != null) sb.append(extra);
        DETAIL_PARAMS.forEach(
                (name, allowed) -> {
                    String value = request.getParameter(name);
                    if (value == null || !allowed.matcher(value).matches()) return;
                    if (sb.length() > 0) sb.append(' ');
                    sb.append(name).append('=').append(value);
                });
        return sb.length() == 0 ? null : sb.toString();
    }
}
