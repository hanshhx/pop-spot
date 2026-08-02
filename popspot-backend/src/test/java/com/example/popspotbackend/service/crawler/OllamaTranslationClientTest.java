package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

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

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
