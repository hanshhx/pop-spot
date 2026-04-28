package com.example.popspotbackend.service.crawler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 네이버 검색 API (블로그/뉴스) 기반 팝업스토어 자동수집 클라이언트.
 *
 * - Endpoint: https://openapi.naver.com/v1/search/{blog|news}.json
 * - 약관: https://developers.naver.com/products/service-api/search/search.md
 *   (개발자 등록 후 무료, 25,000건/일 한도)
 * - 본문 스크래핑 안 함. 검색 API 가 반환하는 title/description/link 만 사용.
 *   → 저작권법 제35조의5(공정이용) + 출처표시 의무 준수.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NaverPopupCrawler {

    private static final String BLOG_ENDPOINT = "https://openapi.naver.com/v1/search/blog.json";
    private static final String NEWS_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

    private static final int DISPLAY = 30;          // API 한 번에 30건
    private static final String SORT = "date";      // 최신순

    @Value("${naver.client.id:}")
    private String clientId;

    @Value("${naver.client.secret:}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank()
                && clientSecret != null && !clientSecret.isBlank();
    }

    public List<PopupCrawlSource> searchBlog(String query) {
        return search(BLOG_ENDPOINT, "NAVER_BLOG", query);
    }

    public List<PopupCrawlSource> searchNews(String query) {
        return search(NEWS_ENDPOINT, "NAVER_NEWS", query);
    }

    private List<PopupCrawlSource> search(String endpoint, String sourceName, String query) {
        if (!isConfigured()) {
            log.warn("[NaverPopupCrawler] Client ID/Secret 미설정 → 크롤링 스킵");
            return Collections.emptyList();
        }

        try {
            URI uri = UriComponentsBuilder.fromUriString(endpoint)
                    .queryParam("query", query)
                    .queryParam("display", DISPLAY)
                    .queryParam("sort", SORT)
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Naver-Client-Id", clientId);
            headers.set("X-Naver-Client-Secret", clientSecret);
            headers.set(HttpHeaders.USER_AGENT, "popspot-crawler/1.0 (+https://popspot.co.kr)");

            ResponseEntity<String> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode items = root.path("items");

            List<PopupCrawlSource> results = new ArrayList<>();
            for (JsonNode item : items) {
                results.add(PopupCrawlSource.builder()
                        .sourceName(sourceName)
                        .title(stripHtml(item.path("title").asText("")))
                        .description(stripHtml(item.path("description").asText("")))
                        .link(item.path("link").asText(""))
                        .postDate(item.path("postdate").asText(
                                item.path("pubDate").asText("")))
                        .build());
            }
            log.info("[NaverPopupCrawler] {} '{}' → {}건", sourceName, query, results.size());
            return results;

        } catch (Exception e) {
            log.error("[NaverPopupCrawler] {} '{}' 호출 실패: {}", sourceName, query, e.toString());
            return Collections.emptyList();
        }
    }

    /** Naver API 가 <b>제목</b> 같은 HTML 태그를 끼워보냄 → 안전하게 제거. */
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
