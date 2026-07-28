package com.example.popspotbackend.service.crawler;

import java.time.Duration;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * 원본 글의 본문 텍스트를 가져온다 — 날짜 2차 보강({@code PopupDateBackfillService})에서만 쓴다.
 *
 * <p>v2.46 — 1차 수집은 검색 API 의 짧은 요약문만 본다. 기간이 요약문에 안 잡히는 팝업이 많아, 날짜가 빈 것만 골라 원본 글을 한 번 더 읽는다. 대상이
 * 전체가 아니라 결손분뿐이라 부하가 작다.
 */
@Slf4j
@Component
public class SourceBodyFetcher {

    /** 블로그 본문은 길다. 앞쪽에 기간이 나오는 편이고, 너무 크면 메모리·정규식 비용만 든다. */
    private static final int MAX_BODY_CHARS = 60_000;

    private static final String USER_AGENT =
            "Mozilla/5.0 (compatible; PopSpotBot/1.0; +https://popspot.co.kr)";

    /**
     * 네이버 블로그 주소에서 blogId / logNo.
     *
     * <p>네이버 블로그는 본문이 {@code iframe} 안에 있어 겉 페이지를 받으면 <b>빈 껍데기</b>가 온다. 실제 본문은 {@code
     * PostView.naver} 로 따로 요청해야 한다(실측 19건 전부 이 경로로 성공).
     */
    private static final Pattern NAVER_BLOG =
            Pattern.compile("blog\\.naver\\.com/([^/?#]+)/(\\d+)");

    /**
     * 타임아웃을 반드시 건다 — 외부 블로그를 순차로 읽으므로 한 곳이 응답을 안 주면 그 뒤 전부가 밀린다. {@code new RestTemplate()} 기본값은 무한
     * 대기다.
     */
    private final RestTemplate restTemplate = new RestTemplate(timeoutFactory());

    private static SimpleClientHttpRequestFactory timeoutFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(10));
        return factory;
    }

    /** 본문 텍스트(태그 제거). 실패하면 empty — 호출자는 그 팝업만 건너뛴다. */
    public Optional<String> fetchText(String url) {
        if (url == null || url.isBlank()) return Optional.empty();
        String target = resolveTarget(url);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.USER_AGENT, USER_AGENT);
            ResponseEntity<String> res =
                    restTemplate.exchange(
                            target, HttpMethod.GET, new HttpEntity<>(headers), String.class);
            String html = res.getBody();
            if (html == null || html.isBlank()) return Optional.empty();
            return Optional.of(stripHtml(html));
        } catch (Exception e) {
            log.debug("[BodyFetch] 실패 {} — {}", target, e.toString());
            return Optional.empty();
        }
    }

    private String resolveTarget(String url) {
        Matcher m = NAVER_BLOG.matcher(url);
        if (m.find()) {
            return "https://blog.naver.com/PostView.naver?blogId="
                    + m.group(1)
                    + "&logNo="
                    + m.group(2);
        }
        return url;
    }

    private String stripHtml(String html) {
        String text =
                html.replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                        .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
                        .replaceAll("(?s)<[^>]+>", " ")
                        .replace("&nbsp;", " ")
                        .replace("&amp;", "&")
                        .replaceAll("\\s+", " ")
                        .trim();
        return text.length() > MAX_BODY_CHARS ? text.substring(0, MAX_BODY_CHARS) : text;
    }
}
