package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.repository.PopupStoreRepository;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** 관리자 요청 한 번으로 번역 백필을 여러 배치에 나눠 끝까지 실행한다. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupTranslationBulkJobService {

    private final PopupTranslationBackfillService backfillService;
    private final PopupStoreRepository popupStoreRepository;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicReference<JobStatus> status = new AtomicReference<>(JobStatus.idle());

    public Map<String, Object> start(boolean retryMissing) {
        if (!running.compareAndSet(false, true)) {
            return response(false, status.get());
        }

        OffsetDateTime startedAt = OffsetDateTime.now();
        status.set(JobStatus.running(startedAt));
        Thread.ofVirtual()
                .name("popup-translation-backfill")
                .start(() -> run(retryMissing, startedAt));
        return response(true, status.get());
    }

    public Map<String, Object> status() {
        return response(false, status.get());
    }

    private void run(boolean retryMissing, OffsetDateTime startedAt) {
        int requeued = 0;
        int attempted = 0;
        int translated = 0;
        int skipped = 0;
        try {
            if (retryMissing) {
                requeued = popupStoreRepository.requeueMissingTranslations();
            }

            while (!Thread.currentThread().isInterrupted()) {
                Map<String, Integer> batch = backfillService.runOnce();
                int targets = batch.getOrDefault("targets", 0);
                int batchAttempted = batch.getOrDefault("attempted", 0);
                attempted += batchAttempted;
                translated += batch.getOrDefault("translated", 0);
                skipped += batch.getOrDefault("skipped", 0);

                if (targets == 0) {
                    status.set(
                            JobStatus.finished(
                                    "COMPLETED",
                                    startedAt,
                                    requeued,
                                    attempted,
                                    translated,
                                    skipped,
                                    null));
                    return;
                }
                if (batchAttempted == 0) {
                    status.set(
                            JobStatus.finished(
                                    "PAUSED",
                                    startedAt,
                                    requeued,
                                    attempted,
                                    translated,
                                    skipped,
                                    "Ollama를 사용할 수 없거나 배치 응답이 모두 실패했습니다"));
                    return;
                }
                status.set(
                        new JobStatus(
                                "RUNNING",
                                startedAt,
                                OffsetDateTime.now(),
                                requeued,
                                attempted,
                                translated,
                                skipped,
                                null));
            }
        } catch (Exception e) {
            log.error("[TranslationBulkJob] 실패", e);
            status.set(
                    JobStatus.finished(
                            "FAILED",
                            startedAt,
                            requeued,
                            attempted,
                            translated,
                            skipped,
                            safeMessage(e)));
        } finally {
            running.set(false);
        }
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.isBlank()) return error.getClass().getSimpleName();
        return message.length() <= 300 ? message : message.substring(0, 300);
    }

    private Map<String, Object> response(boolean started, JobStatus current) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("started", started);
        response.put("running", running.get());
        response.put("state", current.state());
        response.put("startedAt", current.startedAt());
        response.put("updatedAt", current.updatedAt());
        response.put("requeued", current.requeued());
        response.put("attempted", current.attempted());
        response.put("translated", current.translated());
        response.put("skipped", current.skipped());
        response.put("message", current.message());
        return response;
    }

    private record JobStatus(
            String state,
            OffsetDateTime startedAt,
            OffsetDateTime updatedAt,
            int requeued,
            int attempted,
            int translated,
            int skipped,
            String message) {

        private static JobStatus idle() {
            return new JobStatus("IDLE", null, OffsetDateTime.now(), 0, 0, 0, 0, null);
        }

        private static JobStatus running(OffsetDateTime startedAt) {
            return new JobStatus("RUNNING", startedAt, startedAt, 0, 0, 0, 0, null);
        }

        private static JobStatus finished(
                String state,
                OffsetDateTime startedAt,
                int requeued,
                int attempted,
                int translated,
                int skipped,
                String message) {
            return new JobStatus(
                    state,
                    startedAt,
                    OffsetDateTime.now(),
                    requeued,
                    attempted,
                    translated,
                    skipped,
                    message);
        }
    }
}
