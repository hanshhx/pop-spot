package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.PolicyVersionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class PolicyConsentInterceptorTest {

    private UserRepository userRepository;
    private PolicyConsentInterceptor interceptor;
    private PolicyVersionService policyVersions;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        policyVersions = mock(PolicyVersionService.class);
        interceptor = new PolicyConsentInterceptor(userRepository, policyVersions);
        request = mock(HttpServletRequest.class);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 최신_동의가_없는_로그인_사용자의_변경_요청은_428로_거부한다() throws Exception {
        authenticate("user-1");
        when(request.getMethod()).thenReturn("POST");
        User stale = User.builder().userId("user-1").agreedTermsVersion("1.1").build();
        when(userRepository.findById("user-1")).thenReturn(Optional.of(stale));
        when(policyVersions.hasRequiredConsent(stale)).thenReturn(false);

        HttpServletResponse response = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        verify(response).setStatus(428);
        assertThat(body.toString()).contains("POLICY_CONSENT_REQUIRED");
    }

    @Test
    void 최신_동의를_마친_사용자의_변경_요청은_통과한다() throws Exception {
        authenticate("user-2");
        when(request.getMethod()).thenReturn("PATCH");
        User user = User.builder().userId("user-2").build();
        user.recordPolicyConsent("1.2", "1.2");
        when(userRepository.findById("user-2")).thenReturn(Optional.of(user));
        when(policyVersions.hasRequiredConsent(user)).thenReturn(true);

        assertThat(interceptor.preHandle(request, mock(HttpServletResponse.class), new Object()))
                .isTrue();
    }

    @Test
    void 조회_요청은_동의_상태와_무관하게_통과한다() throws Exception {
        authenticate("user-3");
        when(request.getMethod()).thenReturn("GET");

        assertThat(interceptor.preHandle(request, mock(HttpServletResponse.class), new Object()))
                .isTrue();
    }

    @Test
    void 동의를_거부한_사람도_탈퇴는_할_수_있다() throws Exception {
        // 동의를 안 한 사람이 서비스를 떠나지도 못하면 "동의하거나 갇히거나" 가 된다.
        // 그건 동의를 사실상 강요하는 것이고, 개인정보 삭제 요구권을 막는 것이기도 하다.
        authenticate("user-4");
        when(request.getMethod()).thenReturn("DELETE");
        when(request.getRequestURI()).thenReturn("/api/v1/users/me");

        assertThat(interceptor.preHandle(request, mock(HttpServletResponse.class), new Object()))
                .describedAs("탈퇴가 막히면 거부는 선택지가 아니게 된다")
                .isTrue();
        // 동의 여부를 물어볼 필요조차 없다 — DB 조회 없이 통과해야 한다.
        verify(userRepository, never()).findById(anyString());
    }

    @Test
    void 같은_경로의_프로필_수정은_여전히_막힌다() throws Exception {
        // 탈퇴만 열어 준 것이지 경로 전체를 연 것이 아니다.
        authenticate("user-5");
        when(request.getMethod()).thenReturn("PATCH");
        when(request.getRequestURI()).thenReturn("/api/v1/users/me");
        User stale = User.builder().userId("user-5").agreedTermsVersion("1.1").build();
        when(userRepository.findById("user-5")).thenReturn(Optional.of(stale));
        when(policyVersions.hasRequiredConsent(stale)).thenReturn(false);

        HttpServletResponse response = mock(HttpServletResponse.class);
        when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
    }

    private void authenticate(String userId) {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(userId, null, List.of()));
    }
}
