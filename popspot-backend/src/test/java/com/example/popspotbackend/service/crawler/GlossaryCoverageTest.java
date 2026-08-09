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
