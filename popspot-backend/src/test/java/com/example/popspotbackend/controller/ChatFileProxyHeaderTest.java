package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.example.popspotbackend.service.media.ImageUploadGuard;
import com.example.popspotbackend.service.media.UploadQuotaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;

class ChatFileProxyHeaderTest {

    @Test
    @DisplayName("신뢰 프록시가 아니면 전달 헤더로 업로드 URL을 바꿀 수 없다")
    void ignoresForwardedHeadersWhenProxyTrustIsDisabled() {
        ChatFileController controller = controller(false);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setScheme("https");
        request.setServerName("api.popspot.co.kr");
        request.setServerPort(443);
        request.addHeader("X-Forwarded-Proto", "javascript");
        request.addHeader("X-Forwarded-Host", "api.popspot.co.kr");

        String url =
                ReflectionTestUtils.invokeMethod(controller, "buildPublicUrl", request, "a.png");

        assertThat(url).isEqualTo("https://api.popspot.co.kr/uploads/a.png");
    }

    @Test
    @DisplayName("신뢰 프록시에서도 http와 https 외의 스킴은 거부한다")
    void rejectsUnsafeForwardedScheme() {
        ChatFileController controller = controller(true);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setScheme("http");
        request.setServerName("backend");
        request.setServerPort(8080);
        request.addHeader("X-Forwarded-Proto", "javascript");
        request.addHeader("X-Forwarded-Host", "api.popspot.co.kr");

        String url =
                ReflectionTestUtils.invokeMethod(controller, "buildPublicUrl", request, "a.png");

        assertThat(url).isEqualTo("http://api.popspot.co.kr/uploads/a.png");
    }

    @Test
    @DisplayName("허용되지 않은 Host 헤더로 공개 파일 주소를 만들지 않는다")
    void rejectsUntrustedRequestHost() {
        ChatFileController controller = controller(false);
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

    private static ChatFileController controller(boolean trustProxyHeaders) {
        return new ChatFileController(
                "api\\.popspot\\.co\\.kr",
                trustProxyHeaders,
                "build/test-uploads",
                mock(ImageUploadGuard.class),
                mock(UploadQuotaService.class));
    }
}
