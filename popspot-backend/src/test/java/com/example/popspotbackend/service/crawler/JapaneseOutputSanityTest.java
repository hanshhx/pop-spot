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

    /**
     * 2026-08-09 시험 배치(100건 중 82건 번역)에서 나온 것들이다.
     *
     * <p>기존 검사가 통과시킨 이유는 <b>"일본 문자가 있나" 만 봤기</b> 때문이다. 가나가 멀쩡히 붙어 있으니 일본어로 보였다. 정작 모델은 옮기다 말고 발음을
     * 로마자로 적어 버린 것이었다.
     */
    @Test
    @DisplayName("원문에 없던 로마자가 생기면 버린다 — 옮기다 만 것이다")
    void rejectsInventedLatin() {
        // 용어집이 '귀멸의 칼날' 을 잡아 토큰이 되고, 남은 '무한성' 이 반쯤 로마자로 나왔다.
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ZXQTERM0QXZ モuhanseong ポップアップストア", "귀멸의 칼날 무한성 팝업스토어"))
                .isTrue();
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ベイシスマウンテンベアサンダル seocheon ポップアップ", "베이시스 마운틴 베어 샌들 서촌 팝업"))
                .isTrue();
    }

    /** 로마자가 있다고 다 버리면 안 된다. 원문이 이미 영문을 갖고 있는 팝업이 흔하다 — 여기서 과하게 막으면 정상 번역까지 날아가 커버리지가 도로 내려간다. */
    @Test
    @DisplayName("원문에 있던 로마자는 그대로 써도 된다")
    void allowsLatinThatExistsInSource() {
        assertThat(PopupTranslationService.looksUnsafeJapanese("IVE ポップアップストア", "IVE 팝업스토어"))
                .isFalse();
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ZXQTERM0QXZ G: A BOY'S JOURNEY ポップアップ",
                                "지드래곤 G: A BOY'S JOURNEY POP UP"))
                .isFalse();
        // 대소문자가 달라도 원문에 있던 말이다.
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ビオレ olive young ポップアップストア", "비오레 OLIVE YOUNG 팝업스토어"))
                .isFalse();
    }

    @Test
    @DisplayName("용어집이 넣어 준 공식 표기는 검사하지 않는다 — 토큰을 지운 뒤에 본다")
    void ignoresLatinFromGlossary() {
        // '에일리언 스테이지' 는 용어집에서 ALIEN STAGE 로 복원된다. 원문엔 로마자가 없다.
        assertThat(
                        PopupTranslationService.looksUnsafeJapanese(
                                "ZXQTERM0QXZ アクリルスタンド", "에일리언 스테이지 아크릴 스탠드"))
                .isFalse();
    }

    @Test
    @DisplayName("빈 값·null 은 검사 대상이 아니다")
    void blankIsNotUnsafe() {
        assertThat(PopupTranslationService.looksUnsafeJapanese(null, "무엇")).isFalse();
        assertThat(PopupTranslationService.looksUnsafeJapanese("", "무엇")).isFalse();
    }
}
