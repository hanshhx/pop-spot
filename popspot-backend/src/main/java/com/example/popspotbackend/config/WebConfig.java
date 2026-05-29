package com.example.popspotbackend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

    @Value("${app.upload.path}")
    private String uploadPath;

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String resourcePath = Paths.get(uploadPath).toUri().toString();
        log.info("[WebConfig] 업로드 폴더 매핑: {} → {}", UPLOAD_URL_PATTERN, resourcePath);
        registry.addResourceHandler(UPLOAD_URL_PATTERN).addResourceLocations(resourcePath);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor).addPathPatterns(AUTH_PATH_PATTERN);
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
