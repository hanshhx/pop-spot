package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.service.ai.CrawlerLlm;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import com.example.popspotbackend.service.ai.OllamaHealthChecker;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PopupNormalizationFallbackTest {

    @Test
    void 로컬_추론이_실패하면_Groq로_한번_대체하고_실제모델명을_반환한다() {
        ChatLanguageModel local = mock(ChatLanguageModel.class);
        ChatLanguageModel cloud = mock(ChatLanguageModel.class);
        OllamaHealthChecker health = mock(OllamaHealthChecker.class);
        when(health.isAvailable()).thenReturn(true);
        when(local.generate(anyList())).thenThrow(new RuntimeException("model not found"));
        when(cloud.generate(anyList())).thenReturn(Response.from(AiMessage.from("[]")));

        CrawlerLlm crawlerLlm = new CrawlerLlm(cloud, health);
        ReflectionTestUtils.setField(crawlerLlm, "localModel", local);
        ReflectionTestUtils.setField(crawlerLlm, "localModelName", "qwen2.5:7b");
        ReflectionTestUtils.setField(crawlerLlm, "cloudModelName", "openai/gpt-oss-20b");

        LlmUsageTracker usage = new LlmUsageTracker();
        PopupNormalizationService service = new PopupNormalizationService(crawlerLlm, usage);
        ReflectionTestUtils.setField(service, "maxSnippetsPerRequest", 12);

        PopupNormalizationService.NormalizationBatch result =
                service.normalizeBatch(
                        List.of(
                                PopupCrawlSource.builder()
                                        .sourceName("TEST")
                                        .title("서울 테스트 팝업")
                                        .description("서울 성동구 테스트 팝업")
                                        .link("https://example.com/source")
                                        .build()));

        assertThat(result.modelName()).isEqualTo("openai/gpt-oss-20b");
        assertThat(result.local()).isFalse();
        assertThat(usage.today(LlmUsageTracker.Role.CRAWLER).attempts()).isEqualTo(2);
    }
}
