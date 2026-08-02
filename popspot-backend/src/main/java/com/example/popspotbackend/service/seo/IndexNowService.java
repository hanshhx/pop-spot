package com.example.popspotbackend.service.seo;

import com.example.popspotbackend.config.HttpClients;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 팝업 데이터가 실제로 달라졌을 때 IndexNow 로 검색엔진에 갱신 사실을 알린다.
 *
 * <p>사이트맵 720개를 매번 다시 보내지 않는다. 날짜가 지나거나 신규 팝업이 들어오면 내용이 바로 달라지는 홈·지도·시점 랜딩만 한국어/영어/일본어 주소로 전송한다.
 * 색인을 보장하는 기능이 아니라 재방문을 기다리는 시간을 줄이는 보조 신호다.
 */
@Slf4j
@Service
public class IndexNowService {

    private static final String SITE_HOST = "popspot.co.kr";
    private static final String SITE_ORIGIN = "https://popspot.co.kr";
    private static final String USER_AGENT = "popspot-indexnow/1.0 (+https://popspot.co.kr)";
    private static final List<String> LOCALE_PREFIXES = List.of("", "/en", "/ja");
    private static final List<String> CHANGING_PATHS =
            List.of(
                    "",
                    "/map",
                    "/popups/today",
                    "/popups/tomorrow",
                    "/popups/this-week",
                    "/popups/this-weekend",
                    "/popups/this-month");

    private final RestTemplate restTemplate;

    @Value("${popspot.indexnow.enabled:true}")
    private boolean enabled;

    @Value("${popspot.indexnow.key:9f35c7e8b1d24a60ab437ce12589fd02}")
    private String key;

    @Value("${popspot.indexnow.endpoint:https://searchadvisor.naver.com/indexnow}")
    private String endpoint;

    public IndexNowService() {
        this(HttpClients.withTimeouts());
    }

    IndexNowService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** 변경 가능성이 높은 공개 랜딩을 한 번의 POST 로 알린다. 실패해도 크롤 저장은 되돌리지 않는다. */
    public boolean notifyFrequentlyChangingPages() {
        if (!enabled || key == null || key.isBlank()) {
            log.debug("[IndexNow] disabled or key missing — 스킵");
            return false;
        }

        List<String> urls = new ArrayList<>();
        for (String localePrefix : LOCALE_PREFIXES) {
            for (String path : CHANGING_PATHS) {
                urls.add(SITE_ORIGIN + localePrefix + path);
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("host", SITE_HOST);
        body.put("key", key);
        body.put("keyLocation", SITE_ORIGIN + "/" + key + ".txt");
        body.put("urlList", urls);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.USER_AGENT, USER_AGENT);

        try {
            ResponseEntity<Void> response =
                    restTemplate.exchange(
                            URI.create(endpoint),
                            HttpMethod.POST,
                            new HttpEntity<>(body, headers),
                            Void.class);
            boolean accepted =
                    response.getStatusCode().value() == 200
                            || response.getStatusCode().value() == 202;
            if (accepted) {
                log.info(
                        "[IndexNow] {}개 URL 갱신 알림 접수 ({})",
                        urls.size(),
                        response.getStatusCode().value());
            } else {
                log.warn("[IndexNow] 예상 밖 응답 {}", response.getStatusCode().value());
            }
            return accepted;
        } catch (Exception e) {
            log.warn("[IndexNow] 갱신 알림 실패 — 다음 크롤 때 재시도: {}", e.toString());
            return false;
        }
    }
}
