package com.example.popspotbackend.config;

import java.nio.file.Paths;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
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
    }
}
