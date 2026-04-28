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

    /** application.properties 의 GEMINI_MODEL_NAME 환경변수 사용 (기본 2.0-flash) */
    @Value("${langchain4j.google-ai-gemini.chat-model.model-name:gemini-2.0-flash}")
    private String modelName;

    @Bean
    @Primary
    public ChatLanguageModel chatLanguageModel() {
        // 무료 티어 한도: gemini-2.0-flash 가 2.5-flash 보다 RPM/RPD 더 관대
        return GoogleAiGeminiChatModel.builder()
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(0.7)
                .timeout(Duration.ofSeconds(60))
                .build();
    }
}