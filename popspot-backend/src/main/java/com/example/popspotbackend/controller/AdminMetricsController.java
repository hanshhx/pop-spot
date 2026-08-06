package com.example.popspotbackend.controller;

import com.example.popspotbackend.admin.metrics.MetricSnapshotProvider;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.DoubleSupplier;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 콘솔용 서버 헬스 메트릭.
 *
 * <p>{@code /server-status} — 운영 서버(VM)의 CPU·물리 메모리·디스크와 JVM 힙.
 *
 * <p>{@code /dashboard} — v2, {@link MetricSnapshotProvider} 빈 합성. Provider 1 개 추가로 확장.
 */
@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','ANALYTICS')")
public class AdminMetricsController {

    private static final String METRIC_CPU = "system.cpu.usage";
    private static final double BYTES_PER_MB = 1024.0 * 1024.0;
    private static final double BYTES_PER_GB = 1024.0 * 1024.0 * 1024.0;

    private final MeterRegistry meterRegistry;
    private final List<MetricSnapshotProvider> providers;

    /** 디스크 여유를 재는 기준 경로. 업로드가 쌓이는 곳을 봐야 의미가 있다. */
    @Value("${app.upload.path}")
    private String uploadPath;

    /**
     * 운영 서버(이 VM)의 실시간 자원.
     *
     * <p>v2.53 — {@code memory} 가 <b>JVM 힙</b>이었다. 화면에는 "서버 실시간 리소스" 라고 적혀 있어서, VM 에 8GB 가 있어도 자바가
     * 쓰는 몇백 MB 만 보였다. 디스크는 아예 없었다. 서버가 실제로 여유가 있는지 판단할 수 없는 값이었다.
     *
     * <p>이제 셋을 나눠서 준다.
     *
     * <ul>
     *   <li>{@code memory} / {@code memoryTotal} — <b>OS 물리 메모리</b>. 서버가 버티는지 보는 값.
     *   <li>{@code heap} / {@code heapMax} — JVM 힙. 자바 쪽 누수를 보는 값이라 따로 남긴다.
     *   <li>{@code diskUsed} / {@code diskTotal} — 업로드가 쌓이는 디스크(GB).
     * </ul>
     *
     * <p>{@code cpu} 는 원래부터 {@code system.cpu.usage} — VM 전체 기준이라 그대로 둔다.
     *
     * <p>어느 하나가 실패해도 나머지는 내보낸다. 관리자 화면의 참고 지표라 한 값 때문에 전체가 비면 오히려 손해다.
     */
    @GetMapping("/server-status")
    public ResponseEntity<Map<String, Object>> getServerStatus() {
        Map<String, Object> metrics = new HashMap<>();

        put(metrics, "cpu", this::currentCpuUsagePercent);
        put(metrics, "heap", this::currentHeapUsedMb);
        put(metrics, "heapMax", () -> Runtime.getRuntime().maxMemory() / BYTES_PER_MB);
        put(metrics, "memory", this::systemMemoryUsedMb);
        put(metrics, "memoryTotal", this::systemMemoryTotalMb);
        put(metrics, "diskUsed", this::diskUsedGb);
        put(metrics, "diskTotal", this::diskTotalGb);

        metrics.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(metrics);
    }

    /** 값 하나가 실패해도 0 으로 채우고 나머지는 살린다. */
    private void put(Map<String, Object> out, String key, DoubleSupplier supplier) {
        try {
            out.put(key, roundToTwoDecimals(supplier.getAsDouble()));
        } catch (Exception | LinkageError e) {
            out.put(key, 0.0);
        }
    }

    /**
     * 어드민 대시보드 통합 메트릭. 키별로 묶음 (jvm / http / db / crawler ...).
     *
     * <p>각 Provider 가 자체 try-catch 안 하므로 한 Provider 가 던지면 응답 전체가 5xx 가 된다. 운영 안전을 위해 여기서 한 번 더 감싼다.
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

    /** JVM 힙 사용량. <b>서버 메모리가 아니다</b> — 자바가 쥐고 있는 양이다. */
    private double currentHeapUsedMb() {
        Runtime runtime = Runtime.getRuntime();
        return (runtime.totalMemory() - runtime.freeMemory()) / BYTES_PER_MB;
    }

    /**
     * OS 물리 메모리 — 전체와 사용 중.
     *
     * <p>{@code com.sun.management.OperatingSystemMXBean} 은 HotSpot 계열(운영은 Temurin)에만 있다. 다른 JVM
     * 에서는 캐스팅이 실패하는데, {@link #put} 이 그때 0 으로 채우고 나머지 값은 살린다.
     */
    private double systemMemoryTotalMb() {
        return osBean().getTotalMemorySize() / BYTES_PER_MB;
    }

    private double systemMemoryUsedMb() {
        com.sun.management.OperatingSystemMXBean os = osBean();
        return (os.getTotalMemorySize() - os.getFreeMemorySize()) / BYTES_PER_MB;
    }

    private com.sun.management.OperatingSystemMXBean osBean() {
        return (com.sun.management.OperatingSystemMXBean)
                ManagementFactory.getOperatingSystemMXBean();
    }

    /**
     * 업로드가 쌓이는 디스크.
     *
     * <p>기준은 <b>업로드 폴더가 있는 파일시스템</b>이다. 루트를 보면 업로드가 별도 볼륨일 때 엉뚱한 숫자가 나온다 — 정작 차는 쪽을 못 본다.
     */
    private double diskTotalGb() {
        return new File(uploadPath).getTotalSpace() / BYTES_PER_GB;
    }

    private double diskUsedGb() {
        File root = new File(uploadPath);
        return (root.getTotalSpace() - root.getUsableSpace()) / BYTES_PER_GB;
    }

    private double roundToTwoDecimals(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
