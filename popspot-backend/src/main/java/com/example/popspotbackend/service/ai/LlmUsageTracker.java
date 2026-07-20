package com.example.popspotbackend.service.ai;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * LLM 호출량·토큰 사용량을 역할(user/crawler)별로 하루 단위 집계한다.
 *
 * <p><b>왜 필요한가.</b> 이전에는 모든 실패가 {@code catch (Exception)} 에서 빈 목록으로 바뀌어, 쿼터가 터진 것과 "검색 결과에 팝업이 없었다"
 * 가 로그상 구별되지 않았다. 하루 10건만 수집되는데 원인을 알 수 없던 이유다. 시도·성공·429· 파싱실패를 따로 세고 입출력 토큰을 누적해, 다음 결정(스니펫 수·키워드
 * 수·모델 선택)을 추측이 아니라 실측으로 한다.
 *
 * <p><b>KST 기준으로 리셋한다.</b> Groq 한도 리셋 시각과 정확히 같지는 않지만, 운영 판단(“오늘 몇 번 돌았나”)이 한국 날짜 기준이라 그쪽에 맞춘다.
 * 프로세스 메모리에만 보관하므로 재기동하면 초기화된다 — 영속화가 필요해지면 그때 테이블로 옮긴다(지금은 판단 근거를 얻는 게 목적이라 과하게 만들지 않는다).
 */
@Slf4j
@Component
public class LlmUsageTracker {

    /** 역할 구분. 모델이 다르면 한도도 따로 잡히므로 집계도 따로 한다. */
    public enum Role {
        USER,
        CRAWLER
    }

    /** 하루치 카운터 한 벌. */
    public static class DailyUsage {
        private final AtomicLong attempts = new AtomicLong();

        /** 모델이 응답을 돌려준 호출. 파싱 실패도 포함한다 — 토큰은 이미 썼다. */
        private final AtomicLong responses = new AtomicLong();

        /** 응답 + 파싱까지 성공한 호출. */
        private final AtomicLong successes = new AtomicLong();

        private final AtomicLong rateLimitMinute = new AtomicLong();
        private final AtomicLong rateLimitDay = new AtomicLong();
        private final AtomicLong parseFailures = new AtomicLong();
        private final AtomicLong otherFailures = new AtomicLong();
        private final AtomicLong inputTokens = new AtomicLong();
        private final AtomicLong outputTokens = new AtomicLong();

        public long attempts() {
            return attempts.get();
        }

        public long successes() {
            return successes.get();
        }

        public long inputTokens() {
            return inputTokens.get();
        }

        public long outputTokens() {
            return outputTokens.get();
        }

        public long totalTokens() {
            return inputTokens.get() + outputTokens.get();
        }

        public long rateLimitDay() {
            return rateLimitDay.get();
        }

        /** 응답 1회당 평균 토큰. 스니펫 수·키워드 수를 정할 때 쓰는 실측값. */
        public long avgTokensPerResponse() {
            long count = responses.get();
            return count == 0 ? 0 : totalTokens() / count;
        }

        @Override
        public String toString() {
            return String.format(
                    "시도 %d · 응답 %d · 파싱성공 %d · 429(분) %d · 429(일) %d · 파싱실패 %d · 기타 %d"
                            + " · 토큰 in %d / out %d (합 %d, 응답당 %d)",
                    attempts.get(),
                    responses.get(),
                    successes.get(),
                    rateLimitMinute.get(),
                    rateLimitDay.get(),
                    parseFailures.get(),
                    otherFailures.get(),
                    inputTokens.get(),
                    outputTokens.get(),
                    totalTokens(),
                    avgTokensPerResponse());
        }
    }

    /** key = "YYYY-MM-DD|ROLE". 날짜가 바뀌면 새 항목이 생기고 옛 항목은 정리된다. */
    private final Map<String, DailyUsage> usage = new ConcurrentHashMap<>();

    public DailyUsage today(Role role) {
        String key = keyOf(role);
        DailyUsage found = usage.computeIfAbsent(key, k -> new DailyUsage());
        pruneOldEntries(key);
        return found;
    }

    public void recordAttempt(Role role) {
        today(role).attempts.incrementAndGet();
    }

    /**
     * 모델이 응답을 돌려줬다. 파싱 성공 여부와 무관하다 — 토큰은 이미 소모됐기 때문이다.
     *
     * <p>파싱 성공까지를 "성공" 으로 세면 {@code 시도 = 성공 + 실패합} 불변식이 깨진다. 응답 수신과 파싱 성공을 나눠 세야 {@code
     * avgTokensPerResponse} 가 "호출 한 번에 실제로 얼마를 쓰는가" 라는 원래 질문에 답한다.
     */
    public void recordResponse(Role role, Integer inputTokens, Integer outputTokens) {
        DailyUsage day = today(role);
        day.responses.incrementAndGet();
        if (inputTokens != null) day.inputTokens.addAndGet(inputTokens);
        if (outputTokens != null) day.outputTokens.addAndGet(outputTokens);
        // 연속 실패 카운터는 여기서 초기화하지 않는다. 응답을 받았다는 것만으로 초기화하면
        // 모델이 매번 깨진 JSON 을 돌려주는 상황에서 파싱 실패가 누적되지 않아 차단기가 안 걸린다.
    }

    /** 응답을 받고 파싱까지 끝난 호출. 여기서만 연속 실패를 초기화한다. */
    public void recordSuccess(Role role) {
        today(role).successes.incrementAndGet();
        resetConsecutiveFailures(role);
    }

    private void resetConsecutiveFailures(Role role) {
        AtomicInteger counter = consecutiveFailures.get(role);
        if (counter != null) counter.set(0);
    }

    public void recordFailure(Role role, LlmFailureKind kind) {
        DailyUsage day = today(role);
        switch (kind) {
            case RATE_LIMIT_MINUTE -> day.rateLimitMinute.incrementAndGet();
            case RATE_LIMIT_DAY -> day.rateLimitDay.incrementAndGet();
            case PARSE -> day.parseFailures.incrementAndGet();
            case OTHER -> day.otherFailures.incrementAndGet();
        }
    }

    /**
     * 일일 한도 차단 만료 시각.
     *
     * <p><b>집계(KST)와 차단을 분리하는 이유.</b> 처음에는 "오늘 일일 429 를 받았는가" 를 KST 달력일로 판정했는데, 그러면 04시 회차가 한 번 막히는
     * 순간 16시 회차가 첫 키워드부터 죽는다. Groq 한도 리셋은 KST 자정이 아니므로 (UTC 자정 = KST 09시가 통설) 오후 회차는 쓸 수 있는 쿼터를 두고
     * 굶게 된다. 보고용 카운터는 KST 로 두고, 제어용 차단만 실제 만료 시각으로 관리한다.
     */
    private final Map<Role, AtomicReference<Instant>> dailyBlockUntil = new ConcurrentHashMap<>();

    /**
     * 일일 429 를 받았을 때 차단 만료를 세운다.
     *
     * <p>서버가 대기 시간을 알려주면 그 값을 쓰고, 없으면 다음 UTC 자정까지 막는다. 이미 더 늦은 만료가 있으면 유지한다.
     */
    public void markDailyQuotaExhausted(Role role, Long retryAfterSeconds) {
        Instant until =
                (retryAfterSeconds != null && retryAfterSeconds > 0)
                        ? Instant.now().plusSeconds(retryAfterSeconds)
                        : LocalDate.now(ZoneOffset.UTC)
                                .plusDays(1)
                                .atStartOfDay(ZoneOffset.UTC)
                                .toInstant();
        dailyBlockUntil
                .computeIfAbsent(role, r -> new AtomicReference<>(Instant.EPOCH))
                .updateAndGet(prev -> prev.isAfter(until) ? prev : until);
    }

    /** 지금 일일 한도로 막혀 있는가. 남은 키워드마다 429 를 더 맞지 않도록 호출 전에 확인한다. */
    public boolean isDailyQuotaExhausted(Role role) {
        AtomicReference<Instant> until = dailyBlockUntil.get(role);
        return until != null && Instant.now().isBefore(until.get());
    }

    /**
     * 성공 없이 이어진 실패 횟수를 센다.
     *
     * <p>한도 종류를 알 수 없는 429(본문이 빈 경우)나 API 키 만료·네트워크 장애 같은 지속 실패는 키워드마다 건너뛰기만 하면 400개를 끝까지 도는 데 수
     * 시간이 걸린다. 연속 실패가 임계를 넘으면 호출부가 크롤을 멈춘다.
     */
    public int recordConsecutiveFailure(Role role) {
        return consecutiveFailures
                .computeIfAbsent(role, r -> new AtomicInteger())
                .incrementAndGet();
    }

    private final Map<Role, AtomicInteger> consecutiveFailures = new ConcurrentHashMap<>();

    /** 크롤 종료 시 한 줄로 남긴다. 관리자가 로그만 보고 원인을 판단할 수 있게. */
    public void logSummary(Role role) {
        log.info("[LlmUsage] {} 오늘 사용량 — {}", role, today(role));
    }

    private String keyOf(Role role) {
        return LocalDate.now(ZoneId.of("Asia/Seoul")) + "|" + role;
    }

    /** 오늘 것만 남긴다. 프로세스가 며칠 떠 있어도 맵이 자라지 않게. */
    private void pruneOldEntries(String todayKey) {
        String todayPrefix = todayKey.substring(0, todayKey.indexOf('|'));
        usage.keySet().removeIf(k -> !k.startsWith(todayPrefix));
    }
}
