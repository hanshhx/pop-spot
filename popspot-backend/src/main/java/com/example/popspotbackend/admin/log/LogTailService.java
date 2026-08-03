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
    // 보안(v2.22): 0(무제한)이면 잠든/죽은 admin 탭의 emitter 가 영구 누수돼 스레드·메모리를
    // 갉아먹는다. 30분 타임아웃 + 30초 keepalive → 정상 클라이언트는 자동 재연결.
    private static final long SSE_TIMEOUT_MS = 30L * 60 * 1000;
    // 동시 구독자 상한 — admin 전용이라 넉넉. 초과 연결은 즉시 거부해 폭증 방지.
    private static final int MAX_SUBSCRIBERS = 50;

    private final LogRingBuffer ringBuffer;

    @Value("${logging.file.name:}")
    private String logFilePath;

    private final CopyOnWriteArrayList<SseEmitter> subscribers = new CopyOnWriteArrayList<>();

    /**
     * 구독자 → 주인(userId). "모든 기기에서 로그아웃" 이 <b>이미 열린</b> 로그 스트림까지 끊기 위해 필요하다.
     *
     * <p>토큰 검사는 스트림을 <b>열 때 한 번</b>만 돈다. 열린 뒤에는 아무도 토큰을 다시 보지 않으므로, 끊어 주지 않으면 철회된 토큰으로 연 스트림이 계속 서버
     * 로그를 흘려보낸다. 서버 로그에는 무엇이 섞여 나갈지 통제할 수 없다.
     */
    private final java.util.Map<SseEmitter, String> subscriberOwners =
            new java.util.concurrent.ConcurrentHashMap<>();

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

    /** 새 SSE 연결 — 백필 후 구독자 등록. 상한 초과 시 즉시 거부. */
    public SseEmitter subscribe(String ownerUserId) {
        if (subscribers.size() >= MAX_SUBSCRIBERS) {
            SseEmitter rejected = new SseEmitter(1L);
            rejected.completeWithError(
                    new IllegalStateException("로그 구독자 수 상한을 초과했습니다. 잠시 후 다시 시도하세요."));
            return rejected;
        }
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitter.onCompletion(() -> forget(emitter));
        emitter.onTimeout(() -> forget(emitter));
        emitter.onError(t -> forget(emitter));
        sendBackfill(emitter);
        subscribers.add(emitter);
        if (ownerUserId != null) subscriberOwners.put(emitter, ownerUserId);
        return emitter;
    }

    private void forget(SseEmitter emitter) {
        subscribers.remove(emitter);
        subscriberOwners.remove(emitter);
    }

    /**
     * 이 사용자가 열어 둔 로그 스트림을 전부 끊는다.
     *
     * @return 끊은 스트림 수
     */
    public int disconnectUser(String userId) {
        if (userId == null) return 0;
        int closed = 0;
        for (java.util.Map.Entry<SseEmitter, String> e : subscriberOwners.entrySet()) {
            if (!userId.equals(e.getValue())) continue;
            try {
                e.getKey().complete();
                closed++;
            } catch (RuntimeException ignored) {
                // 이미 닫히는 중일 수 있다. 나머지는 계속 끊는다.
            }
            forget(e.getKey());
        }
        return closed;
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
