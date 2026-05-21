package com.example.popspotbackend.admin.metrics;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 데이터베이스 커넥션 풀 (HikariCP) 사용량 스냅샷.
 *
 * <p>HikariCP 가 자동 등록하는 {@code hikaricp.connections.*} 게이지를 조회한다. pool 이름이 여러 개일
 * 수 있어 같은 metric 의 모든 인스턴스를 합산.
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
