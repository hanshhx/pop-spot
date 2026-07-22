package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.service.ai.LlmUsageTracker;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PopupNormalizationServiceTest {

    private PopupNormalizationService service;

    @BeforeEach
    void setUp() {
        service = new PopupNormalizationService(null, new LlmUsageTracker());
    }

    @Test
    void 공식Url은_해당_sourceIndex의_정확한_URL만_허용한다() {
        List<PopupCrawlSource> snippets =
                List.of(
                        source(
                                "공식 안내 https://brand.example/event 예약 https://book.example/r/1",
                                "https://blog.naver.com/source-a"),
                        source(
                                "다른 팝업 https://other.example/event",
                                "https://blog.naver.com/source-b"));
        NormalizedPopup popup =
                NormalizedPopup.builder()
                        .sourceIndex(1)
                        .officialUrl("https://brand.example/event")
                        .reservationUrl("https://book.example/r/1")
                        .build();

        service.rejectUnsupportedUrls(popup, snippets);

        assertThat(popup.getOfficialUrl()).isEqualTo("https://brand.example/event");
        assertThat(popup.getReservationUrl()).isEqualTo("https://book.example/r/1");
    }

    @Test
    void 다른_팝업_URL과_출처글_URL과_부분문자열은_모두_거부한다() {
        List<PopupCrawlSource> snippets =
                List.of(
                        source(
                                "공식 안내 https://brand.example/event.evil",
                                "https://blog.naver.com/source-a"),
                        source(
                                "다른 팝업 예약 https://book.example/r/2",
                                "https://blog.naver.com/source-b"));

        NormalizedPopup crossPopup =
                NormalizedPopup.builder()
                        .sourceIndex(1)
                        .officialUrl("https://book.example/r/2")
                        .reservationUrl("https://blog.naver.com/source-a")
                        .build();
        service.rejectUnsupportedUrls(crossPopup, snippets);
        assertThat(crossPopup.getOfficialUrl()).isNull();
        assertThat(crossPopup.getReservationUrl()).isNull();

        NormalizedPopup prefixPopup =
                NormalizedPopup.builder()
                        .sourceIndex(1)
                        .officialUrl("https://brand.example/event")
                        .build();
        service.rejectUnsupportedUrls(prefixPopup, snippets);
        assertThat(prefixPopup.getOfficialUrl()).isNull();
    }

    @Test
    void sourceIndex가_없거나_범위를_벗어나면_URL을_허용하지_않는다() {
        List<PopupCrawlSource> snippets =
                List.of(source("공식 https://brand.example/event", "https://source.example"));
        NormalizedPopup popup =
                NormalizedPopup.builder()
                        .sourceIndex(2)
                        .officialUrl("https://brand.example/event")
                        .build();

        service.rejectUnsupportedUrls(popup, snippets);

        assertThat(popup.getOfficialUrl()).isNull();
    }

    private PopupCrawlSource source(String description, String link) {
        return PopupCrawlSource.builder()
                .sourceName("TEST")
                .title("제목")
                .description(description)
                .link(link)
                .build();
    }
}
