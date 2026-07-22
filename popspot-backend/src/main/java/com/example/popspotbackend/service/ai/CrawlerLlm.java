package com.example.popspotbackend.service.ai;

import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 크롤러가 이번 호출에 쓸 LLM 을 고른다 — 로컬 Ollama(켜져 있으면) 또는 Groq(fallback).
 *
 * <p><b>왜 이렇게 나누는가.</b> PC(4060 Ti)를 강제로 켜둘 필요가 없게 하려는 것이 목표다. 켜져 있으면 무제한인 로컬로, 꺼져 있으면 rate limit 이
 * 있는 Groq 로 돌린다. 사용자가 PC 를 켜는 만큼 수집이 늘고, 안 켜도 서비스는 그대로다.
 *
 * <p><b>로컬 빈은 없을 수 있다.</b> {@code crawlerLocalChatModel} 은 {@code ai.crawler.local.enabled=true} 일
 * 때만 생성되므로, 비활성 환경에서는 주입되지 않는다({@code required=false}). 그 경우 {@link #select()} 는 항상 Groq 를 돌려준다.
 */
@Slf4j
@Component
public class CrawlerLlm {

    private final ChatLanguageModel cloudModel;
    private final OllamaHealthChecker healthChecker;

    /** {@code ai.crawler.local.enabled=false} 면 빈이 없어 null 이다. */
    @Autowired(required = false)
    @Qualifier("crawlerLocalChatModel")
    private ChatLanguageModel localModel;

    @Value("${ai.crawler.model-name:unknown}")
    private String cloudModelName;

    @Value("${ai.crawler.local.model-name:qwen2.5:7b}")
    private String localModelName;

    public CrawlerLlm(
            @Qualifier("crawlerChatModel") ChatLanguageModel cloudModel,
            OllamaHealthChecker healthChecker) {
        this.cloudModel = cloudModel;
        this.healthChecker = healthChecker;
    }

    /** 선택된 모델과 그 이름, 로컬 여부. 이름·로컬여부는 계측·로깅에 쓴다. */
    public record Selection(ChatLanguageModel model, String modelName, boolean local) {}

    /**
     * 이번 호출에 쓸 모델을 고른다. 로컬 빈이 있고 PC 가 응답하면 로컬, 그 외에는 Groq.
     *
     * <p>헬스체크는 {@link OllamaHealthChecker} 가 짧게 캐시하므로 회차 중 여러 번 불러도 비용이 없다.
     */
    public Selection select() {
        if (localModel != null && healthChecker.isAvailable()) {
            return new Selection(localModel, localModelName, true);
        }
        return new Selection(cloudModel, cloudModelName, false);
    }
}
