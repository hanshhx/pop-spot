package com.example.popspotbackend.service.crawler;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 검색 결과 URL 을 "같은 글이면 같은 값" 이 되도록 정규화하고 해시로 줄인다.
 *
 * <p><b>왜 필요한가.</b> 크롤러는 같은 블로그 글을 매 회차 다시 LLM 에 넣어 해석해 왔다. 검색 API 는 같은 글을 여러 키워드 결과에 실어 주고, 하루 두 번
 * 돌면 어제 본 글도 그대로 다시 나온다. 토큰 예산이 병목인 상황에서 이건 가장 큰 낭비다. URL 로 먼저 걸러내면 LLM 호출이 "새로 올라온 글 수" 까지 떨어진다.
 *
 * <p><b>정규화 규칙.</b> 같은 글이 다른 문자열로 오는 흔한 경우를 흡수한다 — 추적 파라미터(utm_*·fbclid 등), 스킴·호스트 대소문자, 기본 포트, 끝
 * 슬래시, 프래그먼트. 반대로 <b>의미가 있는 쿼리는 남긴다</b>(블로그 글 번호가 쿼리에 있는 경우가 많다). 남긴 파라미터는 정렬해 순서 차이를 흡수한다.
 */
public final class SourceUrlNormalizer {

    private SourceUrlNormalizer() {}

    /** 값이 달라도 같은 글을 가리키는 파라미터. 광고·유입 추적용이라 지운다. */
    private static final Set<String> TRACKING_PARAMS =
            Set.of(
                    "utm_source",
                    "utm_medium",
                    "utm_campaign",
                    "utm_term",
                    "utm_content",
                    "utm_id",
                    "fbclid",
                    "gclid",
                    "igshid",
                    "spm",
                    "ref",
                    "referrer",
                    "from",
                    "trackingcode",
                    "trk");

    private static final int HTTP_PORT = 80;
    private static final int HTTPS_PORT = 443;

    /** DB 컬럼 길이에 맞춘 해시 표현. SHA-256 hex 64자. */
    private static final String HASH_ALGORITHM = "SHA-256";

    /**
     * 제목과 요약을 잇는 구분자.
     *
     * <p>구분자가 없으면 ("AB", "C") 와 ("A", "BC") 가 같은 해시가 된다. 제목·요약에 들어가지 않는 문자를 쓴다.
     */
    private static final String CONTENT_SEPARATOR = "\n";

    /**
     * URL 정규화. 파싱할 수 없으면 원본을 다듬어 그대로 돌려준다 — 판단 불가를 이유로 버리면 그 글은 영원히 다시 처리되므로, 최소한 문자열로라도 같은 값이 나오게
     * 한다.
     */
    public static String normalize(String rawUrl) {
        if (rawUrl == null) return "";
        String trimmed = rawUrl.trim();
        if (trimmed.isEmpty()) return "";

        try {
            URI uri = URI.create(trimmed);
            String scheme = lower(uri.getScheme());
            String host = lower(uri.getHost());
            if (scheme == null || host == null) return trimmed.toLowerCase(Locale.ROOT);

            StringBuilder sb = new StringBuilder();
            sb.append(scheme).append("://").append(host);

            int port = uri.getPort();
            boolean defaultPort =
                    port == -1
                            || ("http".equals(scheme) && port == HTTP_PORT)
                            || ("https".equals(scheme) && port == HTTPS_PORT);
            if (!defaultPort) sb.append(':').append(port);

            sb.append(stripTrailingSlash(uri.getPath()));

            String query = keepMeaningfulQuery(uri.getQuery());
            if (!query.isEmpty()) sb.append('?').append(query);

            // 프래그먼트(#...)는 서버에 전달되지도 않으므로 항상 버린다.
            return sb.toString();
        } catch (IllegalArgumentException e) {
            return trimmed.toLowerCase(Locale.ROOT);
        }
    }

    /** 정규화 URL 의 SHA-256 hex. 인덱스 키로 쓰기 위해 길이를 고정한다. */
    public static String hash(String rawUrl) {
        return sha256(normalize(rawUrl));
    }

    /**
     * 글 내용의 해시. 제목+요약이 바뀌면 다른 값이 되어 다시 처리 대상이 된다.
     *
     * <p>URL 이 같아도 글이 수정되면(기간 연장·장소 변경) 새로 해석해야 하므로 URL 해시와 따로 둔다.
     */
    public static String contentHash(String title, String description) {
        return sha256(safe(title) + CONTENT_SEPARATOR + safe(description));
    }

    /* ============================== 내부 ============================== */

    private static String keepMeaningfulQuery(String query) {
        if (query == null || query.isBlank()) return "";
        List<String> kept = new ArrayList<>();
        for (String pair : query.split("&")) {
            if (pair.isBlank()) continue;
            int eq = pair.indexOf('=');
            String name = (eq >= 0 ? pair.substring(0, eq) : pair).toLowerCase(Locale.ROOT);
            if (TRACKING_PARAMS.contains(name)) continue;
            kept.add(pair);
        }
        // 순서만 다른 같은 URL 을 하나로 모은다.
        String[] sorted = kept.toArray(new String[0]);
        Arrays.sort(sorted);
        return String.join("&", sorted);
    }

    private static String stripTrailingSlash(String path) {
        if (path == null || path.isEmpty()) return "";
        if (path.length() > 1 && path.endsWith("/")) return path.substring(0, path.length() - 1);
        return "/".equals(path) ? "" : path;
    }

    private static String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 JDK 표준이라 실제로 도달하지 않는다.
            throw new IllegalStateException("SHA-256 미지원", e);
        }
    }
}
