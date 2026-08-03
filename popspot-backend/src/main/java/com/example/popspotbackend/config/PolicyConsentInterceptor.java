package com.example.popspotbackend.config;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.PolicyVersionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 로그인 사용자가 최신 약관·개인정보 처리방침과 만 14세 이상 확인을 마치기 전에는 데이터를 바꾸는 요청을 막는다. 읽기 전용 화면은 열어 두어 정책 본문과 동의 화면에
 * 접근할 수 있게 한다.
 */
@Component
@RequiredArgsConstructor
public class PolicyConsentInterceptor implements HandlerInterceptor {

    /** 회원 탈퇴 경로. 동의 여부와 무관하게 통과시킨다. */
    private static final String WITHDRAWAL_PATH = "/api/v1/users/me";

    private final UserRepository userRepository;
    private final PolicyVersionService policyVersions;

    @Override
    public boolean preHandle(
            HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (isReadOnly(request.getMethod())) return true;

        // 탈퇴는 언제나 열어 둔다.
        //
        // 동의를 거부한 사람이 서비스를 떠나지도 못하면 "동의하거나 갇히거나" 가 된다. 그건 동의를
        // 사실상 강요하는 것이고, 개인정보 삭제 요구권을 막는 것이기도 하다. 거부하는 것도 선택지로
        // 남아 있어야 그 앞의 동의가 의미를 갖는다.
        //
        // 같은 경로의 PATCH(프로필 수정)는 그대로 막힌다 — 경로 전체를 여는 대신 메서드까지 본다.
        if (isAccountWithdrawal(request)) return true;

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return true;
        }

        User user = userRepository.findById(authentication.getName()).orElse(null);
        if (user == null || policyVersions.hasRequiredConsent(user)) return true;

        response.setStatus(428);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter()
                .write(
                        "{\"error\":\"POLICY_CONSENT_REQUIRED\","
                                + "\"message\":\"최신 약관과 개인정보 처리방침 동의 및 만 14세 이상 확인이 필요합니다.\"}");
        return false;
    }

    private boolean isReadOnly(String method) {
        return "GET".equals(method) || "HEAD".equals(method) || "OPTIONS".equals(method);
    }

    /** 회원 탈퇴 요청인가 — {@code DELETE /api/v1/users/me}. */
    private boolean isAccountWithdrawal(HttpServletRequest request) {
        return "DELETE".equals(request.getMethod())
                && WITHDRAWAL_PATH.equals(request.getRequestURI());
    }
}
