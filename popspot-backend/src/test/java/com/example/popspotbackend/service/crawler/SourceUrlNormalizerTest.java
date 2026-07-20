package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * URL 정규화 회귀 테스트.
 *
 * <p>선중복제거의 정확도가 여기에 달려 있다. 같은 글을 다르다고 보면 LLM 을 두 번 부르고(토큰 낭비), 다른 글을 같다고 보면 새 팝업을 영영 놓친다. 후자가 훨씬
 * 비싸므로 "다른 글은 반드시 다르게" 를 우선 고정한다.
 */
class SourceUrlNormalizerTest {

    private static final String CANONICAL = "https://blog.naver.com/abc/223456789";

    @ParameterizedTest(name = "{0}")
    @ValueSource(
            strings = {
                "https://blog.naver.com/abc/223456789",
                "https://blog.naver.com/abc/223456789/", // 끝 슬래시
                "https://BLOG.NAVER.com/abc/223456789", // 호스트 대소문자
                "https://blog.naver.com/abc/223456789#section2", // 프래그먼트
                "https://blog.naver.com:443/abc/223456789", // 기본 포트
                "  https://blog.naver.com/abc/223456789  ", // 앞뒤 공백
                "https://blog.naver.com/abc/223456789?utm_source=naver&utm_medium=blog",
                "https://blog.naver.com/abc/223456789?fbclid=xyz123"
            })
    @DisplayName("같은 글의 여러 표기는 하나로 모인다")
    void 같은_글은_같은_해시(String variant) {
        assertThat(SourceUrlNormalizer.normalize(variant)).isEqualTo(CANONICAL);
        assertThat(SourceUrlNormalizer.hash(variant))
                .isEqualTo(SourceUrlNormalizer.hash(CANONICAL));
    }

    @Test
    @DisplayName("쿼리 순서만 달라도 같은 글이다")
    void 쿼리_순서_무관() {
        String a = "https://m.blog.naver.com/PostView.naver?blogId=x&logNo=999";
        String b = "https://m.blog.naver.com/PostView.naver?logNo=999&blogId=x";
        assertThat(SourceUrlNormalizer.hash(a)).isEqualTo(SourceUrlNormalizer.hash(b));
    }

    @Test
    @DisplayName("의미 있는 쿼리는 지우지 않는다 — 글 번호가 쿼리에 있는 블로그가 많다")
    void 글번호_쿼리는_보존() {
        String post999 = "https://m.blog.naver.com/PostView.naver?blogId=x&logNo=999";
        String post1000 = "https://m.blog.naver.com/PostView.naver?blogId=x&logNo=1000";
        assertThat(SourceUrlNormalizer.hash(post999))
                .isNotEqualTo(SourceUrlNormalizer.hash(post1000));
    }

    @Test
    @DisplayName("서로 다른 글은 반드시 다른 해시 — 같다고 보면 새 팝업을 영영 놓친다")
    void 다른_글은_다른_해시() {
        assertThat(SourceUrlNormalizer.hash("https://blog.naver.com/abc/111"))
                .isNotEqualTo(SourceUrlNormalizer.hash("https://blog.naver.com/abc/222"));
    }

    @Test
    @DisplayName("파싱 불가 URL 도 안정적인 값을 준다 — 버리면 그 글은 영원히 재처리된다")
    void 파싱_불가도_안정적() {
        String weird = "not-a-url-at-all";
        assertThat(SourceUrlNormalizer.hash(weird)).isEqualTo(SourceUrlNormalizer.hash(weird));
        assertThat(SourceUrlNormalizer.hash(weird)).isNotEmpty();
    }

    @Test
    void null_과_빈문자열도_터지지_않는다() {
        assertThat(SourceUrlNormalizer.normalize(null)).isEmpty();
        assertThat(SourceUrlNormalizer.normalize("  ")).isEmpty();
        assertThat(SourceUrlNormalizer.hash(null)).isNotEmpty(); // 빈 문자열의 해시
    }

    @Test
    @DisplayName("해시는 DB 컬럼 길이(64)와 정확히 맞는다")
    void 해시_길이() {
        assertThat(SourceUrlNormalizer.hash(CANONICAL)).hasSize(64);
        assertThat(SourceUrlNormalizer.contentHash("제목", "요약")).hasSize(64);
    }

    @Test
    @DisplayName("내용이 바뀌면 다른 해시 — 기간 연장·장소 변경을 다시 해석하기 위한 신호")
    void 내용_변경_감지() {
        String before = SourceUrlNormalizer.contentHash("○○ 팝업", "5월 1일까지");
        String after = SourceUrlNormalizer.contentHash("○○ 팝업", "5월 31일까지 연장");
        assertThat(before).isNotEqualTo(after);
    }

    @Test
    void 내용_해시는_null_을_빈값으로_다룬다() {
        assertThat(SourceUrlNormalizer.contentHash(null, null))
                .isEqualTo(SourceUrlNormalizer.contentHash("", ""));
    }
}
