package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 팝업 이름 번역에만 쓰는 Ollama native API 클라이언트. */
@Component
public class OllamaTranslationClient {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(4);
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(3);

    /**
     * 한 응답으로 받을 최대 토큰.
     *
     * <p>3000 이었다가 올렸다. 한 배치가 20건이고 한 건이 {@code
     * {"id":…,"nameEn":…,"nameJa":…,"locationEn":…,"locationJa":…}} 라 200자 안팎인데, 일본어·한국어는 글자당 토큰이
     * 거의 1:1 이라 20건이면 3000 을 넘긴다. 넘기면 응답이 <b>문자열 중간에서 잘리고</b> 배치 20건이 통째로 버려진다.
     *
     * <p>2026-08-10 운영 로그에 그대로 남아 있다 — {@code Unexpected end-of-input: was expecting closing
     * quote}, 그리고 다른 회차에서는 {@code line: 1, column: 3155}. 3155 라는 위치가 곧 한도였다.
     */
    private static final int MAX_OUTPUT_TOKENS = 8000;

    private static final long HEALTH_CACHE_MS = 30_000L;

    @Value("${ai.translation.local.enabled:false}")
    private boolean enabled;

    @Value("${ai.translation.local.base-url:}")
    private String configuredBaseUrl;

    @Value("${ai.translation.local.model-name:qwen3:8b}")
    private String modelName;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private volatile long lastHealthCheckAt;
    private volatile boolean lastHealthResult;

    public OllamaTranslationClient() {
        this(new ObjectMapper(), HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
    }

    OllamaTranslationClient(ObjectMapper objectMapper, HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public boolean isAvailable() {
        if (!enabled || configuredBaseUrl == null || configuredBaseUrl.isBlank()) return false;

        long now = System.currentTimeMillis();
        if (now - lastHealthCheckAt < HEALTH_CACHE_MS) return lastHealthResult;

        boolean available = false;
        try {
            HttpRequest request =
                    HttpRequest.newBuilder(uri("/api/tags")).timeout(CONNECT_TIMEOUT).GET().build();
            HttpResponse<String> response =
                    httpClient.send(
                            request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 200) {
                JsonNode models = objectMapper.readTree(response.body()).path("models");
                for (JsonNode model : models) {
                    if (modelName.equals(model.path("name").asText())) {
                        available = true;
                        break;
                    }
                }
            }
        } catch (Exception ignored) {
            available = false;
        }
        lastHealthResult = available;
        lastHealthCheckAt = now;
        return available;
    }

    /** Qwen3의 긴 생각 과정을 끄고 구조화 번역 결과만 받는다. */
    public TranslationResponse translate(String prompt) {
        if (!isAvailable()) {
            throw new IllegalStateException("번역용 Ollama 또는 모델을 사용할 수 없습니다: " + modelName);
        }

        try {
            String requestBody =
                    objectMapper.writeValueAsString(
                            Map.of(
                                    "model",
                                    modelName,
                                    "stream",
                                    false,
                                    "think",
                                    false,
                                    "keep_alive",
                                    "10m",
                                    "options",
                                    Map.of("temperature", 0.1, "num_predict", MAX_OUTPUT_TOKENS),
                                    "messages",
                                    java.util.List.of(Map.of("role", "user", "content", prompt))));
            HttpRequest request =
                    HttpRequest.newBuilder(uri("/api/chat"))
                            .timeout(REQUEST_TIMEOUT)
                            .header("Content-Type", "application/json; charset=UTF-8")
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            requestBody, StandardCharsets.UTF_8))
                            .build();
            HttpResponse<String> response =
                    httpClient.send(
                            request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Ollama HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            String content = root.path("message").path("content").asText("").trim();
            if (content.isEmpty()) {
                throw new IllegalStateException("Ollama 응답에 번역 내용이 없습니다");
            }

            /*
             * 잘렸으면 잘렸다고 말한다.
             *
             * 예전에는 잘린 JSON 이 그대로 파서로 넘어가 "Unexpected end-of-input" 같은 Jackson
             * 메시지만 남았다. 그걸 보고는 모델이 이상한 답을 했다고 읽게 되지, 한도를 올리면
             * 된다는 생각에 이르지 못한다. 실제로 운영 로그를 두 번 보고서야 알아냈다.
             */
            if ("length".equals(root.path("done_reason").asText())) {
                throw new IllegalStateException(
                        "응답이 출력 한도("
                                + MAX_OUTPUT_TOKENS
                                + " 토큰)에서 잘렸습니다 — 한도를 올리거나 배치 크기를 줄여야 합니다");
            }
            return new TranslationResponse(
                    content,
                    nullableInt(root, "prompt_eval_count"),
                    nullableInt(root, "eval_count"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Ollama 번역 호출이 중단됐습니다", e);
        } catch (Exception e) {
            throw new IllegalStateException("Ollama 번역 호출 실패: " + e.getMessage(), e);
        }
    }

    private Integer nullableInt(JsonNode root, String field) {
        JsonNode value = root.path(field);
        return value.canConvertToInt() ? value.asInt() : null;
    }

    private URI uri(String path) {
        String base = configuredBaseUrl.trim().replaceAll("/+$", "");
        if (base.endsWith("/v1")) base = base.substring(0, base.length() - 3);
        return URI.create(base + path);
    }

    public record TranslationResponse(String content, Integer inputTokens, Integer outputTokens) {}
}
