package com.example.popspotbackend.admin.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.distribution.HistogramSnapshot;
import io.micrometer.core.instrument.distribution.ValueAtPercentile;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * HTTP 서버 요청 통계 스냅샷.
 *
 * <p>{@code http.server.requests} Timer 합산. count / mean / p95 / 5xx.
 *
 * <p>p95 는 histogram 활성화 필요 (application.properties 의 percentiles 설정).
 */
@Component
@RequiredArgsConstructor
public class HttpMetricSnapshotProvider implements MetricSnapshotProvider {

    private static final String HTTP_METRIC = "http.server.requests";
    private static final double TARGET_PERCENTILE = 0.95;
    private static final double PERCENTILE_TOLERANCE = 0.001;
    private static final String STATUS_TAG = "status";
    private static final String STATUS_5XX_PREFIX = "5";

    private final MeterRegistry meterRegistry;

    @Override
    public String key() {
        return "http";
    }

    @Override
    public Map<String, Object> snapshot() {
        Map<String, Object> out = new HashMap<>();
        long total = 0;
        long total5xx = 0;
        double totalTimeMs = 0.0;
        double p95Ms = 0.0;

        for (Timer timer : meterRegistry.find(HTTP_METRIC).timers()) {
            total += timer.count();
            totalTimeMs += timer.totalTime(TimeUnit.MILLISECONDS);
            if (isStatus5xx(timer)) {
                total5xx += timer.count();
            }
            p95Ms = Math.max(p95Ms, extractP95Ms(timer));
        }

        double meanMs = total == 0 ? 0.0 : totalTimeMs / total;
        out.put("requestCount", total);
        out.put("status5xxCount", total5xx);
        out.put("errorRate", total == 0 ? 0.0 : round4((double) total5xx / total));
        out.put("meanMs", round2(meanMs));
        out.put("p95Ms", round2(p95Ms));
        return out;
    }

    private boolean isStatus5xx(Timer timer) {
        String status = timer.getId().getTag(STATUS_TAG);
        return status != null && status.startsWith(STATUS_5XX_PREFIX);
    }

    /** histogram 미활성 시 0 반환. */
    private double extractP95Ms(Timer timer) {
        HistogramSnapshot snapshot = timer.takeSnapshot();
        for (ValueAtPercentile vp : snapshot.percentileValues()) {
            if (Math.abs(vp.percentile() - TARGET_PERCENTILE) < PERCENTILE_TOLERANCE) {
                return vp.value(TimeUnit.MILLISECONDS);
            }
        }
        return 0.0;
    }

    private double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    private double round4(double v) {
        return Math.round(v * 10000) / 10000.0;
    }
}
