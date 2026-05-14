package com.example.popspotbackend.controller;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 콘솔용 서버 헬스 메트릭. JVM 메모리 + Micrometer CPU 게이지를 매번 가볍게 계산해 반환. */
@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMetricsController {

    private static final String METRIC_CPU = "system.cpu.usage";
    private static final double BYTES_PER_MB = 1024.0 * 1024.0;

    private final MeterRegistry meterRegistry;

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
