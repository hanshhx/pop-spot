package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 한글 이름에 섞인 가나를 되돌리는 규칙.
 *
 * <p><b>이 기능의 실패 방식은 둘이고, 뒤쪽이 훨씬 나쁘다.</b> 못 고치면 이름 하나가 어색하게 남을
 * 뿐이지만, 잘못 고치면 <b>멀쩡한 일본어 이름을 망가뜨린다</b>. 그래서 "고치는" 시험만큼 "건드리지
 * 않는" 시험을 함께 둔다.
 *
 * <p>입력은 2026-08-05 라이브 데이터에서 실제로 나온 값이다(1,012건 중 3건).
 */
class KanaInNameTest {

    /** 검증 대상은 private 이다 — 공개 API 를 늘리지 않고 리플렉션으로 부른다. */
    private static String fix(String name) throws Exception {
        PopupNormalizationService svc = new PopupNormalizationService(null, null);
        NormalizedPopup p = NormalizedPopup.builder().name(name).build();
        Method m =
                PopupNormalizationService.class.getDeclaredMethod(
                        "fixKanaInKoreanName", NormalizedPopup.class);
        m.setAccessible(true);
        m.invoke(svc, p);
        return p.getName();
    }

    @Test
    @DisplayName("두 글자가 한 음절인 것을 한 글자씩 쪼개지 않는다 — ニュ 는 뉴")
    void digraphIsOneSyllable() throws Exception {
        // ニ+ュ 를 따로 바꾸면 "니유발란스" 가 되어 원래보다 더 틀린다.
        assertThat(fix("ニュ발란ス 런유어웨이 10k")).isEqualTo("뉴발란스 런유어웨이 10k");
    }

    @Test
    @DisplayName("한 글자짜리도 되돌린다 — 플라ザ 는 플라자")
    void singleKanaIsFixed() throws Exception {
        assertThat(fix("AK 플라ザ 귀멸의 칼날 팝업스토어"))
                .isEqualTo("AK 플라자 귀멸의 칼날 팝업스토어");
    }

    /**
     * 한글이 하나도 없으면 일본 브랜드 이름일 수 있다. 그건 오염이 아니라 정상이므로 손대지 않는다 —
     * 여기서 건드리면 멀쩡한 이름을 망가뜨린다.
     */
    @Test
    @DisplayName("한글이 없는 일본어 이름은 그대로 둔다")
    void pureJapaneseIsLeftAlone() throws Exception {
        assertThat(fix("サンリオ")).isEqualTo("サンリオ");
        assertThat(fix("ニュース")).isEqualTo("ニュース");
    }

    @Test
    @DisplayName("가나가 없으면 아무것도 하지 않는다")
    void plainKoreanUntouched() throws Exception {
        assertThat(fix("짱구는못말려 떡잎마을 대축제")).isEqualTo("짱구는못말려 떡잎마을 대축제");
        assertThat(fix("AK 플라자 팝업")).isEqualTo("AK 플라자 팝업");
    }

    /**
     * 표에 없는 글자는 <b>지우지 않고 그대로 둔다.</b> 조용히 없애면 이름이 더 망가지고, 무엇이
     * 잘못됐는지도 안 보인다. 대신 로그에 경고가 남는다.
     */
    @Test
    @DisplayName("표에 없는 가나는 그대로 남긴다 — 지우지 않는다")
    void unknownKanaIsKept() throws Exception {
        String out = fix("eskァ파");
        assertThat(out).contains("ァ");
        assertThat(out).isEqualTo("eskァ파");
    }

    @Test
    @DisplayName("이름이 없으면 그냥 넘어간다")
    void nullNameIsSafe() throws Exception {
        assertThat(fix(null)).isNull();
    }
}
