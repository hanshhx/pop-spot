package com.example.popspotbackend.config;

import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * LLM 설정 — Groq (OpenAI API 호환) 게이트웨이.
 *
 * <p><b>모델을 두 개로 나누는 이유.</b> Groq 무료 한도는 <b>조직 단위</b>로 적용되어 API 키를 나눠도 쿼터가 공유된다. 반면 한도는 <b>모델별</b>로
 * 따로 잡히므로, 서로 다른 모델을 쓰는 것이 기능 간 격리를 만드는 유일한 방법이다. 크롤러가 일일 토큰을 소진해도 사용자 기능(AI 검색 · 코스 · 음악)이 같이 죽지
 * 않게 분리한다.
 *
 * <p><b>병목은 RPD 가 아니라 TPD 다.</b> 무료 대체 모델 기준 RPD 1,000 · TPD 200K 인데, 고정 프롬프트만 1,970자(≈1,000~1,500
 * 토큰)라 스니펫이 0개여도 하루 150회 안팎이 상한이다. 키워드를 늘리기 전에 토큰 예산을 먼저 계산해야 한다.
 *
 * <p><b>하위 호환.</b> 기존 {@code GROQ_MODEL_NAME} 이 설정돼 있으면 두 모델 모두 그 값을 쓴다. 즉 이 변경만 배포해도 동작이 바뀌지 않는다.
 * 마이그레이션은 운영 env 에서 {@code AI_USER_MODEL} / {@code AI_CRAWLER_MODEL} 을 지정해 단계적으로 한다.
 */
@Slf4j
@Configuration
public class AiConfig {

    private static final double DEFAULT_TEMPERATURE = 0.7;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);

    /** 로컬 Ollama 는 자체 하드웨어 추론이라 클라우드보다 느리다. 7B 가 배치를 처리할 여유를 준다. */
    private static final Duration LOCAL_REQUEST_TIMEOUT = Duration.ofSeconds(180);

    /**
     * 2026-08-16 종료 예정 모델. 무료 · Developer 티어 대상이며 committed-spend Enterprise 만 제외된다.
     *
     * @see <a href="https://console.groq.com/docs/deprecations">Groq Model Deprecations</a>
     */
    private static final Set<String> RETIRING_MODELS =
            Set.of("llama-3.3-70b-versatile", "llama-3.1-8b-instant");

    private static final String RETIREMENT_DATE = "2026-08-16";

    @Value("${groq.api-key}")
    private String apiKey;

    @Value("${groq.base-url:https://api.groq.com/openai/v1}")
    private String baseUrl;

    /** 사용자 기능(AI 검색 · 코스 · 음악)용. 응답 품질이 사용자에게 직접 보이므로 큰 모델을 기본값으로 둔다. */
    @Value("${ai.user.model-name}")
    private String userModelName;

    /** 크롤러 정규화용. 구조화 추출이라 작은 모델로 충분하고, 호출량이 많아 사용자 기능과 예산을 나눠야 한다. */
    @Value("${ai.crawler.model-name}")
    private String crawlerModelName;

    /** 로컬 Ollama(4060 Ti PC) 크롤러 모델. {@code ai.crawler.local.enabled=true} 일 때만 빈이 만들어진다. */
    @Value("${ai.crawler.local.base-url:}")
    private String localBaseUrl;

    @Value("${ai.crawler.local.model-name:qwen2.5:7b}")
    private String localModelName;

    /**
     * 종료 예정 모델을 쓰고 있으면 부팅 로그에 남긴다.
     *
     * <p>운영 env 의 {@code GROQ_MODEL_NAME} 은 코드 기본값을 덮으므로, 코드만 고쳐서는 마이그레이션이 되지 않는다. 그 사실이 조용히 묻히지
     * 않도록 기동 때마다 경고한다.
     */
    @PostConstruct
    public void warnOnModelConfig() {
        warnIfRetiring("user", userModelName);
        warnIfRetiring("crawler", crawlerModelName);
        if (userModelName.equals(crawlerModelName)) {
            log.warn(
                    "[AiConfig] user/crawler 모델이 같습니다('{}'). 한도가 모델 단위라 이 상태에서는 격리가"
                            + " 걸리지 않아, 크롤러가 일일 토큰을 소진하면 사용자 AI 기능도 함께 실패합니다."
                            + " 운영 env 에서 GROQ_MODEL_NAME 을 제거하고 AI_USER_MODEL /"
                            + " AI_CRAWLER_MODEL 을 각각 지정하세요.",
                    userModelName);
        }
    }

    private void warnIfRetiring(String role, String model) {
        if (RETIRING_MODELS.contains(model)) {
            log.warn(
                    "[AiConfig] {} 모델 '{}' 은 {} 종료 예정입니다. 대체: gpt-oss-120b(품질) / gpt-oss-20b(경량)."
                            + " 운영 env 의 GROQ_MODEL_NAME 또는 AI_{}_MODEL 을 교체하세요.",
                    role,
                    model,
                    RETIREMENT_DATE,
                    role.toUpperCase());
        } else {
            log.info("[AiConfig] {} 모델: {}", role, model);
        }
    }

    /** 기본 주입 대상. 기존 {@code ChatLanguageModel} 주입부(AI 검색 · 코스 · 음악 3종)는 수정 없이 이 빈을 받는다. */
    @Bean
    @Primary
    public ChatLanguageModel userChatModel() {
        return build(userModelName);
    }

    /** 크롤러 전용(클라우드=Groq). {@code @Qualifier("crawlerChatModel")} 로 명시 주입해야 한다. */
    @Bean
    public ChatLanguageModel crawlerChatModel() {
        return build(crawlerModelName);
    }

    /**
     * 로컬 Ollama 크롤러 모델(4060 Ti PC).
     *
     * <p>{@code ai.crawler.local.enabled=true} 일 때만 생성된다 — 기본값이 false 라 이 코드를 배포해도 로컬을 켜기 전까지는 이 빈이
     * 없고 크롤러는 Groq 만 쓴다(동작 불변). Ollama 는 OpenAI 호환 API 를 제공하므로 baseUrl 만 로컬로 바꿔 같은 빌더를 쓴다. 인증은 하지
     * 않으므로 apiKey 는 더미다.
     */
    @Bean
    @ConditionalOnProperty(name = "ai.crawler.local.enabled", havingValue = "true")
    public ChatLanguageModel crawlerLocalChatModel() {
        if (localBaseUrl == null || localBaseUrl.isBlank()) {
            throw new IllegalStateException(
                    "ai.crawler.local.enabled=true 인데 base-url 이 비어 있습니다. AI_CRAWLER_LOCAL_BASE_URL"
                            + " 을 PC 의 Ollama 주소로 설정하세요(.env.example 참고).");
        }
        log.info("[AiConfig] 로컬 크롤러 모델 활성화 — {} @ {}", localModelName, localBaseUrl);
        return OpenAiChatModel.builder()
                .baseUrl(localBaseUrl)
                .apiKey("ollama")
                .modelName(localModelName)
                .temperature(DEFAULT_TEMPERATURE)
                .timeout(LOCAL_REQUEST_TIMEOUT)
                .build();
    }

    private ChatLanguageModel build(String modelName) {
        return OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(DEFAULT_TEMPERATURE)
                .timeout(REQUEST_TIMEOUT)
                .build();
    }
}
