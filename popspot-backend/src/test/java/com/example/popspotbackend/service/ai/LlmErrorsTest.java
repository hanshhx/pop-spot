package com.example.popspotbackend.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * 429 분류 회귀 테스트.
 *
 * <p>이 클래스가 존재하는 이유: 초기 구현은 {@code \bTPD\b} 같은 대문자 패턴을 썼는데 메시지를 소문자로 바꿔 넘기고 있어 네 개 대안이 통째로 죽은 코드였다.
 * 그래서 일일 한도(TPD/RPD)를 분당 한도로 오분류했고, 크롤러가 남은 400개 키워드마다 429 를 한 번씩 더 맞았다. 컴파일도 통과하고 리뷰도 통과하는 종류의 버그라
 * 테스트로 고정한다.
 */
class LlmErrorsTest {

    /** Groq 가 실제로 돌려주는 형태를 흉내낸 예외. {@code code()} 리플렉션 경로도 함께 검증한다. */
    private static class FakeHttpException extends RuntimeException {
        private final int code;

        FakeHttpException(int code, String body) {
            super(body);
            this.code = code;
        }

        @SuppressWarnings("unused") // LlmErrors 가 리플렉션으로 호출한다.
        public int code() {
            return code;
        }
    }

    @Nested
    @DisplayName("일일 한도")
    class DailyLimit {

        @ParameterizedTest(name = "{0} → RATE_LIMIT_DAY")
        @ValueSource(
                strings = {
                    "rate_limit_exceeded: TPD exceeded",
                    "rate_limit_exceeded: RPD exceeded",
                    "Rate limit reached for model. Limit: tokens per day (TPD)",
                    "daily quota exceeded",
                    "requests per day limit reached"
                })
        void 대소문자와_무관하게_일일한도를_구분한다(String body) {
            assertThat(LlmErrors.classify(new FakeHttpException(429, body)))
                    .isEqualTo(LlmFailureKind.RATE_LIMIT_DAY);
        }

        @Test
        void 힌트가_없어도_대기시간이_길면_일일한도로_본다() {
            // 분당 한도가 12분 뒤 재시도를 요구할 리 없다.
            assertThat(
                            LlmErrors.classify(
                                    new FakeHttpException(
                                            429, "too many requests. try again in 12m30s")))
                    .isEqualTo(LlmFailureKind.RATE_LIMIT_DAY);
        }
    }

    @Nested
    @DisplayName("분당 한도")
    class MinuteLimit {

        @ParameterizedTest(name = "{0} → RATE_LIMIT_MINUTE")
        @ValueSource(
                strings = {
                    "rate limit: tokens per minute (TPM) exceeded",
                    "RPM limit reached",
                    "rate_limit_exceeded: requests per min"
                })
        void 분당한도를_구분한다(String body) {
            assertThat(LlmErrors.classify(new FakeHttpException(429, body)))
                    .isEqualTo(LlmFailureKind.RATE_LIMIT_MINUTE);
        }

        @Test
        void 어느_한도인지_모르면_분당으로_본다() {
            // 그날 전체를 포기하는 쪽이 더 비싼 오판이므로 보수적으로 간다.
            assertThat(LlmErrors.classify(new FakeHttpException(429, "too many requests")))
                    .isEqualTo(LlmFailureKind.RATE_LIMIT_MINUTE);
        }
    }

    @Nested
    @DisplayName("429 가 아닌 것")
    class NotRateLimited {

        @Test
        void 숫자에_429가_섞여_있다고_429로_보지_않는다() {
            // "\b429\b" 단어 경계가 없으면 6429 를 429 로 오독한다.
            assertThat(
                            LlmErrors.classify(
                                    new RuntimeException("requested 6429 tokens, over context")))
                    .isNotEqualTo(LlmFailureKind.RATE_LIMIT_DAY)
                    .isNotEqualTo(LlmFailureKind.RATE_LIMIT_MINUTE);
        }

        @Test
        void 타임아웃은_기타로_분류된다() {
            assertThat(LlmErrors.classify(new IOException("Read timed out after 60000ms")))
                    .isEqualTo(LlmFailureKind.OTHER);
        }

        @Test
        void null_은_기타로_분류된다() {
            assertThat(LlmErrors.classify(null)).isEqualTo(LlmFailureKind.OTHER);
        }
    }

    @Nested
    @DisplayName("재시도 대기 시간")
    class RetryAfter {

        @ParameterizedTest(name = "\"{0}\" → {1}초")
        @CsvSource({
            "'try again in 7.66s', 8",
            "'try again in 1m2.72s', 63",
            "'try again in 1h59m59.5s', 7200",
            "'try again in 12m30s', 750"
        })
        void 시분초가_섞여도_전부_읽는다(String body, long expectedSeconds) {
            assertThat(LlmErrors.retryAfterSeconds(new RuntimeException(body)))
                    .contains(expectedSeconds);
        }

        @Test
        void retry_after_헤더_형식도_읽는다() {
            assertThat(LlmErrors.retryAfterSeconds(new RuntimeException("{\"retry-after\": 12.5}")))
                    .contains(13L);
        }

        @Test
        void 밀리초를_분으로_오독하지_않는다() {
            // "500ms" 의 m 을 분으로 읽으면 30000초가 된다.
            assertThat(LlmErrors.retryAfterSeconds(new RuntimeException("timed out after 60000ms")))
                    .isEqualTo(Optional.empty());
        }

        @Test
        void 정보가_없으면_비어_있다() {
            assertThat(LlmErrors.retryAfterSeconds(new RuntimeException("boom")))
                    .isEqualTo(Optional.empty());
        }
    }

    @Test
    void 원인_사슬_깊은_곳의_상태코드도_찾는다() {
        // langchain4j 의 재시도 래퍼가 원인을 여러 겹 감싼다.
        Throwable wrapped =
                new RuntimeException(
                        "retry failed",
                        new RuntimeException(
                                "call failed", new FakeHttpException(429, "TPD exceeded")));
        assertThat(LlmErrors.classify(wrapped)).isEqualTo(LlmFailureKind.RATE_LIMIT_DAY);
    }
}
