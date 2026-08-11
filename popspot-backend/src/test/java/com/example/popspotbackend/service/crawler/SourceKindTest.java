package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 글의 성격으로 채택 여부를 가른다.
 *
 * <p>2026-08-11 에 마감일이 없어 색인에서 빠진 팝업 30건의 원문을 열어 봤더니, 셋 중 하나는 그 팝업을 다룬 글이 아니었다 — 육아일기·그림책 전시 안내·"여름
 * 야호" 같은 일상 글에서 팝업을 뽑아내고 있었다.
 *
 * <p>기존 신뢰도 게이트(0.8)로는 못 걸렀다. 그 값은 "이 팝업이 실재하는가" 를 재는데 위 경우 팝업은 <b>실재하기</b> 때문이다. 글쓴이가 진짜 다녀왔다. 모델이
 * 틀린 게 아니라 우리가 묻지 않은 질문이 있었다.
 */
class SourceKindTest {

    @Test
    @DisplayName("스쳐 지나간 언급은 막는다 — 육아일기에서 포켓몬 팝업을 뽑아냈다")
    void mentionIsRejected() {
        assertThat(SourceKind.MENTION.acceptable()).isFalse();
    }

    /**
     * 후기는 통과시킨다.
     *
     * <p>진행 중인 팝업의 후기는 그 팝업이 실재한다는 증거다. 다만 후기에는 기간이 적혀 있지 않아 — 다녀온 사람은 "8/3~8/17" 이 아니라 "다녀왔어요" 라고
     * 쓴다 — 마감일이 비고, 그래서 색인 자격을 얻지 못한다. 그 판단은 자격 판정이 따로 한다. 여기서 두 번 막지 않는다.
     */
    @Test
    @DisplayName("후기와 공지는 통과시킨다 — 후기도 팝업이 실재한다는 증거다")
    void reviewAndAnnouncementPass() {
        assertThat(SourceKind.ANNOUNCEMENT.acceptable()).isTrue();
        assertThat(SourceKind.REVIEW.acceptable()).isTrue();
    }

    /**
     * 모르는 값은 통과시킨다.
     *
     * <p>이 필드는 새로 넣은 것이라 모델이 얼마나 자주 빠뜨리는지 아직 모른다. 모르는 것을 막는 쪽으로 기울이면 <b>수집이 통째로 멈출 수 있다</b> — 모델이
     * 필드를 안 주는 순간 모든 팝업이 버려진다. 새 검사는 확실히 나쁜 것만 막고 시작한다.
     */
    @Test
    @DisplayName("모델이 값을 안 주면 통과시킨다 — 새 검사가 수집을 멈추면 안 된다")
    void unknownPassesSoTheCrawlerKeepsWorking() {
        assertThat(SourceKind.parse(null)).isEqualTo(SourceKind.UNKNOWN);
        assertThat(SourceKind.UNKNOWN.acceptable()).isTrue();
    }

    @Test
    @DisplayName("대소문자·공백이 섞여도 읽는다")
    void parsesLoosely() {
        assertThat(SourceKind.parse(" mention ")).isEqualTo(SourceKind.MENTION);
        assertThat(SourceKind.parse("Review")).isEqualTo(SourceKind.REVIEW);
        assertThat(SourceKind.parse("ANNOUNCEMENT")).isEqualTo(SourceKind.ANNOUNCEMENT);
    }

    @Test
    @DisplayName("알 수 없는 문자열은 UNKNOWN 이다 — 임의로 해석하지 않는다")
    void unrecognizedBecomesUnknown() {
        assertThat(SourceKind.parse("후기")).isEqualTo(SourceKind.UNKNOWN);
        assertThat(SourceKind.parse("")).isEqualTo(SourceKind.UNKNOWN);
        assertThat(SourceKind.parse("ADVERTISEMENT")).isEqualTo(SourceKind.UNKNOWN);
    }
}
