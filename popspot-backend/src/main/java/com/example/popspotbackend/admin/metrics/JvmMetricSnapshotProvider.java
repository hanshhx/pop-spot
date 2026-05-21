package com.example.popspotbackend.admin.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tag;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * JVM 상태 스냅샷 — Heap 사용량 / GC 누적 시간 / 활성 Thread 수.
 *
 * <p>Micrometer 가 부팅 시 자동 등록하는 표준 게이지를 조회한다. 첫 요청 전엔 일부 게이지가 없을 수 있어
 * 모든 조회는 null-safe.
 */
@Component
@RequiredArgsConstructor
public class JvmMetricSnapshotProvider implements MetricSnapshotProvider {

    private static final double BYTES_PER_MB = 1024.0 * 1024.0;

    private final MeterRegistry meterRegistry;

    @Override
    public String key() {
        return "jvm";
    }

    @Override
    public Map<String, Object> snapshot() {
        Map<String, Object> out = new HashMap<>();
        out.put("heapUsedMb", round2(sumByArea("jvm.memory.used", "heap") / BYTES_PER_MB));
        out.put("heapMaxMb", round2(sumByArea("jvm.memory.max", "heap") / BYTES_PER_MB));
        out.put("nonHeapUsedMb", round2(sumByArea("jvm.memory.used", "nonheap") / BYTES_PER_MB));
        out.put("gcPauseSeconds", round2(timerTotal("jvm.gc.pause")));
        out.put("threadsLive", (long) gaugeValue("jvm.threads.live"));
        out.put("threadsDaemon", (long) gaugeValue("jvm.threads.daemon"));
        return out;
    }

    /** 같은 이름의 게이지를 area={heap|nonheap} 태그로 묶어 합산. */
    private double sumByArea(String metricName, String area) {
        double sum = 0.0;
        for (Gauge gauge : meterRegistry.find(metricName).tag("area", area).gauges()) {
            sum += gauge.value();
        }
        return sum;
    }

    private double gaugeValue(String metricName) {
        Gauge gauge = meterRegistry.find(metricName).gauge();
        return gauge == null ? 0.0 : gauge.value();
    }

    /** Timer 의 total time (초 단위). 첫 GC 전엔 0. */
    private double timerTotal(String metricName) {
        return meterRegistry.find(metricName).timers().stream()
                .mapToDouble(t -> t.totalTime(java.util.concurrent.TimeUnit.SECONDS))
                .sum();
    }

    private double round2(double value) {
        return Math.round(value * 100) / 100.0;
    }

    /** (참고) area 태그 누락 게이지를 안전하게 무시. */
    @SuppressWarnings("unused")
    private boolean hasAreaTag(Iterable<Tag> tags) {
        for (Tag t : tags) if ("area".equals(t.getKey())) return true;
        return false;
    }
}
