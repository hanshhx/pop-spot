package com.example.popspotbackend.service.ai;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.output.TokenUsage;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 사용자향 LLM 호출을 한 곳에서 계측한다(AI 검색·코스·음악).
 *
 * <p><b>왜 필요한가.</b> 각 서비스는 {@code chatLanguageModel.generate(String)} 을 직접 불렀는데, 그 방식은 두 가지가 안 됐다.
 * (1) {@code generate(String)} 은 {@link TokenUsage} 를 돌려주지 않아 사용자 AI 의 토큰 소비가 전혀 계측되지 않았고, (2) 어떤
 * 호출이 실제로 어떤 모델을 썼는지 로그에 남지 않았다. 크롤러 모델 격리가 실제로 걸렸는지 확인하려면 사용자 쪽에서도 "이 호출이 gpt-oss-120b 로 나갔다" 는
 * 런타임 증거가 있어야 한다. 호출 지점을 하나로 모아 {@link LlmUsageTracker.Role#USER} 로 계측하고 모델명을 남긴다.
 *
 * <p>주입되는 {@link ChatLanguageModel} 은 {@code @Qualifier} 가 없으므로 {@code @Primary} 인 사용자 모델
 * (gpt-oss-120b)이다. 크롤러는 {@code @Qualifier("crawlerChatModel")} 로 따로 주입받으므로 이 경로를 타지 않는다.
 */
@Slf4j
@Component
public class UserLlmInvoker {

    private final ChatLanguageModel model;
    private final LlmUsageTracker usageTracker;

    @Value("${ai.user.model-name:unknown}")
    private String modelName;

    public UserLlmInvoker(ChatLanguageModel model, LlmUsageTracker usageTracker) {
        this.model = model;
        this.usageTracker = usageTracker;
    }

    /**
     * 프롬프트를 한 번 호출하고 응답 텍스트를 돌려준다. 호출·응답·토큰을 계측하고 모델명을 로그에 남긴다.
     *
     * <p>{@code feature} 는 로그에서 어느 기능의 호출인지 식별하기 위한 라벨이다. 예외는 계측만 하고 그대로 올려, 각 서비스가 기존 방식대로 폴백을
     * 처리하게 둔다.
     */
    public String generate(String prompt, String feature) {
        usageTracker.recordAttempt(LlmUsageTracker.Role.USER);
        Response<AiMessage> response;
        try {
            // generate(String) 이 아니라 메시지 버전을 쓰는 이유: 이쪽만 TokenUsage 를 준다.
            response = model.generate(List.of(new UserMessage(prompt)));
        } catch (RuntimeException e) {
            usageTracker.recordFailure(LlmUsageTracker.Role.USER, LlmErrors.classify(e));
            throw e;
        }

        TokenUsage usage = response.tokenUsage();
        Integer inputTokens = usage != null ? usage.inputTokenCount() : null;
        Integer outputTokens = usage != null ? usage.outputTokenCount() : null;
        usageTracker.recordResponse(LlmUsageTracker.Role.USER, inputTokens, outputTokens);
        usageTracker.recordSuccess(LlmUsageTracker.Role.USER);

        log.info(
                "[UserLlm] {} — 모델 {}, 토큰 in {} / out {}",
                feature,
                modelName,
                inputTokens,
                outputTokens);
        return response.content().text();
    }
}
