package com.example.popspotbackend.service.seo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

class IndexNowServiceTest {

    @Test
    void notifiesOnlyTheSmallSetOfFrequentlyChangingPages() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        IndexNowService service = configuredService(restTemplate, true);

        server.expect(requestTo("https://searchadvisor.naver.com/indexnow"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(
                        content()
                                .string(
                                        allOf(
                                                containsString("\"host\":\"popspot.co.kr\""),
                                                containsString(
                                                        "https://popspot.co.kr/popups/this-week"),
                                                containsString(
                                                        "https://popspot.co.kr/en/popups/today"),
                                                containsString("https://popspot.co.kr/ja/map"))))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        assertThat(service.notifyFrequentlyChangingPages()).isTrue();
        server.verify();
    }

    @Test
    void disabledConfigurationDoesNotSendARequest() {
        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.createServer(restTemplate);
        IndexNowService service = configuredService(restTemplate, false);

        assertThat(service.notifyFrequentlyChangingPages()).isFalse();
        server.verify();
    }

    private IndexNowService configuredService(RestTemplate restTemplate, boolean enabled) {
        IndexNowService service = new IndexNowService(restTemplate);
        ReflectionTestUtils.setField(service, "enabled", enabled);
        ReflectionTestUtils.setField(service, "key", "9f35c7e8b1d24a60ab437ce12589fd02");
        ReflectionTestUtils.setField(
                service, "endpoint", "https://searchadvisor.naver.com/indexnow");
        return service;
    }
}
