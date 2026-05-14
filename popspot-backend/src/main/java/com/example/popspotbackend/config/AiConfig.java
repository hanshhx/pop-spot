package com.example.popspotbackend.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * LLM 설정 — Groq (OpenAI API 호환) 게이트웨이.
 *
 * <p>무료 한도 14,400 req/day. 기본 모델은 품질 기준의 {@code llama-3.3-70b-versatile} 이며 속도가 더 필요하면 {@code
 * llama-3.1-8b-instant} 로 환경변수에서 교체할 수 있다. Endpoint 도 환경변수로 다른 OpenAI 호환 서비스로 바꿀 수 있다.
 */
@Configuration
public class AiConfig {

    private static final double DEFAULT_TEMPERATURE = 0.7;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.model-name:llama-3.3-70b-versatile}")
    private String modelName;

    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String baseUrl;

    @Bean
    @Primary
    public ChatLanguageModel chatLanguageModel() {
        return OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(DEFAULT_TEMPERATURE)
                .timeout(REQUEST_TIMEOUT)
                .build();
    }
}
