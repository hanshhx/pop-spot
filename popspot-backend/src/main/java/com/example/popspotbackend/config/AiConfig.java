package com.example.popspotbackend.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import java.time.Duration; // 🔥 이 import 문이 꼭 필요합니다!

@Configuration
public class AiConfig {

    @Value("${langchain4j.google-ai-gemini.chat-model.api-key}")
    private String apiKey;

    @Bean
    @Primary
    public ChatLanguageModel chatLanguageModel() {
        System.out.println("🚀 [AiConfig] Gemini 2.5 Flash 모델 (타임아웃 60초) 적용 중...");

        return GoogleAiGeminiChatModel.builder()
                .apiKey(apiKey)
                .modelName("gemini-2.5-flash")
                .temperature(0.7)
                // 🔥 [핵심 수정] 타임아웃을 60초(1분)로 늘립니다. (기본값은 보통 10~30초임)
                .timeout(Duration.ofSeconds(60))
                .build();
    }
}