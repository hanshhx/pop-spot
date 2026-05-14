package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 카카오 검색 API (웹 + 블로그) 기반 팝업스토어 자동수집 클라이언트.
 *
 * <p>title / contents / url 만 사용 — 본문 스크래핑 X. 저작권 안전.
 *
 * <p>무료 한도 30,000건/일. 발급: <a
 * href="https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide">카카오 개발자 가이드</a>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoPopupCrawler {

    private static final String WEB_ENDPOINT = "https://dapi.kakao.com/v2/search/web";
    private static final String BLOG_ENDPOINT = "https://dapi.kakao.com/v2/search/blog";

    private static final String SOURCE_KAKAO_WEB = "KAKAO_WEB";
    private static final String SOURCE_KAKAO_BLOG = "KAKAO_BLOG";

    private static final int RESULTS_PER_REQUEST = 30;
    private static final String SORT_BY_RECENCY = "recency";
    private static final String USER_AGENT = "popspot-crawler/1.0 (+https://popspot.co.kr)";

    @Value("${kakao.rest.api-key:${kakao.api.key:}}")
    private String kakaoApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return kakaoApiKey != null && !kakaoApiKey.isBlank();
    }

    public List<PopupCrawlSource> searchWeb(String query) {
        return search(WEB_ENDPOINT, SOURCE_KAKAO_WEB, query);
    }

    public List<PopupCrawlSource> searchBlog(String query) {
        return search(BLOG_ENDPOINT, SOURCE_KAKAO_BLOG, query);
    }

    private List<PopupCrawlSource> search(String endpoint, String sourceName, String query) {
        if (!isConfigured()) {
            log.warn("[KakaoPopupCrawler] REST API Key 미설정 → 크롤링 스킵");
            return Collections.emptyList();
        }

        try {
            ResponseEntity<String> response = callApi(endpoint, query);
            JsonNode documents = objectMapper.readTree(response.getBody()).path("documents");
            List<PopupCrawlSource> results = mapDocumentsToSources(documents, sourceName);

            log.info("[KakaoPopupCrawler] {} '{}' → {}건", sourceName, query, results.size());
            return results;
        } catch (Exception e) {
            log.error("[KakaoPopupCrawler] {} '{}' 호출 실패: {}", sourceName, query, e.toString());
            return Collections.emptyList();
        }
    }

    private ResponseEntity<String> callApi(String endpoint, String query) {
        URI uri =
                UriComponentsBuilder.fromUriString(endpoint)
                        .queryParam("query", query)
                        .queryParam("size", RESULTS_PER_REQUEST)
                        .queryParam("sort", SORT_BY_RECENCY)
                        .build()
                        .encode()
                        .toUri();

        return restTemplate.exchange(
                uri, HttpMethod.GET, new HttpEntity<>(buildAuthHeaders()), String.class);
    }

    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "KakaoAK " + kakaoApiKey);
        headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
        return headers;
    }

    private List<PopupCrawlSource> mapDocumentsToSources(JsonNode documents, String sourceName) {
        List<PopupCrawlSource> results = new ArrayList<>();
        for (JsonNode doc : documents) {
            results.add(toCrawlSource(doc, sourceName));
        }
        return results;
    }

    private PopupCrawlSource toCrawlSource(JsonNode doc, String sourceName) {
        return PopupCrawlSource.builder()
                .sourceName(sourceName)
                .title(stripHtml(doc.path("title").asText("")))
                .description(stripHtml(doc.path("contents").asText("")))
                .link(doc.path("url").asText(""))
                .postDate(doc.path("datetime").asText(""))
                .build();
    }

    private String stripHtml(String s) {
        if (s == null) return "";
        return s.replaceAll("<[^>]*>", "")
                .replaceAll("&quot;", "\"")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&nbsp;", " ")
                .trim();
    }
}
