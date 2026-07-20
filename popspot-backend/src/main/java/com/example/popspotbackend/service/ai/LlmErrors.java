package com.example.popspotbackend.service.ai;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LLM 호출 예외를 분류한다.
 *
 * <p><b>왜 예외 타입을 import 하지 않는가.</b> 429 를 던지는 {@code dev.ai4j.openai4j.OpenAiHttpException} 은
 * langchain4j-open-ai 의 전이 의존이라 컴파일 클래스패스에 있다는 보장이 없고, langchain4j 버전이 오르면 내부 HTTP 클라이언트가 통째로 바뀌기도
 * 한다. 그래서 타입에 묶지 않고 (1) 원인 사슬에 있는 {@code int code()} 를 리플렉션으로 읽고 (2) 메시지 패턴으로 보강한다. 정확도를 조금 내주고 버전
 * 안정성을 얻는 선택이다.
 *
 * <p><b>분당 vs 일일 구분이 중요한 이유.</b> 분당 한도는 잠깐 쉬면 회복되지만 일일 한도는 그날 안 풀린다. 구분하지 않고 재시도하면 남은 키워드마다 429 를 한
 * 번씩 더 맞으며 시간만 쓴다.
 */
public final class LlmErrors {

    private LlmErrors() {}

    private static final int HTTP_TOO_MANY_REQUESTS = 429;

    /**
     * Groq 는 429 본문에 "rate limit reached for ... per day" 형태로 어떤 한도인지 알려준다.
     *
     * <p>{@code CASE_INSENSITIVE} 가 필수다. {@link #flatten} 이 소문자로 바꿔 넘기므로 {@code \bTPD\b} 같은 대문자
     * 리터럴은 그냥 두면 절대 매치되지 않는다(죽은 코드).
     */
    private static final Pattern DAILY_HINT =
            Pattern.compile("per\\s*day|daily|\\bRPD\\b|\\bTPD\\b", Pattern.CASE_INSENSITIVE);

    private static final Pattern MINUTE_HINT =
            Pattern.compile(
                    "per\\s*minute|per\\s*min\\b|\\bRPM\\b|\\bTPM\\b", Pattern.CASE_INSENSITIVE);

    /**
     * 상태코드를 못 읽었을 때의 보강 판정.
     *
     * <p>단어 경계가 없으면 "requested 6429 tokens" 같은 문구를 429 로 오독한다.
     */
    private static final Pattern RATE_LIMITED =
            Pattern.compile("\\b429\\b|rate[ _]limit", Pattern.CASE_INSENSITIVE);

    /** {@code "retry-after": 12.5} 형태에서 대기 초를 뽑는다. */
    private static final Pattern RETRY_AFTER =
            Pattern.compile("retry[- _]?after\\\"?\\s*[:=]?\\s*([0-9]+(?:\\.[0-9]+)?)");

    /**
     * {@code try again in 1h59m59.5s} 처럼 시·분·초가 섞인 형태를 통째로 읽는다.
     *
     * <p>{@code m(?!s)} 는 밀리초({@code 500ms})를 분으로 오독하지 않기 위한 것이다. 일일 한도일수록 대기가 길게 안내되는데, 시 단위를 못
     * 읽으면 정보량이 가장 큰 케이스에서만 값이 비게 된다.
     */
    private static final Pattern TRY_AGAIN_IN =
            Pattern.compile(
                    "try again in\\s*(?:([0-9]+)\\s*h)?\\s*(?:([0-9]+)\\s*m(?!s))?"
                            + "\\s*(?:([0-9]+(?:\\.[0-9]+)?)\\s*s)?",
                    Pattern.CASE_INSENSITIVE);

    /** 이보다 길게 기다리라는 429 는 분당 한도로 볼 수 없다. */
    private static final long LONG_WAIT_THRESHOLD_SECONDS = 300L;

    private static final int MAX_CAUSE_DEPTH = 8;

    /** 예외를 실패 종류로 분류. 429 가 아니면 파싱/기타로 떨어진다. */
    public static LlmFailureKind classify(Throwable error) {
        if (error == null) return LlmFailureKind.OTHER;

        String text = flatten(error);
        boolean is429 = httpStatus(error).filter(s -> s == HTTP_TOO_MANY_REQUESTS).isPresent();
        if (!is429) {
            // 상태코드를 못 읽는 구현일 수 있어 본문으로 보강.
            is429 = RATE_LIMITED.matcher(text).find();
        }

        if (is429) {
            if (DAILY_HINT.matcher(text).find()) return LlmFailureKind.RATE_LIMIT_DAY;
            if (MINUTE_HINT.matcher(text).find()) return LlmFailureKind.RATE_LIMIT_MINUTE;
            // 힌트가 없으면 대기 시간으로 판단한다. 수 분 이상 기다리라는 429 는 분당 한도가 아니다.
            // 그래도 모르면 분당으로 본다 — 그날 전체를 포기하는 쪽이 더 비싼 오판이다.
            return retryAfterSeconds(error)
                            .filter(seconds -> seconds >= LONG_WAIT_THRESHOLD_SECONDS)
                            .isPresent()
                    ? LlmFailureKind.RATE_LIMIT_DAY
                    : LlmFailureKind.RATE_LIMIT_MINUTE;
        }

        if (error instanceof com.fasterxml.jackson.core.JacksonException
                || text.contains("jsonparse")
                || text.contains("unrecognized token")) {
            return LlmFailureKind.PARSE;
        }
        return LlmFailureKind.OTHER;
    }

    /** 서버가 알려준 대기 시간(초). 없으면 비어 있다. */
    public static Optional<Long> retryAfterSeconds(Throwable error) {
        if (error == null) return Optional.empty();
        String text = flatten(error);

        Matcher m = RETRY_AFTER.matcher(text);
        if (m.find()) return Optional.of((long) Math.ceil(Double.parseDouble(m.group(1))));

        Matcher t = TRY_AGAIN_IN.matcher(text);
        if (t.find()) {
            double total = 0;
            boolean matchedAny = false;
            if (t.group(1) != null) {
                total += Long.parseLong(t.group(1)) * 3600L;
                matchedAny = true;
            }
            if (t.group(2) != null) {
                total += Long.parseLong(t.group(2)) * 60L;
                matchedAny = true;
            }
            if (t.group(3) != null) {
                total += Double.parseDouble(t.group(3));
                matchedAny = true;
            }
            if (matchedAny) return Optional.of((long) Math.ceil(total));
        }
        return Optional.empty();
    }

    /**
     * 원인 사슬에서 {@code int code()} 를 찾아 HTTP 상태를 읽는다.
     *
     * <p>{@code OpenAiHttpException} 이 이 형태다. 타입을 모른 채 값만 가져오기 위한 것이고, 없으면 조용히 비운다.
     */
    private static Optional<Integer> httpStatus(Throwable error) {
        Throwable current = error;
        for (int depth = 0; current != null && depth < MAX_CAUSE_DEPTH; depth++) {
            try {
                Object value = current.getClass().getMethod("code").invoke(current);
                if (value instanceof Integer status) return Optional.of(status);
            } catch (ReflectiveOperationException | RuntimeException ignored) {
                // code() 가 없는 예외가 대부분이다. 정상 경로.
            }
            current = current.getCause();
        }
        return Optional.empty();
    }

    /** 원인 사슬의 메시지를 하나로 합쳐 소문자화. 패턴 매칭용. */
    private static String flatten(Throwable error) {
        StringBuilder sb = new StringBuilder();
        Throwable current = error;
        for (int depth = 0; current != null && depth < MAX_CAUSE_DEPTH; depth++) {
            sb.append(current.getClass().getSimpleName()).append(' ');
            if (current.getMessage() != null) sb.append(current.getMessage()).append(' ');
            current = current.getCause();
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }
}
