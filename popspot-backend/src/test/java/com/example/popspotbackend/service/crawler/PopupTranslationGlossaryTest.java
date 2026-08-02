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

    @Test
    void exposesUnknownKoreanProperNounForConservativeSkip() {
        PopupTranslationGlossary.ProtectedText text = glossary.protect("레고트 x 포켓몬 콜라보 팝업스토어");

        assertThat(text.properNameFound()).isTrue();
        assertThat(text.hasUnprotectedHangul()).isTrue();
    }
}
