package com.example.popspotbackend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC 설정 — 업로드 폴더 정적 매핑과 Rate Limit Interceptor 등록.
 *
 * <p>{@code addCorsMappings} 는 의도적으로 비워둔다. CORS 는 {@code SecurityConfig#corsConfigurationSource} 가
 * 단일 진실 공급원이며 두 곳에서 설정하면 충돌해 invalid CORS 응답이 발생한다.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private static final String UPLOAD_URL_PATTERN = "/uploads/**";
    private static final String AUTH_PATH_PATTERN = "/api/v1/auth/**";

    /**
     * 권리자 takedown 신고 경로 — 레이트리밋 대상.
     *
     * <p>이 엔드포인트는 인증 없이 즉시 노출 차단을 일으킨다(약관 §11 로 공표된 정책). 인증을 요구하면 약관을 어기게 되므로, 대량 악용을 막는 유일한 수단이 호출
     * 빈도 제한이다. 실제 제한값은 {@link RateLimitInterceptor} 가 정한다.
     */
    private static final String TAKEDOWN_PATH_PATTERN = "/api/popups/*/takedown";

    @Value("${app.upload.path}")
    private String uploadPath;

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path base = Paths.get(uploadPath).toAbsolutePath().normalize();

        // 부팅 시점에 디렉터리를 만들어 둔다. 두 가지 이유가 있다.
        // (1) Paths.toUri() 는 디렉터리가 **실재할 때만** 후행 슬래시를 붙인다. 없으면 매핑 문자열이
        //     디렉터리가 아닌 파일로 해석돼 /uploads/** 서빙이 통째로 404 가 된다.
        // (2) APP_UPLOAD_PATH 가 /var/popspot/uploads 처럼 홈 밖을 가리키는데 실행 계정에 권한이 없으면
        //     업로드가 500 으로 실패한다. 여기서 미리 실패를 로그로 드러내 배포 직후 바로 알 수 있게 한다.
        try {
            Files.createDirectories(base.resolve("avatar"));
        } catch (IOException e) {
            log.error("[WebConfig] 업로드 디렉터리 생성 실패 — 업로드가 실패합니다. 경로={} 원인={}", base, e.toString());
        }

        String resourcePath = base.toUri().toString();
        if (!resourcePath.endsWith("/")) resourcePath += "/";

        log.info("[WebConfig] 업로드 폴더 매핑: {} → {}", UPLOAD_URL_PATTERN, resourcePath);
        registry.addResourceHandler(UPLOAD_URL_PATTERN).addResourceLocations(resourcePath);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns(AUTH_PATH_PATTERN, TAKEDOWN_PATH_PATTERN);
        // 보안(v2.22): 업로드 파일 응답에 nosniff — 이미지로 위장한 HTML/SVG 가 브라우저 MIME
        // 스니핑으로 실행되는 것을 차단. inline 이미지 표시는 유지(Content-Disposition 미설정).
        registry.addInterceptor(new NoSniffInterceptor()).addPathPatterns(UPLOAD_URL_PATTERN);
    }

    /** {@code /uploads/**} 응답에 {@code X-Content-Type-Options: nosniff} 부착. */
    static class NoSniffInterceptor implements HandlerInterceptor {
        @Override
        public boolean preHandle(
                HttpServletRequest request, HttpServletResponse response, Object handler) {
            response.setHeader("X-Content-Type-Options", "nosniff");
            return true;
        }
    }
}
