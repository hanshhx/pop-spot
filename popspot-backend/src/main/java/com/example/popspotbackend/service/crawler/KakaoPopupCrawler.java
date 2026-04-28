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
 * 카카오 검색 API (웹/블로그) 기반 팝업스토어 자동수집 클라이언트.
 *
 * - Endpoint: https://dapi.kakao.com/v2/search/{web|blog}
 * - 약관: https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide
 *   (개발자 등록 후 무료, 30,000건/일 한도)
 * - title/contents/url 만 사용. 본문 스크래핑 X.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KakaoPopupCrawler {

    private static final String WEB_ENDPOINT = "https://dapi.kakao.com/v2/search/web";
    private static final String BLOG_ENDPOINT = "https://dapi.kakao.com/v2/search/blog";

    private static final int SIZE = 30;
    private static final String SORT = "recency";   // 최신순

    @Value("${kakao.rest.api-key:${kakao.api.key:}}")
    private String kakaoApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return kakaoApiKey != null && !kakaoApiKey.isBlank();
    }

    public List<PopupCrawlSource> searchWeb(String query) {
        return search(WEB_ENDPOINT, "KAKAO_WEB", query);
    }

    public List<PopupCrawlSource> searchBlog(String query) {
        return search(BLOG_ENDPOINT, "KAKAO_BLOG", query);
    }

    private List<PopupCrawlSource> search(String endpoint, String sourceName, String query) {
        if (!isConfigured()) {
            log.warn("[KakaoPopupCrawler] REST API Key 미설정 → 크롤링 스킵");
            return Collections.emptyList();
        }

        try {
            URI uri = UriComponentsBuilder.fromUriString(endpoint)
                    .queryParam("query", query)
                    .queryParam("size", SIZE)
                    .queryParam("sort", SORT)
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, "KakaoAK " + kakaoApiKey);
            headers.set(HttpHeaders.USER_AGENT, "popspot-crawler/1.0 (+https://popspot.co.kr)");

            ResponseEntity<String> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode docs = root.path("documents");

            List<PopupCrawlSource> results = new ArrayList<>();
            for (JsonNode doc : docs) {
                results.add(PopupCrawlSource.builder()
                        .sourceName(sourceName)
                        .title(stripHtml(doc.path("title").asText("")))
                        .description(stripHtml(doc.path("contents").asText("")))
                        .link(doc.path("url").asText(""))
                        .postDate(doc.path("datetime").asText(""))
                        .build());
            }
            log.info("[KakaoPopupCrawler] {} '{}' → {}건", sourceName, query, results.size());
            return results;

        } catch (Exception e) {
            log.error("[KakaoPopupCrawler] {} '{}' 호출 실패: {}", sourceName, query, e.toString());
            return Collections.emptyList();
        }
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
