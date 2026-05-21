package com.example.popspotbackend.admin.log;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Iterator;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 로그 파일을 주기적으로 폴링해 새 라인을 SSE 구독자들에게 브로드캐스트.
 *
 * <p>파일 미설정 시 (dev) 시작 안 함. 30 초 keepalive ping 으로 프록시 idle 절단 방지.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LogTailService {

    private static final long POLL_INTERVAL_MS = 500;
    private static final long KEEPALIVE_INTERVAL_SEC = 30;
    private static final long SSE_TIMEOUT_MS = 0; // 0 = 무제한 (클라이언트가 닫을 때까지)

    private final LogRingBuffer ringBuffer;

    @Value("${logging.file.name:}")
    private String logFilePath;

    private final CopyOnWriteArrayList<SseEmitter> subscribers = new CopyOnWriteArrayList<>();
    private ScheduledExecutorService scheduler;
    private long lastReadPosition = 0;

    @PostConstruct
    void start() {
        if (logFilePath == null || logFilePath.isBlank()) {
            log.info("[LogTail] logging.file.name 미설정 — SSE 로그 비활성화");
            return;
        }
        scheduler = Executors.newScheduledThreadPool(1, this::newDaemonThread);
        scheduler.scheduleAtFixedRate(
                this::pollNewLines, 0, POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);
        scheduler.scheduleAtFixedRate(
                this::sendKeepalive,
                KEEPALIVE_INTERVAL_SEC,
                KEEPALIVE_INTERVAL_SEC,
                TimeUnit.SECONDS);
        log.info("[LogTail] 시작 — 파일: {}, 폴링: {}ms", logFilePath, POLL_INTERVAL_MS);
    }

    /** daemon 스레드로 띄워 JVM 종료를 막지 않도록. */
    private Thread newDaemonThread(Runnable r) {
        Thread t = new Thread(r, "log-tail");
        t.setDaemon(true);
        return t;
    }

    @PreDestroy
    void stop() {
        if (scheduler != null) scheduler.shutdownNow();
        for (SseEmitter e : subscribers) e.complete();
        subscribers.clear();
    }

    /** 새 SSE 연결 — 백필 후 구독자 등록. */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitter.onCompletion(() -> subscribers.remove(emitter));
        emitter.onTimeout(() -> subscribers.remove(emitter));
        emitter.onError(t -> subscribers.remove(emitter));
        sendBackfill(emitter);
        subscribers.add(emitter);
        return emitter;
    }

    private void sendBackfill(SseEmitter emitter) {
        try {
            for (String line : ringBuffer.snapshot()) {
                emitter.send(SseEmitter.event().name("log").data(line));
            }
        } catch (IOException e) {
            subscribers.remove(emitter);
            emitter.completeWithError(e);
        }
    }

    /** 매 500ms 호출. 파일 끝에서 새로 추가된 바이트만 읽어 라인 단위로 브로드캐스트. */
    private void pollNewLines() {
        Path path = Paths.get(logFilePath);
        if (!path.toFile().exists()) return;

        try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "r")) {
            long fileLength = raf.length();
            // 파일이 잘렸거나 (rotation) 새로 만들어졌으면 처음부터.
            if (fileLength < lastReadPosition) {
                lastReadPosition = 0;
            }
            if (fileLength == lastReadPosition) return;

            raf.seek(lastReadPosition);
            byte[] bytes = new byte[(int) (fileLength - lastReadPosition)];
            raf.readFully(bytes);
            lastReadPosition = fileLength;

            String chunk = new String(bytes, StandardCharsets.UTF_8);
            for (String line : chunk.split("\\R", -1)) {
                if (!line.isEmpty()) {
                    ringBuffer.add(line);
                    broadcast("log", line);
                }
            }
        } catch (IOException e) {
            log.warn("[LogTail] 파일 읽기 실패: {}", e.getClass().getSimpleName());
        }
    }

    private void sendKeepalive() {
        broadcast("ping", "");
    }

    /** 모든 구독자에게 동일 이벤트 전송. 실패한 emitter 는 자동 제거. */
    private void broadcast(String eventName, String data) {
        Iterator<SseEmitter> it = subscribers.iterator();
        while (it.hasNext()) {
            SseEmitter emitter = it.next();
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                subscribers.remove(emitter);
                emitter.completeWithError(e);
            }
        }
    }
}
