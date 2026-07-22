package com.example.popspotbackend.service.ai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class OllamaHealthCheckerTest {

    @Test
    void tags가_200이어도_설정모델이_없으면_사용가능으로_보지_않는다() {
        OllamaHealthChecker checker = new OllamaHealthChecker();
        ReflectionTestUtils.setField(checker, "modelName", "qwen2.5:7b");

        boolean missing =
                Boolean.TRUE.equals(
                        ReflectionTestUtils.invokeMethod(
                                checker,
                                "containsConfiguredModel",
                                "{\"models\":[{\"name\":\"llama3:8b\"}]}"));
        boolean present =
                Boolean.TRUE.equals(
                        ReflectionTestUtils.invokeMethod(
                                checker,
                                "containsConfiguredModel",
                                "{\"models\":[{\"name\":\"qwen2.5:7b\"}]}"));

        assertThat(missing).isFalse();
        assertThat(present).isTrue();
    }
}
