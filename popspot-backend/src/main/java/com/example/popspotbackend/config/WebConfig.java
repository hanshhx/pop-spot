package com.example.popspotbackend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * MVC 설정.
 *
 * - 업로드 폴더 정적 매핑 (/uploads/**)
 * - Rate Limit Interceptor 등록 (브루트포스/이메일 폭탄 방어)
 *
 * 주의: addCorsMappings 는 의도적으로 비워둔다.
 *   → SecurityConfig#corsConfigurationSource 가 단일 진실 공급원(SSOT). 두 곳에서 잡으면 충돌해 invalid CORS 가 난다.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.path}")
    private String uploadPath;

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String resourcePath = Paths.get(uploadPath).toUri().toString();

        log.info("📂 [WebConfig] 업로드 폴더 매핑: /uploads/** → {}", resourcePath);

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(resourcePath);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/v1/auth/**");
    }
}
