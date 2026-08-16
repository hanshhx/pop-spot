package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.AccountDeletionService;
import com.example.popspotbackend.service.media.ImageUploadGuard;
import com.example.popspotbackend.service.media.UploadQuotaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

class UserProfileProxyHeaderTest {

    @Test
    @DisplayName("프록시를 신뢰하지 않을 때 프로필 사진 URL의 전달 헤더를 무시한다")
    void ignoresForwardedHeadersWhenProxyTrustIsDisabled() {
        UserProfileController controller = controller(false);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setScheme("https");
        request.setServerName("api.popspot.co.kr");
        request.setServerPort(443);
        request.addHeader("X-Forwarded-Proto", "http");
        request.addHeader("X-Forwarded-Host", "attacker.example");

        String url =
                ReflectionTestUtils.invokeMethod(controller, "buildPublicUrl", request, "a.png");

        assertThat(url).isEqualTo("https://api.popspot.co.kr/uploads/avatar/a.png");
    }

    @Test
    @DisplayName("허용되지 않은 Host 헤더로 프로필 사진 주소를 만들지 않는다")
    void rejectsUntrustedRequestHost() {
        UserProfileController controller = controller(false);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setScheme("https");
        request.setServerName("attacker.example");
        request.setServerPort(443);

        assertThatThrownBy(
                        () ->
                                ReflectionTestUtils.invokeMethod(
                                        controller, "buildPublicUrl", request, "a.png"))
                .isInstanceOf(SecurityException.class);
    }

    private static UserProfileController controller(boolean trustProxyHeaders) {
        return new UserProfileController(
                mock(UserRepository.class),
                mock(AccountDeletionService.class),
                "api\\.popspot\\.co\\.kr",
                trustProxyHeaders,
                "build/test-uploads",
                mock(ImageUploadGuard.class),
                mock(UploadQuotaService.class));
    }
}
