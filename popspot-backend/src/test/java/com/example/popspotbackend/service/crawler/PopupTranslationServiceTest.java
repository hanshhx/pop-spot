package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.ai.CrawlerLlm;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 번역 결과를 <b>거르는</b> 부분을 고정한다.
 *
 * <p>실제 이름 60건으로 미리 재 봤을 때, 남은 실패는 대부분 확신 없이 지어낸 이름이었다. 그중에는 관광객을 다른 장소로 보내는 것도 있었다. 그래서 이 서비스의
 * 값어치는 번역 자체보다 <b>못 믿을 값을 버리는 데</b> 있다 — 버리면 화면에 한국어 원문이 나올 뿐이고, 잘못 채우면 사람이 헛걸음한다.
 */
class PopupTranslationServiceTest {

    private static PopupStore popup(long id, String name, String location) {
        return PopupStore.builder().id(id).name(name).location(location).build();
    }

    /** LLM 이 주어진 응답을 그대로 내놓도록 꾸민 서비스. */
    private static PopupTranslationService serviceReturning(String json) {
        ChatLanguageModel model = mock(ChatLanguageModel.class);
        when(model.generate(anyList())).thenReturn(Response.from(AiMessage.from(json)));

        CrawlerLlm llm = mock(CrawlerLlm.class);
        when(llm.select()).thenReturn(new CrawlerLlm.Selection(model, "test", true));

        return new PopupTranslationService(
                llm,
                mock(LlmUsageTracker.class),
                mock(OllamaTranslationClient.class),
                new PopupTranslationGlossary());
    }

    @Test
    @DisplayName("브랜드 원래 이름을 복원한 응답은 그대로 받는다")
    void keepsRestoredNames() {
        PopupStore p = popup(1L, "진격의 거인 팝업스토어", "서울 더현대 서울");
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":1,"nameEn":"ZXQTERM0QXZ ZXQTERM1QXZ","nameJa":"ZXQTERM0QXZ ZXQTERM1QXZ",
                          "locationEn":"ZXQTERM1QXZ ZXQTERM0QXZ","locationJa":"ZXQTERM1QXZ ZXQTERM0QXZ"}]
                        """);

        Map<Long, PopupTranslationService.Translated> out = service.translate(List.of(p));

        assertThat(out).containsKey(1L);
        assertThat(out.get(1L).nameEn()).isEqualTo("Attack on Titan Pop-up Store");
        assertThat(out.get(1L).locationJa()).isEqualTo("ソウル ザ・ヒョンデ・ソウル");
    }

    @Test
    @DisplayName("원문을 그대로 돌려준 칸은 버린다 — 번역하지 못했다는 뜻이다")
    void dropsEchoedOriginal() {
        PopupStore p = popup(2L, "한복상점", "서울 종로구");
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":2,"nameEn":"한복상점","nameJa":"한복상점","locationEn":null,"locationJa":null}]
                        """);

        Map<Long, PopupTranslationService.Translated> out = service.translate(List.of(p));

        assertThat(out).containsKey(2L);
        assertThat(out.get(2L).isEmpty()).isTrue();
    }

    @Test
    @DisplayName("영어·일본어 칸에 한글이 남아 있으면 버린다")
    void dropsPartiallyTranslated() {
        PopupStore p = popup(3L, "성수 치이카와 팝업", null);
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":3,"nameEn":"Seongsu ZXQTERM0QXZ ZXQTERM1QXZ","nameJa":"ソンス ZXQTERM0QXZ ZXQTERM1QXZ"}]
                        """);

        Map<Long, PopupTranslationService.Translated> out = service.translate(List.of(p));

        // 확인되지 않은 '성수'가 남아 있었던 예전 응답을 가정한다. 부분 번역은 두 언어 모두 버린다.
        assertThat(out.get(3L).nameEn()).isNull();
        assertThat(out.get(3L).nameJa()).isNull();
    }

    @Test
    @DisplayName("입력에 없던 id 를 지어내면 무시한다")
    void ignoresHallucinatedIds() {
        PopupStore p = popup(4L, "에르메스 팝업", null);
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":4,"nameEn":"ZXQTERM0QXZ ZXQTERM1QXZ"},{"id":999,"nameEn":"Ghost Pop-up"}]
                        """);

        Map<Long, PopupTranslationService.Translated> out = service.translate(List.of(p));

        assertThat(out).containsOnlyKeys(4L);
    }

    @Test
    @DisplayName("응답이 깨져도 예외를 밖으로 내보내지 않는다 — 번역은 있으면 좋은 것이다")
    void survivesBrokenResponse() {
        PopupStore p = popup(5L, "니텐도 서울 팝업스토어", null);
        PopupTranslationService service = serviceReturning("이건 JSON 이 아니다");

        assertThat(service.translate(List.of(p))).isEmpty();
    }

    @Test
    @DisplayName("Ollama 전용 모드에서는 로컬이 꺼져도 Groq로 넘어가지 않는다")
    void localOnlyNeverFallsBackToCloud() {
        CrawlerLlm llm = mock(CrawlerLlm.class);
        OllamaTranslationClient local = mock(OllamaTranslationClient.class);
        when(local.isAvailable()).thenReturn(false);
        PopupTranslationService service =
                new PopupTranslationService(
                        llm, mock(LlmUsageTracker.class), local, new PopupTranslationGlossary());
        ReflectionTestUtils.setField(service, "localOnly", true);

        assertThat(service.translate(List.of(popup(8L, "원피스 팝업", null)))).isEmpty();
        verifyNoInteractions(llm);
    }

    @Test
    @DisplayName("응답에서 id가 빠지면 시도 시각을 남기지 않아 다음 회차에 재시도한다")
    void doesNotStampWhenResponseOmitsId() {
        PopupStore p = popup(6L, "방배 한바퀴", null);
        PopupTranslationService service = serviceReturning("[]");

        service.applyAll(List.of(p), service.translate(List.of(p)));

        assertThat(p.getTranslatedAt()).isNull();
        assertThat(p.getNameEn()).isNull();
    }

    @Test
    @DisplayName("원문은 절대 건드리지 않는다 — 지역 분류가 이 값을 쓴다")
    void neverTouchesOriginal() {
        PopupStore p = popup(7L, "블루보틀 성수 팝업", "서울 성동구 성수동");
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":7,"nameEn":"ZXQTERM0QXZ ZXQTERM2QXZ ZXQTERM1QXZ",
                          "locationEn":"ZXQTERM2QXZ ZXQTERM1QXZ ZXQTERM0QXZ"}]
                        """);

        service.applyAll(List.of(p), service.translate(List.of(p)));

        assertThat(p.getName()).isEqualTo("블루보틀 성수 팝업");
        assertThat(p.getLocation()).isEqualTo("서울 성동구 성수동");
        assertThat(p.getNameEn()).isEqualTo("Blue Bottle Coffee Seongsu Pop-up");
    }

    @Test
    @DisplayName("이미 검증해 저장한 언어는 재백필이 덮어쓰지 않는다")
    void preservesExistingTranslationWhileFillingMissingLanguage() {
        PopupStore p = popup(9L, "원피스 팝업", null);
        p.setNameEn("Verified ONE PIECE Event");
        PopupTranslationService service =
                serviceReturning(
                        """
                        [{"id":9,"nameEn":"ZXQTERM0QXZ ZXQTERM1QXZ","nameJa":"ZXQTERM0QXZ ZXQTERM1QXZ"}]
                        """);

        service.applyAll(List.of(p), service.translate(List.of(p)));

        assertThat(p.getNameEn()).isEqualTo("Verified ONE PIECE Event");
        assertThat(p.getNameJa()).isEqualTo("ONE PIECE ポップアップ");
    }
}
