package com.example.popspotbackend.config;

import com.example.popspotbackend.service.admin.AdminReauthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 되돌릴 수 없는 관리자 작업 앞에서 재확인 여부를 본다.
 *
 * <p><b>대상은 목록으로 고정한다.</b> 감사 로그는 반대로 "GET 이 아니면 전부" 인데, 거기서는 빠뜨리는 것이 위험하고 여기서는 <b>과하게 잡는 것</b>이
 * 위험하기 때문이다. 팝업 승인처럼 매일 수십 번 하는 일에 6자리를 물으면 관리자는 이 화면을 안 쓰게 된다.
 *
 * <p>그래서 기준은 하나다 — <b>되돌릴 수 있는가.</b> 승인·상태변경·백필은 다시 되돌리면 된다. 영구 삭제와 강제 삭제, 그리고 2단계 인증 해제는 되돌릴 수 없다.
 */
@Component
@RequiredArgsConstructor
public class AdminReauthInterceptor implements HandlerInterceptor {

    /**
     * 재확인이 필요한 요청 — {@code "메서드 경로접두사"}.
     *
     * <p>경로 변수가 붙는 자리는 접두사로만 비교한다. 여기서는 정확도보다 <b>빠뜨리지 않는 것</b>이 중요하고, 접두사가 넓게 잡는 방향이라 안전한 쪽으로 틀린다.
     */
    private static final Set<String> SENSITIVE =
            Set.of(
                    // 팝업 영구 삭제 — DB 에서 행이 사라진다.
                    "DELETE /api/admin/popups/crawl/",
                    // 동행 게시글 강제 삭제 — 참가자들의 약속이 함께 사라진다.
                    "DELETE /api/admin/mate-posts/",
                    // 라이브 댓글 삭제(단건·일괄).
                    "DELETE /api/admin/chat/",
                    "POST /api/admin/chat/delete-batch",
                    // 의견 영구 삭제.
                    "DELETE /api/admin/feedback/",
                    // 2단계 인증 해제 — 이걸 막지 않으면 토큰을 훔친 사람이 자물쇠를 스스로 연다.
                    "POST /api/admin/totp/disable");

    /**
     * D-3 — 재확인이 필요한 <b>영역</b>. 위 {@link #SENSITIVE} 와 달리 메서드를 가리지 않는다.
     *
     * <p>보안 기록과 분석 기록을 서로 다른 문턱 뒤에 두기 위한 목록이다. 관리자가 한 명이라 역할을 쪼개는 것은 아직 의미가 없지만(그건 두 번째 관리자가 생길 때),
     * 같은 계정이라도 <b>무엇을 보느냐에 따라 요구하는 증명을 다르게</b> 할 수는 있다. 그러면 세션이 탈취돼도 공격자가 얻는 것이 방문 통계까지로 줄어든다.
     *
     * <p><b>감사 로그는 읽기까지 막는다.</b> 거기에 관리자가 어디서 접속하는지가 적혀 있고, 그 IP 를 읽어 차단하면 진짜 관리자를 밀어낼 수 있다 — 두 화면이
     * 이어져 하나의 공격이 된다.
     *
     * <p>여기에 <b>방문 통계를 넣지 않는다.</b> 자주 보는 화면에 6자리를 물으면 관리자는 이 화면을 안 쓰고 DB 콘솔로 간다. 마찰이 과하면 보안 장치가 우회를
     * 만든다.
     *
     * <p><b>비상 스위치(전체 로그아웃)도 넣지 않는다.</b> 토큰이 샜다고 의심되는 순간에 쓰는 것이라 앞에 문을 하나 더 두면 비상용이 아니게 된다. 눌려 봐야
     * 전원 로그아웃이라 파괴적이지도 않다.
     */
    private static final Set<String> SENSITIVE_AREAS =
            Set.of(
                    // 감사 로그 + 보안 현황판.
                    "/api/admin/audit",
                    // IP 임시 차단 — 진짜 관리자를 잠그거나 자기를 풀 수 있다.
                    "/api/admin/security");

    private static final String BODY =
            "{\"error\":\"ReauthRequired\",\"message\":\"되돌릴 수 없는 작업입니다. 본인 확인을 한 번 더 해주세요.\"}";

    private final AdminReauthService reauth;

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {

        if (!isSensitive(request)) return true;
        if (reauth.isSatisfied(currentUserId())) return true;

        // 403 이 아니라 <b>428 Precondition Required</b> 로 답한다. 403 은 "권한이 없다" 라서
        // 프론트가 재로그인을 유도하는데, 여기서 필요한 것은 로그인이 아니라 확인 한 번이다.
        // 상태코드로 구분해야 화면이 6자리 입력창을 띄울지 로그인으로 보낼지 알 수 있다.
        response.setStatus(HttpStatus.PRECONDITION_REQUIRED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(BODY);
        return false;
    }

    /**
     * 이 요청에 재확인이 필요한가.
     *
     * <p>인터셉터 밖으로 꺼내 둔 이유는 <b>이 목록이 조용히 틀리기 때문</b>이다. 너무 넓으면 비상 스위치까지 문 뒤로 들어가고, 너무 좁으면 막으려던 것이 그냥
     * 지나간다. 둘 다 평소에는 아무 증상이 없다.
     */
    static boolean needsReauth(String method, String uri) {
        if (SENSITIVE_AREAS.stream().anyMatch(uri::startsWith)) return true;
        return SENSITIVE.stream().anyMatch((method + " " + uri)::startsWith);
    }

    private boolean isSensitive(HttpServletRequest request) {
        return needsReauth(request.getMethod(), request.getRequestURI());
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }
}
