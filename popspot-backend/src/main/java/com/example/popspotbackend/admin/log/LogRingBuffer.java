package com.example.popspotbackend.admin.log;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 최근 N 줄 로그를 메모리에 보관해 새 SSE 연결 시 즉시 백필.
 *
 * <p>{@link #MAX_LINES} 초과 시 FIFO. 모든 접근 synchronized (어드민 동시 접속 수가 적음).
 */
@Component
public class LogRingBuffer {

    private static final int MAX_LINES = 500;

    private final Deque<String> buffer = new ArrayDeque<>(MAX_LINES);

    public synchronized void add(String line) {
        if (buffer.size() >= MAX_LINES) {
            buffer.pollFirst();
        }
        buffer.addLast(line);
    }

    /** 가장 오래된 → 가장 최근 순서로 모든 라인을 복사해 반환 (호출자가 안전하게 순회). */
    public synchronized List<String> snapshot() {
        return Collections.unmodifiableList(new ArrayList<>(buffer));
    }

    public synchronized int size() {
        return buffer.size();
    }
}
