package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.service.crawler.PopupNormalizationService.DateStats;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 날짜 추출 성적 계기판.
 *
 * <p><b>왜 이 검사가 필요한가.</b> 예전 계기판은 "시작일 <b>또는</b> 종료일이 있으면 추출 성공" 으로 셌다. 그런데 실측(2026-09-02)에서 색인을 막는
 * 가장 큰 원인은 <b>종료일만 없는 팝업 798건(44.7%)</b> 이었고, 그것들은 전부 시작일이 있어서 옛 셈법에서는 "성공" 으로 잡혔다 — 계기판이 있는데 정작 우리
 * 고장을 못 보는 자리에 달려 있었다.
 *
 * <p>여기서 지키는 것은 <b>고칠 수 있는 것과 없는 것을 가르는 능력</b>이다. 원문에 "8월 3일까지" 가 적혀 있는데 못 뽑았다면 프롬프트를 손볼 값어치가 있고,
 * 원문에 끝이 아예 없었다면 어떤 프롬프트로도 못 늘린다. 이 구분이 무너지면 대책이 다시 추측이 된다.
 */
class DateExtractionStatsTest {

    private static PopupCrawlSource snippet(String title, String description) {
        return PopupCrawlSource.builder().title(title).description(description).build();
    }

    private static NormalizedPopup popup(String start, String end, Integer sourceIndex) {
        return NormalizedPopup.builder()
                .name("○○ 팝업스토어")
                .startDate(start)
                .endDate(end)
                .sourceIndex(sourceIndex)
                .build();
    }

    private static final List<PopupCrawlSource> ONE_SNIPPET_WITH_END =
            List.of(snippet("성수 팝업 오픈", "7월 22일부터 8월 3일까지 진행합니다"));

    private static final List<PopupCrawlSource> ONE_SNIPPET_NO_END =
            List.of(snippet("성수 팝업 오픈", "7월 22일 오픈했습니다. 많이 와주세요"));

    @Test
    @DisplayName("종료일이 있으면 성공으로 센다")
    void countsPopupsWithEndDate() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup("2026-07-22", "2026-08-03", 1)), ONE_SNIPPET_WITH_END);

        assertThat(stats.total()).isEqualTo(1);
        assertThat(stats.hasEnd()).isEqualTo(1);
        assertThat(stats.startOnly().total()).isZero();
        assertThat(stats.noDate().total()).isZero();
    }

    /**
     * 이 검사가 이 파일의 존재 이유다.
     *
     * <p>옛 셈법("시작일 또는 종료일")이면 이것이 <b>추출 성공</b>으로 잡혀, 798건짜리 병목이 계기판에 한 건도 안 나타난다.
     */
    @Test
    @DisplayName("시작일만 있는 것을 성공으로 세지 않는다 — 색인을 막는 바로 그 부류다")
    void startOnlyIsNotCountedAsSuccess() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup("2026-07-22", null, 1)), ONE_SNIPPET_NO_END);

        assertThat(stats.hasEnd()).isZero();
        assertThat(stats.startOnly().total()).isEqualTo(1);
    }

    /* 원문에 끝이 적혀 있는데 못 뽑았다 — 프롬프트·모델을 손볼 값어치가 있는 쪽. */
    @Test
    @DisplayName("원문에 끝 표현이 있었으면 '추출 실패' 로 가른다")
    void splitsRecoverableMisses() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup("2026-07-22", null, 1)), ONE_SNIPPET_WITH_END);

        assertThat(stats.startOnly().withHint()).isEqualTo(1);
        assertThat(stats.startOnly().noHint()).isZero();
    }

    /* 원문에 끝이 아예 없었다 — 어떤 프롬프트로도 못 늘린다. 여기에 힘을 쓰면 안 된다. */
    @Test
    @DisplayName("원문에 끝 표현이 없었으면 '원문 한계' 로 가른다")
    void splitsUnrecoverableMisses() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup("2026-07-22", null, 1)), ONE_SNIPPET_NO_END);

        assertThat(stats.startOnly().noHint()).isEqualTo(1);
        assertThat(stats.startOnly().withHint()).isZero();
    }

    @Test
    @DisplayName("끝을 가리키는 여러 표현을 잡는다")
    void recognizesVariousEndExpressions() {
        List.of("8월 3일까지 운영", "7.22~8.3", "7월 22일 오픈, 3일간 진행", "이틀 동안만 열립니다", "8월 3일 종료")
                .forEach(
                        text -> {
                            DateStats stats =
                                    PopupNormalizationService.tallyDates(
                                            List.of(popup("2026-07-22", null, 1)),
                                            List.of(snippet("팝업", text)));
                            assertThat(stats.startOnly().withHint())
                                    .as("끝 표현으로 봐야 한다: %s", text)
                                    .isEqualTo(1);
                        });
    }

    /*
     * 날짜가 하나도 없는 쪽은 예전 계기판이 보던 것이다(v2.45 이후 버려진다). 종료일 축을 새로 넣으면서
     * 이쪽을 잃으면, 버려지는 이유를 다시 못 보게 된다.
     */
    @Test
    @DisplayName("날짜가 하나도 없는 것은 따로 센다 — 이쪽은 버려지는 부류다")
    void keepsNoDateAxis() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup(null, null, 1)), ONE_SNIPPET_WITH_END);

        assertThat(stats.noDate().total()).isEqualTo(1);
        assertThat(stats.noDate().withHint()).isEqualTo(1);
        assertThat(stats.startOnly().total()).isZero();
    }

    /*
     * 근거를 모르면 어느 쪽에도 넣지 않는다. 모르는 것을 한쪽에 몰아 넣으면 그 수치가 오히려 오판을 만든다 —
     * "원문에 없었다" 가 부풀면 고칠 수 있는 문제를 못 고칠 것으로 판단하게 된다.
     */
    @Test
    @DisplayName("근거 스니펫을 못 찾으면 판정에서 뺀다")
    void doesNotGuessWhenSourceUnknown() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(popup("2026-07-22", null, null), popup("2026-07-22", null, 99)),
                        ONE_SNIPPET_WITH_END);

        assertThat(stats.startOnly().unknownSource()).isEqualTo(2);
        assertThat(stats.startOnly().withHint()).isZero();
        assertThat(stats.startOnly().noHint()).isZero();
    }

    @Test
    @DisplayName("스니펫 목록이 비어 있거나 없어도 터지지 않는다")
    void survivesMissingSnippets() {
        assertThat(
                        PopupNormalizationService.tallyDates(
                                        List.of(popup("2026-07-22", null, 1)), List.of())
                                .startOnly()
                                .unknownSource())
                .isEqualTo(1);
        assertThat(
                        PopupNormalizationService.tallyDates(
                                        List.of(popup("2026-07-22", null, 1)), null)
                                .startOnly()
                                .unknownSource())
                .isEqualTo(1);
        assertThat(PopupNormalizationService.tallyDates(List.of(), null).total()).isZero();
    }

    @Test
    @DisplayName("세 부류의 합이 전체와 같다 — 어느 하나도 새지 않는다")
    void bucketsCoverEverything() {
        DateStats stats =
                PopupNormalizationService.tallyDates(
                        List.of(
                                popup("2026-07-22", "2026-08-03", 1),
                                popup("2026-07-22", null, 1),
                                popup(null, null, 1),
                                popup("2026-07-22", null, 99)),
                        ONE_SNIPPET_WITH_END);

        assertThat(stats.hasEnd() + stats.startOnly().total() + stats.noDate().total())
                .isEqualTo(stats.total());
    }
}
