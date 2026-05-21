package com.example.popspotbackend.controller;

import com.example.popspotbackend.admin.metrics.MetricSnapshotProvider;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 콘솔용 서버 헬스 메트릭.
 *
 * <p>{@code /server-status} — v1 형식. CPU 게이지 + JVM 힙 계산 (기존 프론트 차트 호환).
 *
 * <p>{@code /dashboard} — v2 형식. {@link MetricSnapshotProvider} 빈을 모두 합쳐 키별로
 * 묶어 반환. 새 메트릭 카드 추가 = Provider 1 개 추가만으로 끝.
 */
@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMetricsController {

    private static final String METRIC_CPU = "system.cpu.usage";
    private static final double BYTES_PER_MB = 1024.0 * 1024.0;

    private final MeterRegistry meterRegistry;
    private final List<MetricSnapshotProvider> providers;

    @GetMapping("/server-status")
    public ResponseEntity<Map<String, Object>> getServerStatus() {
        Map<String, Object> metrics = new HashMap<>();
        try {
            metrics.put("cpu", roundToTwoDecimals(currentCpuUsagePercent()));
            metrics.put("memory", roundToTwoDecimals(currentUsedMemoryMb()));
        } catch (Exception e) {
            metrics.put("cpu", 0.0);
            metrics.put("memory", 0.0);
        }
        metrics.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(metrics);
    }

    /**
     * 어드민 대시보드 통합 메트릭. 키별로 묶음 (jvm / http / db / crawler ...).
     *
     * <p>각 Provider 가 자체 try-catch 안 하므로 한 Provider 가 던지면 응답 전체가 5xx 가 된다. 운영
     * 안전을 위해 여기서 한 번 더 감싼다.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        Map<String, Object> out = new HashMap<>();
        for (MetricSnapshotProvider p : providers) {
            try {
                out.put(p.key(), p.snapshot());
            } catch (Exception e) {
                out.put(p.key(), Map.of("error", e.getClass().getSimpleName()));
            }
        }
        out.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(out);
    }

    private double currentCpuUsagePercent() {
        Gauge gauge = meterRegistry.find(METRIC_CPU).gauge();
        return gauge != null ? gauge.value() * 100 : 0.0;
    }

    private double currentUsedMemoryMb() {
        Runtime runtime = Runtime.getRuntime();
        double totalMb = runtime.totalMemory() / BYTES_PER_MB;
        double freeMb = runtime.freeMemory() / BYTES_PER_MB;
        return totalMb - freeMb;
    }

    private double roundToTwoDecimals(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
