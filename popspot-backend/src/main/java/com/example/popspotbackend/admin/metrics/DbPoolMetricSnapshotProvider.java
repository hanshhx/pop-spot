package com.example.popspotbackend.admin.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * DB 커넥션 풀 (HikariCP) 사용량 스냅샷.
 *
 * <p>{@code hikaricp.connections.*} 게이지 합산. pool 여러 개 가능성 대비.
 */
@Component
@RequiredArgsConstructor
public class DbPoolMetricSnapshotProvider implements MetricSnapshotProvider {

    private final MeterRegistry meterRegistry;

    @Override
    public String key() {
        return "db";
    }

    @Override
    public Map<String, Object> snapshot() {
        Map<String, Object> out = new HashMap<>();
        out.put("active", (long) sumGauges("hikaricp.connections.active"));
        out.put("idle", (long) sumGauges("hikaricp.connections.idle"));
        out.put("pending", (long) sumGauges("hikaricp.connections.pending"));
        out.put("max", (long) sumGauges("hikaricp.connections.max"));
        out.put("total", (long) sumGauges("hikaricp.connections"));
        return out;
    }

    private double sumGauges(String metricName) {
        double sum = 0.0;
        for (Gauge gauge : meterRegistry.find(metricName).gauges()) {
            sum += gauge.value();
        }
        return sum;
    }
}
