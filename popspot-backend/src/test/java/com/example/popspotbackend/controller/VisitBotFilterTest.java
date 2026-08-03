package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 봇 판정이 <b>사람을 거르지 않는지</b> 확인한다.
 *
 * <p>이 검사는 기록 시점에 돈다. 잘못 잡으면 진짜 방문이 저장되지 않고, 그 사실이 아무 데도 드러나지 않는다 — 나중에 "방문자가 줄었네" 하고 마케팅을 의심하게 된다.
 * 봇을 몇 개 놓치는 것보다 사람을 하나 거르는 쪽이 훨씬 비싸다.
 *
 * <p>그래서 실제 UA 문자열을 그대로 넣어 본다. 규칙을 흉내 낸 가짜 문자열로 검사하면 규칙이 자기 자신을 검사하는 셈이 된다.
 */
class VisitBotFilterTest {

    private static boolean isBot(String ua) {
        return Boolean.TRUE.equals(
                ReflectionTestUtils.invokeMethod(VisitController.class, "isBot", ua));
    }

    @ParameterizedTest(name = "사람: {0}")
    @ValueSource(
            strings = {
                // 윈도우 크롬
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/120.0.0.0 Safari/537.36",
                // 맥 사파리
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like"
                        + " Gecko) Version/17.1 Safari/605.1.15",
                // 아이폰 사파리
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15"
                        + " (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
                // 안드로이드 크롬
                "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/120.0.0.0 Mobile Safari/537.36",
                // 카카오톡 인앱 브라우저 — 이 서비스 사용자의 상당수가 여기로 들어온다
                "Mozilla/5.0 (Linux; Android 13; SM-A536N) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/119.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.0",
                // 네이버 앱 인앱 브라우저
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
                        + " (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.9.2)",
                // 삼성 인터넷
                "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like"
                        + " Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
                // 웨일
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/116.0.0.0 Whale/3.23.214.13 Safari/537.36",
                // 엣지
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
                // 파이어폭스
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
            })
    @DisplayName("실제 브라우저는 절대 봇으로 잡히지 않는다")
    void realBrowsersAreNeverBots(String ua) {
        assertThat(isBot(ua)).describedAs("사람의 방문이 기록되지 않으면 통계가 조용히 틀어진다").isFalse();
    }

    @ParameterizedTest(name = "봇: {0}")
    @ValueSource(
            strings = {
                "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
                "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " HeadlessChrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (compatible; facebookexternalhit/1.1;"
                        + " +http://www.facebook.com/externalhit_uatext.php)",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like"
                        + " Gecko) Chrome/120.0.0.0 Safari/537.36 Lighthouse",
                "curl/8.4.0",
                "python-requests/2.31.0",
                "PostmanRuntime/7.36.0",
                "Mozilla/5.0"
            })
    @DisplayName("봇·자동화 도구는 걸러진다")
    void botsAreFiltered(String ua) {
        assertThat(isBot(ua)).isTrue();
    }

    @Test
    @DisplayName("User-Agent 가 아예 없으면 봇 — 브라우저는 반드시 보낸다")
    void missingUserAgentIsBot() {
        assertThat(isBot(null)).isTrue();
        assertThat(isBot("")).isTrue();
        assertThat(isBot("   ")).isTrue();
    }

    @Test
    @DisplayName("Mozilla 만 흉내 낸 짧은 UA 는 봇 — 이름 목록에 없어도 구조로 걸러야 새 도구를 막는다")
    void shortFakeUserAgentIsBot() {
        assertThat(isBot("Mozilla/5.0 (compatible)")).isTrue();
        assertThat(isBot("Mozilla/5.0 MyScraper")).isTrue();
    }
}
