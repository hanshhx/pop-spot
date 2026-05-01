package com.example.popspotbackend.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.time.Duration;

/**
 * LLM 설정 — Groq (OpenAI API 호환) 사용.
 *
 *  - 무료 한도: 14,400 req/day (Gemini Free 의 ~720배)
 *  - 모델 추천: llama-3.3-70b-versatile (품질) / llama-3.1-8b-instant (속도)
 *  - Endpoint: https://api.groq.com/openai/v1
 *
 *  application.properties 의 groq.* 설정과 환경변수 GROQ_API_KEY 를 사용.
 */
@Configuration
public class AiConfig {

    @Value("${groq.api-key}")
    private String apiKey;

    /** Groq 모델명. 기본 llama-3.3-70b-versatile (Gemini 2.0-flash 와 비슷한 품질) */
    @Value("${groq.model-name:llama-3.3-70b-versatile}")
    private String modelName;

    /** Groq endpoint (OpenAI 호환). 다른 OpenAI 호환 서비스로 바꿀 수도 있음. */
    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String baseUrl;

    @Bean
    @Primary
    public ChatLanguageModel chatLanguageModel() {
        return OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(0.7)
                .timeout(Duration.ofSeconds(60))
                .build();
    }
}
