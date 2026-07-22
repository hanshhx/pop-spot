package com.example.popspotbackend.service.ai;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 로컬 Ollama(4060 Ti PC)가 지금 응답하는지 확인한다.
 *
 * <p><b>왜 필요한가.</b> 크롤러는 PC 가 켜져 있으면 로컬 Ollama(무제한)로, 꺼져 있으면 Groq(rate limit) 로 돌아야 한다. PC 를 강제로 켜둘
 * 필요가 없게 하려는 것이 핵심이라, 매 크롤마다 "지금 PC 가 살아있나" 를 확인해 그때그때 고른다. Ollama 의 {@code /api/tags} 에 짧은 타임아웃으로
 * GET 을 날려 판정한다.
 *
 * <p><b>캐시.</b> 한 크롤 회차에서 정규화가 여러 번 호출되므로 매번 핑을 날리면 낭비다. 결과를 짧게 캐시해 회차 중에는 한 번만 확인한다.
 *
 * <p><b>비활성 시.</b> {@code ai.crawler.local.enabled=false}(기본값)면 항상 {@code false} 를 돌려줘 크롤러가 Groq 만
 * 쓴다. 즉 이 코드를 배포해도 로컬을 켜기 전까지는 동작이 바뀌지 않는다.
 */
@Slf4j
@Component
public class OllamaHealthChecker {

    private static final Duration CHECK_TIMEOUT = Duration.ofSeconds(2);
    private static final long CACHE_MILLIS = 30_000L;

    @Value("${ai.crawler.local.enabled:false}")
    private boolean enabled;

    @Value("${ai.crawler.local.health-url:}")
    private String healthUrl;

    private final HttpClient httpClient =
            HttpClient.newBuilder().connectTimeout(CHECK_TIMEOUT).build();

    private volatile boolean lastResult = false;
    private volatile long lastCheckAt = 0L;

    /** 로컬 Ollama 가 지금 응답하는가. 비활성이거나 URL 미설정이면 항상 false. 결과는 {@link #CACHE_MILLIS} 동안 캐시된다. */
    public boolean isAvailable() {
        if (!enabled || healthUrl == null || healthUrl.isBlank()) return false;

        long now = System.currentTimeMillis();
        if (now - lastCheckAt < CACHE_MILLIS) return lastResult;
        lastCheckAt = now;
        lastResult = ping();
        return lastResult;
    }

    private boolean ping() {
        try {
            HttpRequest request =
                    HttpRequest.newBuilder()
                            .uri(URI.create(healthUrl))
                            .timeout(CHECK_TIMEOUT)
                            .GET()
                            .build();
            HttpResponse<Void> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            boolean ok = response.statusCode() == 200;
            if (ok) {
                log.info("[Ollama] 로컬 LLM 응답 확인 — 로컬로 크롤합니다. ({})", healthUrl);
            } else {
                log.info(
                        "[Ollama] 로컬 LLM HTTP {} → Groq 로 fallback. ({})",
                        response.statusCode(),
                        healthUrl);
            }
            return ok;
        } catch (Exception e) {
            // PC 가 꺼져 있거나 네트워크 단절 — 정상적인 fallback 경로다.
            log.info("[Ollama] 로컬 LLM 미응답({}) → Groq 로 fallback.", e.getClass().getSimpleName());
            return false;
        }
    }
}
