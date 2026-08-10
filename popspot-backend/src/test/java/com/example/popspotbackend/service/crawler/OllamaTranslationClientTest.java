package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OllamaTranslationClientTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void usesNativeChatWithThinkingDisabledAndUtf8Preserved() throws Exception {
        AtomicReference<String> chatRequest = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/api/tags",
                exchange -> respond(exchange, 200, "{\"models\":[{\"name\":\"qwen3:8b\"}]}"));
        server.createContext(
                "/api/chat",
                exchange -> {
                    chatRequest.set(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    respond(
                            exchange,
                            200,
                            "{\"message\":{\"content\":\"[{\\\"id\\\":1}]\"},"
                                    + "\"prompt_eval_count\":12,\"eval_count\":7}");
                });
        server.start();

        OllamaTranslationClient client =
                new OllamaTranslationClient(
                        new ObjectMapper(), java.net.http.HttpClient.newHttpClient());
        ReflectionTestUtils.setField(client, "enabled", true);
        ReflectionTestUtils.setField(
                client,
                "configuredBaseUrl",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
        ReflectionTestUtils.setField(client, "modelName", "qwen3:8b");

        OllamaTranslationClient.TranslationResponse result = client.translate("외모지상주의 팝업스토어");

        assertThat(result.content()).isEqualTo("[{\"id\":1}]");
        assertThat(result.inputTokens()).isEqualTo(12);
        assertThat(result.outputTokens()).isEqualTo(7);
        assertThat(chatRequest.get()).contains("\"think\":false");
        assertThat(chatRequest.get()).contains("외모지상주의 팝업스토어");
    }

    /**
     * 잘린 응답을 <b>잘렸다고</b> 알리는지 본다.
     *
     * <p>예전에는 잘린 JSON 이 그대로 파서로 넘어가 {@code Unexpected end-of-input: was expecting closing quote} 만
     * 남았다. 그 메시지를 보면 모델이 이상한 답을 했다고 읽게 되지, 출력 한도를 올리면 된다는 데까지 가지 못한다 — 실제로 운영 로그를 두 번 보고서야 알아냈고,
     * 그동안 배치 20건씩이 조용히 버려지고 있었다.
     *
     * <p>여기는 {@code HttpServer} 대신 {@code HttpClient} 를 목으로 세운다. 로컬 소켓 쌍이 막힌 환경에서도 돌아야 하기 때문이다.
     */
    @Test
    void reportsTruncatedResponseInsteadOfLettingTheParserFail() throws Exception {
        java.net.http.HttpClient http = mock(java.net.http.HttpClient.class);
        when(http.send(any(java.net.http.HttpRequest.class), any()))
                .thenAnswer(
                        invocation -> {
                            java.net.http.HttpRequest request = invocation.getArgument(0);
                            boolean tags = request.uri().getPath().endsWith("/api/tags");
                            @SuppressWarnings("unchecked")
                            java.net.http.HttpResponse<String> response =
                                    mock(java.net.http.HttpResponse.class);
                            when(response.statusCode()).thenReturn(200);
                            when(response.body())
                                    .thenReturn(
                                            tags
                                                    ? "{\"models\":[{\"name\":\"qwen3:8b\"}]}"
                                                    // done_reason=length 가 "토큰이 모자라 멈췄다" 는 표시다.
                                                    : "{\"message\":{\"content\":\"[{\\\"id\\\":1,\"},"
                                                            + "\"done_reason\":\"length\"}");
                            return response;
                        });

        OllamaTranslationClient client = new OllamaTranslationClient(new ObjectMapper(), http);
        ReflectionTestUtils.setField(client, "enabled", true);
        ReflectionTestUtils.setField(client, "configuredBaseUrl", "http://127.0.0.1:1/v1");
        ReflectionTestUtils.setField(client, "modelName", "qwen3:8b");

        assertThatThrownBy(() -> client.translate("아무 이름"))
                .describedAs("잘렸다는 사실이 메시지에 드러나야 다음 사람이 한도를 의심한다")
                .hasMessageContaining("잘렸")
                .hasMessageContaining("한도");
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
