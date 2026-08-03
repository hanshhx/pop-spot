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

    private boolean isSensitive(HttpServletRequest request) {
        String target = request.getMethod() + " " + request.getRequestURI();
        return SENSITIVE.stream().anyMatch(target::startsWith);
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : auth.getName();
    }
}
