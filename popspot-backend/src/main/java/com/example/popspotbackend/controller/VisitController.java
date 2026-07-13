package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.VisitService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 익명 방문 비콘 수신.
 *
 * <p>로그인 불필요(게스트도 기록). 로그인 여부(guest)·경로만 받고 IP·개인정보는 저장하지 않는다. 항상 204 로 응답해 클라이언트 부담을 없앤다.
 *
 * <p>봇 제외: 검색엔진 크롤러(Googlebot/Yeti 등)·헤드리스·HTTP 클라이언트는 JS 를 실행하며 비콘을 쏴 방문자 수를 뻥튀기하므로 User-Agent 로
 * 걸러 기록하지 않는다. 실제 브라우저는 모두 UA 에 "mozilla" 를 담으므로 그게 없으면(스크립트/HTTP 라이브러리) 봇으로 간주한다.
 * User-Agent 는 남은 봇을 식별해 필터를 다듬을 수 있도록 기록해 둔다(개인 식별 불가).
 */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    /** UA(소문자)에 하나라도 포함되면 봇으로 간주해 기록하지 않는다. */
    private static final String[] BOT_UA_MARKERS = {
        // 검색/AI 크롤러 (이름에 bot/spider 없는 변종 포함)
        "bot", "crawl", "spider", "slurp", "yeti", "daumoa", "google", "bing", "yandex", "baidu",
        "sogou", "duckduck", "perplexity", "anthropic", "cohere", "diffbot", "petal", "exabot",
        "mj12", "semrush", "ahrefs", "dotbot", "dataforseo", "blex", "seokicks", "megaindex",
        // 소셜/링크 프리뷰
        "facebookexternalhit", "facebookcatalog", "meta-external", "kakaotalk-scrap", "pinterest",
        "linkedin", "whatsapp", "telegram", "discord", "slack", "twitter", "embedly", "quora",
        "outbrain", "vkshare", "flipboard", "nuzzel", "skypeuripreview", "snapchat",
        // 헤드리스/자동화
        "headless", "prerender", "rendertron", "phantom", "puppeteer", "playwright", "selenium",
        "webdriver", "chromedriver", "cypress", "jsdom",
        // 성능/모니터링/감사
        "lighthouse", "pagespeed", "gtmetrix", "pingdom", "uptimerobot", "statuscake", "site24x7",
        "webpagetest", "datadog", "newrelic", "checkly", "screaming frog", "sitebulb",
        // HTTP 클라이언트/라이브러리
        "python-requests", "python-urllib", "curl/", "wget/", "go-http", "okhttp", "java/",
        "node-fetch", "axios/", "libwww", "scrapy", "http-client", "apache-httpclient", "guzzle",
        "aiohttp", "httpx", "restsharp", "winhttp", "faraday", "mechanize", "httpie", "postman"
    };

    private final VisitService visitService;

    @PostMapping
    public ResponseEntity<Void> record(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        if (body != null && !isBot(userAgent)) {
            Object visitorId = body.get("visitorId");
            Object path = body.get("path");
            // guest 가 명시적으로 false 일 때만 회원, 그 외(누락/true)는 게스트로 간주.
            boolean guest = !Boolean.FALSE.equals(body.get("guest"));
            visitService.record(
                    visitorId == null ? null : visitorId.toString(),
                    path == null ? null : path.toString(),
                    guest,
                    userAgent);
        }
        return ResponseEntity.noContent().build();
    }

    private static boolean isBot(String ua) {
        if (ua == null || ua.isBlank()) return true; // UA 없음 = 스크립트/봇
        String low = ua.toLowerCase();
        // 실제 브라우저는 예외 없이 "Mozilla/5.0" 으로 시작 → 없으면 스크립트/라이브러리로 간주.
        if (!low.contains("mozilla")) return true;
        for (String marker : BOT_UA_MARKERS) {
            if (low.contains(marker)) return true;
        }
        return false;
    }
}
