package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 마스킹이 <b>실제로 가리는지</b> 확인한다.
 *
 * <p>가린 것처럼 보이는데 안 가려지는 경우가 이 기능의 유일한 실패 방식이다. 설계 단계의 규칙("3글자 이상이면 2글자, 아니면 1글자")을 그대로 짰더니 {@code
 * a@b.c} 가 {@code a****@b.c} 로 나왔다 — 원문 그대로다. 짧은 주소가 핵심이라 그쪽을 촘촘히 본다.
 */
class PiiMaskTest {

    @Test
    @DisplayName("짧은 주소도 반드시 가려진다 — 여기가 깨지면 마스킹이 장식이 된다")
    void masksShortLocalParts() {
        assertThat(PiiMask.email("a@b.c")).describedAs("1글자").isEqualTo("****@b.c");
        assertThat(PiiMask.email("ab@x.com")).describedAs("2글자").isEqualTo("****@x.com");
        assertThat(PiiMask.email("홍@naver.com")).describedAs("한글 한 자").isEqualTo("****@naver.com");
    }

    @Test
    @DisplayName("3글자는 한 글자만 남는다")
    void masksMediumLocalPart() {
        assertThat(PiiMask.email("kim@naver.com")).isEqualTo("k****@naver.com");
    }

    @Test
    @DisplayName("4글자 이상은 앞 두 글자 — 대조에 쓸 만큼만 남긴다")
    void keepsTwoForLongLocalPart() {
        assertThat(PiiMask.email("hong@naver.com")).isEqualTo("ho****@naver.com");
        assertThat(PiiMask.email("verylongaddress@gmail.com")).isEqualTo("ve****@gmail.com");
    }

    @Test
    @DisplayName("도메인은 그대로 남는다 — 가입경로 판별에 쓴다")
    void keepsDomain() {
        assertThat(PiiMask.email("hong@kakao.com")).endsWith("@kakao.com");
        assertThat(PiiMask.email("hong@gmail.com")).endsWith("@gmail.com");
    }

    @Test
    @DisplayName("이메일 모양이 아니면 통째로 가린다 — 형식을 믿고 흘리지 않는다")
    void masksMalformedInput() {
        assertThat(PiiMask.email("@naver.com")).describedAs("로컬파트 없음").isEqualTo("****");
        assertThat(PiiMask.email("골뱅이없음")).isEqualTo("****");
    }

    @Test
    @DisplayName("빈 값은 null — 빈 문자열을 내보내 화면이 '****' 를 그리게 하지 않는다")
    void nullForEmpty() {
        assertThat(PiiMask.email(null)).isNull();
        assertThat(PiiMask.email("   ")).isNull();
    }

    @Test
    @DisplayName("가린 결과에 원문 로컬파트가 통째로 들어 있지 않다")
    void neverContainsWholeLocalPart() {
        for (String raw :
                new String[] {"a@b.c", "ab@x.com", "kim@naver.com", "hong@naver.com", "홍@n.com"}) {
            String local = raw.substring(0, raw.indexOf('@'));
            String masked = PiiMask.email(raw);
            assertThat(masked)
                    .describedAs("원문 로컬파트 '%s' 가 남으면 안 된다 (결과=%s)", local, masked)
                    .doesNotContain(local + "@");
        }
    }

    @Test
    @DisplayName("UUID 는 앞 8자만")
    void idHeadKeepsPrefix() {
        assertThat(PiiMask.idHead("3f1a2b4c-5d6e-7f80-91a2-b3c4d5e6f708")).isEqualTo("3f1a2b4c");
        assertThat(PiiMask.idHead("short")).isEqualTo("short");
        assertThat(PiiMask.idHead(null)).isNull();
    }
}
