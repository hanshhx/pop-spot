package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PopupTranslationGlossaryTest {

    private final PopupTranslationGlossary glossary = new PopupTranslationGlossary();

    @Test
    void restoresVerifiedIpWithoutLettingTheModelRewriteIt() {
        PopupTranslationGlossary.ProtectedText text = glossary.protect("외모지상주의 팝업스토어");

        assertThat(text.hasUnprotectedHangul()).isFalse();
        assertThat(text.properNameFound()).isTrue();
        assertThat(text.restoreEnglish("ZXQTERM0QXZ ZXQTERM1QXZ"))
                .isEqualTo("Lookism Pop-up Store");
        assertThat(text.restoreJapanese("ZXQTERM0QXZ ZXQTERM1QXZ")).isEqualTo("外見至上主義 ポップアップストア");
    }

    @Test
    void rejectsResponseThatDropsProtectedName() {
        PopupTranslationGlossary.ProtectedText text = glossary.protect("짱구 팝업스토어");

        assertThat(text.restoreEnglish("Pop-up Store")).isNull();
    }

    /**
     * 운영 데이터에서 <b>실제로 틀리게 나온</b> 이름들이다.
     *
     * <p>2026-08-06 기준 지도 984곳 중 일본어 이름이 있는 170곳을 눈으로 훑어 뽑았다 — 명탐정 코난이 {@code コナン・ハイウェイへの天国の扉},
     * 마이멜로디 하모니가 {@code ヒーメナ}, 남대문잡채호떡이 <b>중국어</b>({@code 南山拌菜熱米糕})로 나왔다. 남대문을 南山으로 옮긴 것은 지명 자체가 틀린
     * 것이라 관광객을 다른 동네로 보낸다.
     *
     * <p>이 목록은 "모델이 알아서 잘하겠지" 가 통하지 않는다는 증거다. 잠가 두면 모델은 이 자리를 건드릴 수 없다.
     */
    @Test
    void locksNamesThatProductionGotWrong() {
        record Case(String source, String english, String japanese) {}

        for (Case c :
                new Case[] {
                    new Case("명탐정 코난 팝업스토어", "Detective Conan", "名探偵コナン"),
                    new Case("하이큐 10주년 굿즈 팝업", "Haikyu!!", "ハイキュー!!"),
                    new Case("마이멜로디 하모니 카페", "My Melody", "マイメロディ"),
                    new Case("닌텐도 슈퍼 마리오 팝업스토어", "Super Mario", "スーパーマリオ"),
                    new Case("네이버웹툰 팝업스토어", "NAVER WEBTOON", "ネイバーウェブトゥーン"),
                    new Case("남대문잡채호떡 팝업스토어", "Namdaemun", "南大門"),
                    new Case("토니모리 언커먼 팩토리", "TONYMOLY", "トニーモリー"),
                    new Case("라네즈 팝업스토어", "LANEIGE", "ラネージュ"),
                    new Case("설화수의 집", "Sulwhasoo", "雪花秀"),
                    new Case("스파이패밀리 팝업", "SPY×FAMILY", "SPY×FAMILY"),
                    new Case("아크시스템웍스 아시아 10주년 팝업", "Arc System Works", "アークシステムワークス"),
                }) {
            PopupTranslationGlossary.ProtectedText text = glossary.protect(c.source());

            assertThat(text.properNameFound())
                    .describedAs("'%s' 가 아직 잠기지 않는다 — 모델이 마음대로 옮긴다", c.source())
                    .isTrue();
            assertThat(text.restoreEnglish(text.masked()))
                    .describedAs("'%s' 의 영어 표기", c.source())
                    .contains(c.english());
            assertThat(text.restoreJapanese(text.masked()))
                    .describedAs("'%s' 의 일본어 표기", c.source())
                    .contains(c.japanese());
        }
    }

    /**
     * 별칭 매칭은 <b>단순 부분 문자열</b>이다. 짧은 별칭을 넣으면 엉뚱한 이름을 삼킨다.
     *
     * <p>"마리오" 를 그대로 넣으면 서울에 실재하는 <b>마리오아울렛</b>이 {@code スーパーマリオアウトレット} 가 된다 — 없는 곳을 안내하는 셈이다. 그래서
     * 슈퍼마리오는 "슈퍼마리오" 로만 잠근다.
     *
     * <p>이 테스트가 없으면 용어집을 늘릴 때마다 이런 충돌이 조용히 늘어난다.
     */
    @Test
    void shortAliasesDoNotSwallowUnrelatedNames() {
        /*
         * 마리오아울렛은 이제 용어집에 제 이름으로 들어가 있다. 그래서 masked 에는 원문이 아니라 토큰이
         * 남는다 — "원문이 그대로 있나" 로는 더 이상 볼 수 없다.
         *
         * 확인해야 할 것은 처음부터 하나였다. 슈퍼마리오로 바뀌지 않는가.
         */
        PopupTranslationGlossary.ProtectedText mall = glossary.protect("마리오아울렛 팝업");

        assertThat(mall.restoreJapanese(mall.masked()))
                .describedAs("마리오아울렛은 영등포에 실재하는 쇼핑몰이다. 슈퍼마리오로 바꾸면 없는 곳을 안내한다")
                .contains("マリオアウトレット")
                .doesNotContain("スーパーマリオ");

        assertThat(glossary.protect("코난도일 북페어").masked())
                .describedAs("코난 도일(작가)은 명탐정 코난이 아니다")
                .contains("코난도일");
    }

    @Test
    void exposesUnknownKoreanProperNounForConservativeSkip() {
        PopupTranslationGlossary.ProtectedText text = glossary.protect("레고트 x 포켓몬 콜라보 팝업스토어");

        assertThat(text.properNameFound()).isTrue();
        assertThat(text.hasUnprotectedHangul()).isTrue();
    }
}
