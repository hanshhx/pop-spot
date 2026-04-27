package com.example.popspotbackend.controller; // 🔥 이 줄이 빠져서 에러가 난 겁니다!

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMetricsController {

    private final MeterRegistry meterRegistry;

    @GetMapping("/server-status")
    public ResponseEntity<?> getServerStatus() {
        Map<String, Object> metrics = new HashMap<>();

        try {
            // CPU 사용량 (%) - Micrometer에서 시스템 CPU 지표를 가져옵니다.
            double cpuUsage = 0.0;
            var cpuGauge = meterRegistry.find("system.cpu.usage").gauge();
            if (cpuGauge != null) {
                cpuUsage = cpuGauge.value() * 100;
            }

            // 메모리 사용량 (MB) - 현재 JVM의 메모리 사용량을 계산합니다.
            double totalMemory = Runtime.getRuntime().totalMemory() / (1024.0 * 1024.0);
            double freeMemory = Runtime.getRuntime().freeMemory() / (1024.0 * 1024.0);
            double usedMemory = totalMemory - freeMemory;

            metrics.put("cpu", Math.round(cpuUsage * 100) / 100.0);
            metrics.put("memory", Math.round(usedMemory * 100) / 100.0);
            metrics.put("timestamp", System.currentTimeMillis());

            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            // 초기 구동 시 지표가 아직 수집되지 않았을 경우를 대비한 예외 처리
            metrics.put("cpu", 0.0);
            metrics.put("memory", 0.0);
            metrics.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.ok(metrics);
        }
    }
}