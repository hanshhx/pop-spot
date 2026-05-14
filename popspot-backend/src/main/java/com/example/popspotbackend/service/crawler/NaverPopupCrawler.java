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
 * 네이버 검색 API (블로그 + 뉴스) 기반 팝업스토어 자동수집 클라이언트.
 *
 * <p>본문 스크래핑 없이 검색 API 가 반환하는 title/description/link 만 사용. 저작권법 제35조의5 (공정이용) + 출처표시 의무 준수.
 *
 * <p>무료 한도 25,000건/일. 발급: <a
 * href="https://developers.naver.com/products/service-api/search/search.md">네이버 개발자 센터</a>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NaverPopupCrawler {

    private static final String BLOG_ENDPOINT = "https://openapi.naver.com/v1/search/blog.json";
    private static final String NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

    private static final String SOURCE_NAVER_BLOG = "NAVER_BLOG";
    private static final String SOURCE_NAVER_NEWS = "NAVER_NEWS";

    private static final int RESULTS_PER_REQUEST = 30;
    private static final String SORT_BY_DATE = "date";
    private static final String USER_AGENT = "popspot-crawler/1.0 (+https://popspot.co.kr)";

    @Value("${naver.client.id:}")
    private String clientId;

    @Value("${naver.client.secret:}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return isNotBlank(clientId) && isNotBlank(clientSecret);
    }

    public List<PopupCrawlSource> searchBlog(String query) {
        return search(BLOG_ENDPOINT, SOURCE_NAVER_BLOG, query);
    }

    public List<PopupCrawlSource> searchNews(String query) {
        return search(NEWS_ENDPOINT, SOURCE_NAVER_NEWS, query);
    }

    private List<PopupCrawlSource> search(String endpoint, String sourceName, String query) {
        if (!isConfigured()) {
            log.warn("[NaverPopupCrawler] Client ID/Secret 미설정 → 크롤링 스킵");
            return Collections.emptyList();
        }

        try {
            ResponseEntity<String> response = callApi(endpoint, query);
            JsonNode items = objectMapper.readTree(response.getBody()).path("items");
            List<PopupCrawlSource> results = mapItemsToSources(items, sourceName);

            log.info("[NaverPopupCrawler] {} '{}' → {}건", sourceName, query, results.size());
            return results;
        } catch (Exception e) {
            log.error("[NaverPopupCrawler] {} '{}' 호출 실패: {}", sourceName, query, e.toString());
            return Collections.emptyList();
        }
    }

    private ResponseEntity<String> callApi(String endpoint, String query) {
        URI uri =
                UriComponentsBuilder.fromUriString(endpoint)
                        .queryParam("query", query)
                        .queryParam("display", RESULTS_PER_REQUEST)
                        .queryParam("sort", SORT_BY_DATE)
                        .build()
                        .encode()
                        .toUri();

        return restTemplate.exchange(
                uri, HttpMethod.GET, new HttpEntity<>(buildAuthHeaders()), String.class);
    }

    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Naver-Client-Id", clientId);
        headers.set("X-Naver-Client-Secret", clientSecret);
        headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
        return headers;
    }

    private List<PopupCrawlSource> mapItemsToSources(JsonNode items, String sourceName) {
        List<PopupCrawlSource> results = new ArrayList<>();
        for (JsonNode item : items) {
            results.add(toCrawlSource(item, sourceName));
        }
        return results;
    }

    private PopupCrawlSource toCrawlSource(JsonNode item, String sourceName) {
        return PopupCrawlSource.builder()
                .sourceName(sourceName)
                .title(stripHtml(item.path("title").asText("")))
                .description(stripHtml(item.path("description").asText("")))
                .link(item.path("link").asText(""))
                .postDate(item.path("postdate").asText(item.path("pubDate").asText("")))
                .build();
    }

    /** Naver API 는 응답에 {@code <b>제목</b>} 같은 HTML 태그를 끼워 보낸다. 안전하게 제거. */
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

    private boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }
}
