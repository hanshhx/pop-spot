package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 일본어 결과가 <b>내보내도 되는 값인지</b> 기계로 거른다.
 *
 * <p><b>왜 지금 필요한가.</b> 지금까지는 "용어집으로 다 알아본 이름만 번역" 이라 출력이 안전했다. 커버리지가 17% 에서 안 오르는 이유가 그 규칙이었고,
 * 587건을 채우려면 <b>모르는 브랜드도 가타카나로 옮기게</b> 열어야 한다. 여는 만큼 나가는 값을 봐야 한다.
 *
 * <p>거를 대상은 운영에서 실제로 나왔던 것들이다.
 *
 * <ul>
 *   <li>남대문잡채호떡 → {@code 南山拌菜熱米糕} — 중국어다. 게다가 남대문을 남산으로 옮겼다.
 *   <li>마티에 프리미에르 더현대 서울 → {@code … ソウル 1F} — 원문에 없는 층수를 지어냈다.
 * </ul>
 *
 * <p><b>음역 실패와 뜻 지어내기는 다른 종류다.</b> 브랜드를 가타카나로 옮기는 것은 일본에서 외국 브랜드를 다루는 표준이라 열어도 되지만, 없는 뜻·없는 정보를 만드는
 * 것은 막아야 한다.
 */
class JapaneseOutputSanityTest {

    @Test
    @DisplayName("가나가 없는 한자 덩어리는 중국어로 보고 버린다 — 南山拌菜熱米糕 가 그렇게 나왔다")
    void rejectsChineseLookingOutput() {
        assertThat(PopupTranslationService.looksUnsafeJapanese("南山拌菜熱米糕", "남대문잡채호떡")).isTrue();
    }

    /**
     * 용어집이 채울 자리는 보호 토큰이라 검사하지 않는다 — 이미 검증된 공식 표기다.
     *
     * <p>이 구분이 없으면 {@code 外見至上主義}(외모지상주의의 <b>정답</b>)가 "가나 없는 한자 덩어리" 라는 이유로 버려진다. 한글 원문에는 한자가 없으니
     * "원문에 한자가 있었나" 로는 못 가린다.
     */
    @Test
    @DisplayName("용어집이 채울 자리는 검사하지 않는다 — 外見至上主義 를 중국어로 오인하면 안 된다")
    void ignoresGlossaryProtectedParts() {
        // 모델은 토큰을 그대로 돌려주고, 그 자리에 서버가 外見至上主義 를 넣는다.
        assertThat(PopupTranslationService.looksUnsafeJapanese("ZXQTERM0QXZ", "외모지상주의")).isFalse();
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ZXQTERM0QXZ ZXQTERM1QXZ", "귀멸의 칼날 팝업스토어"))
                .isFalse();
    }

    @Test
    @DisplayName("원문에 없던 숫자가 생기면 버린다 — 없는 층수를 지어낸 적이 있다")
    void rejectsInventedNumbers() {
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "マーチン プリミエール ソウル 1F", "마티에 프리미에르 더현대 서울"))
                .isTrue();
    }

    @Test
    @DisplayName("원문에 있던 숫자는 그대로 써도 된다")
    void allowsNumbersThatExistInSource() {
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ハイキュー!! 10周年 ポップアップ", "하이큐 10주년 팝업"))
                .isFalse();
    }

    @Test
    @DisplayName("가타카나 음역은 통과시킨다 — 이게 커버리지를 여는 핵심이다")
    void allowsKatakanaTransliteration() {
        assertThat(PopupTranslationService.looksUnsafeJapanese("ワリットイズン", "와릿이즌")).isFalse();
        assertThat(PopupTranslationService.looksUnsafeJapanese("メディキューブ ポップアップ", "메디큐브 팝업"))
                .isFalse();
    }

    @Test
    @DisplayName("빈 값·null 은 검사 대상이 아니다")
    void blankIsNotUnsafe() {
        assertThat(PopupTranslationService.looksUnsafeJapanese(null, "무엇")).isFalse();
        assertThat(PopupTranslationService.looksUnsafeJapanese("", "무엇")).isFalse();
    }
}
