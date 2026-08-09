package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 용어집이 <b>이름 전체를 덮는지</b> 본다. 하나라도 남으면 그 팝업은 번역되지 않는다.
 *
 * <p><b>왜 이게 커버리지를 정하는가.</b> {@code PopupTranslationService} 는 잠근 뒤에도 한글이 남아 있으면 <b>통째로 포기</b>한다 —
 * 모르는 한글을 LLM 이 추측하게 두면 "남대문" 이 "南山" 이 되는 식이라서다. 그래서 포켓몬을 알아도 "굿즈" 를 모르면 "포켓몬 굿즈 팝업" 전체가 스킵된다.
 *
 * <p>2026-08-09 기준 1047곳 중 번역된 것은 177곳뿐이었다. 막고 있던 낱말을 세어 보니 상위가 스토어(40)·서울(29)·카페(21)·전시(16) — 전부
 * <b>일반명사</b>였다. 이것들은 옮겨도 틀릴 여지가 없는데 이것 때문에 이름 전체가 버려지고 있었다.
 *
 * <p>아래 이름은 모두 <b>운영 데이터에서 그대로 가져왔다.</b>
 */
class GlossaryCoverageTest {

    private final PopupTranslationGlossary glossary = new PopupTranslationGlossary();

    private void covers(String name) {
        PopupTranslationGlossary.ProtectedText text = glossary.protect(name);

        assertThat(text.hasUnprotectedHangul())
                .describedAs("'%s' 에 아직 못 읽는 한글이 남아 번역이 통째로 버려진다 → 잠긴 뒤: %s", name, text.masked())
                .isFalse();
    }

    @Test
    @DisplayName("일반명사가 이름을 막지 않는다 — 커버리지를 가장 크게 올리는 자리")
    void commonWordsNoLongerBlock() {
        covers("포켓몬 굿즈 팝업스토어");
        covers("산리오 팝업 카페");
        covers("무신사 플래그십 스토어");
        covers("올리브영 뷰티 팝업");
        covers("귀멸의 칼날 전시");
    }

    @Test
    @DisplayName("운영에서 자주 나오던 이름이 이제 통째로 잠긴다")
    void realProductionNamesAreCovered() {
        covers("디즈니 곰돌이 푸 팝업");
        covers("쿠키런: 킹덤 위대한 왕국의 유산 특별전");
        covers("구찌 에디트 룸");
        covers("붕괴:스타레일 전시");
        covers("스파이더맨 팝업스토어");
        covers("더티니핑 시네마 에디션");
        covers("폼폼푸린 팝업 카페");
        covers("지드래곤 팝업스토어");
        covers("신세계백화점 팝업");
        covers("노브랜드 버거 팝업");
    }

    /**
     * 지명은 이름 안에 들어 있을 때가 많다. location 칸만 잠그고 name 을 음역으로 열어 둔 탓에 여기가 뚫려 있었고, 2026-08-09 시험 배치에서 실제로
     * 사고가 났다.
     *
     * <ul>
     *   <li>"…타임스퀘어 영등포" → {@code 江東区} — <b>서울 반대편이다.</b> 이대로면 관광객이 헛걸음한다.
     *   <li>"…서촌 팝업" → {@code seocheon} — 로마자가 그대로 샜다.
     *   <li>"…시흥 프리미엄 아울렛" → {@code シヘウン} — 읽기가 틀렸다.
     * </ul>
     *
     * <p>한남동은 더 고약했다. "한남" 만 잡히고 남은 "동" 을 모델이 방위로 읽어 {@code ハンナム東} 이 됐다. 그래서 "동" 이 붙은 형태도 따로 넣는다.
     */
    @Test
    @DisplayName("지명이 이름 안에 있어도 잠긴다 — 영등포가 강동구로 나온 적이 있다")
    void placeNamesInsideNamesAreLocked() {
        // 모르는 브랜드가 섞여 이름 전체는 못 덮는다. 그래도 지명만은 모델에게 넘어가면 안 된다 —
        // 브랜드가 어색한 건 읽는 사람이 알아채지만, 동네가 틀리면 그 사람이 헛걸음한다.
        locksPlace("베이시스 마운틴 베어 샌들 서촌 팝업", "서촌");
        locksPlace("널디 시흥 프리미엄 아울렛 팝업스토어", "시흥");
        locksPlace("라미블랑제리 한남동 카페", "한남동");

        // 이건 전부 아는 말이라 통째로 잠긴다.
        covers("지드래곤 팝업 타임스퀘어 영등포");
    }

    /**
     * 한남동은 <b>"한남" 만 잡히면 안 된다.</b> 남은 "동" 을 모델이 방위로 읽어 {@code ハンナム東} 이 됐다. 그래서 지명이 통째로 사라졌는지 본다 —
     * 조각이 남으면 이 검사가 걸린다.
     */
    private void locksPlace(String name, String place) {
        PopupTranslationGlossary.ProtectedText text = glossary.protect(name);

        assertThat(text.masked())
                .describedAs("'%s' 의 '%s' 가 모델에게 그대로 넘어간다 — 추측하면 다른 동네가 된다", name, place)
                .doesNotContain(place);
    }

    /**
     * 잠근다고 다 되는 것은 아니다 — <b>모르는 이름은 여전히 남아야 한다.</b>
     *
     * <p>여기서 억지로 통과시키면 LLM 이 추측하게 되고, 그게 "남대문 → 南山" 을 만든 경로다. 커버리지를 올리려고 이 방어선을 무너뜨리면 안 된다.
     */
    @Test
    @DisplayName("모르는 고유명사는 그대로 남는다 — 추측하게 두지 않는다")
    void unknownProperNounsStillBlock() {
        PopupTranslationGlossary.ProtectedText text = glossary.protect("안상규 하라버지 벌꿀 팝업");

        assertThat(text.hasUnprotectedHangul())
                .describedAs("모르는 소상공인 이름까지 통과시키면 지어내기 시작한다")
                .isTrue();
    }
}
