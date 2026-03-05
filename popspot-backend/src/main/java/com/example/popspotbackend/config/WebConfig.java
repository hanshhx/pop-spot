package com.example.popspotbackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // [로직] application.properties에 설정한 업로드 폴더 경로를 가져옵니다.
    @Value("${app.upload.path}")
    private String uploadPath;

    /**
     * 💣 폭탄 제거 완료:
     * 원래 이 자리에 있던 addCorsMappings 메서드를 삭제했습니다.
     * 이유: SecurityConfig에서 CORS를 이미 잡고 있는데 여기서 또 잡으면
     * 스프링이 "누구 말을 들어야 해?" 하고 헷갈려서 403 에러(Invalid CORS request)를 뱉기 때문입니다.
     */

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // [로직] 서버의 실제 물리적 경로(절대 경로)를 URI 형태로 변환합니다. (예: file:///home/...)
        String resourcePath = Paths.get(uploadPath).toUri().toString();

        // [구조 분석]
        // 1. registry.addResourceHandler("/uploads/**"):
        //    브라우저가 "https://도메인/uploads/사진.jpg"라고 요청하면 나(스프링)를 찾아오게 합니다.
        // 2. addResourceLocations(resourcePath):
        //    찾아온 브라우저에게 "실제 사진은 서버의 이 폴더 안에 있어!"라고 연결해 줍니다.

        System.out.println("==================================================");
        System.out.println("📂 [WebConfig] 이미지 서버 경로 매핑 활성화");
        System.out.println("🔗 접근 주소: /uploads/**");
        System.out.println("📂 실제 경로: " + resourcePath);
        System.out.println("==================================================");

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(resourcePath);
    }
}