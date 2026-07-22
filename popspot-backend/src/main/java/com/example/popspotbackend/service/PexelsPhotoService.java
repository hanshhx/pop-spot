package com.example.popspotbackend.service;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Pexels 사진 검색 래퍼.
 *
 * <p>팝업 이름/카테고리로 무료 스톡 사진(Pexels)을 검색해 팝업마다 서로 다른 커버를 배정한다. 검색어는 사람이 적은 인테리어/제품 위주로 편향하지만, 동적 검색
 * 특성상 사람(얼굴) 배제를 100% 보장하지는 못한다. 키 미설정/호출 실패 시 빈 값을 반환해 호출부가 기존 동작(fallback 커버)을 유지하도록 한다.
 *
 * <p>설정 키: {@code pexels.api-key} (무료 발급: https://www.pexels.com/api/). 미설정이면 커버 배정이 스킵된다.
 */
@Slf4j
@Service
public class PexelsPhotoService {

    private static final String SEARCH_URL = "https://api.pexels.com/v1/search";
    private static final int PER_PAGE = 80;

    @Value("${pexels.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    /** 키 설정 여부. 백필/스케줄러가 사전 체크에 사용. */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** Pexels 응답에서 보존할 사진·출처 메타데이터. 사진 ID는 전체 팝업에서 중복을 막는 기준이다. */
    public record PhotoCandidate(
            long id,
            String imageUrl,
            String photoPageUrl,
            String photographerName,
            String photographerUrl) {}

    /**
     * 팝업 이름/카테고리에 어울리는 Pexels 후보를 한 페이지 가져온다. 어떤 사진을 실제로 배정할지는 DB의 기존 사진 ID와 대조하는 {@link
     * PopupPhotoService}가 결정한다.
     */
    public List<PhotoCandidate> searchCandidates(String name, String category, int requestedPage) {
        if (!isConfigured()) return List.of();
        String query = buildQuery(name, category);
        int page = Math.max(1, requestedPage);
        try {
            URI uri =
                    UriComponentsBuilder.fromUriString(SEARCH_URL)
                            .queryParam("query", query)
                            .queryParam("per_page", PER_PAGE)
                            .queryParam("page", page)
                            .queryParam("orientation", "portrait")
                            .build()
                            .encode()
                            .toUri();
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", apiKey);
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> res =
                    restTemplate.exchange(
                            uri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            return parseCandidates(res.getBody());
        } catch (Exception e) {
            log.warn("[PexelsPhotoService] 검색 실패 query='{}' err={}", query, e.toString());
            return List.of();
        }
    }

    List<PhotoCandidate> parseCandidates(Map<?, ?> body) {
        if (body == null) return List.of();
        Object photosObj = body.get("photos");
        if (!(photosObj instanceof List<?> photos) || photos.isEmpty()) return List.of();

        List<PhotoCandidate> result = new ArrayList<>();
        for (Object photo : photos) {
            if (!(photo instanceof Map<?, ?> p)) continue;
            Long id = positiveLong(p.get("id"));
            Object srcObj = p.get("src");
            if (id == null || !(srcObj instanceof Map<?, ?> src)) continue;

            String imageUrl =
                    firstString(src.get("portrait"), src.get("large"), src.get("original"));
            String pageUrl = stringValue(p.get("url"));
            String photographer = stringValue(p.get("photographer"));
            String photographerUrl = stringValue(p.get("photographer_url"));
            if (!hasHost(imageUrl, "images.pexels.com") || !hasPexelsHost(pageUrl)) continue;

            result.add(new PhotoCandidate(id, imageUrl, pageUrl, photographer, photographerUrl));
        }
        return List.copyOf(result);
    }

    /** 이름 키워드 → 영어 검색어(사람 적은 인테리어/제품 위주). 매칭 없으면 카테고리 fallback. */
    private String buildQuery(String name, String category) {
        String n = name == null ? "" : name;
        if (containsAny(n, "베이글", "빵", "베이커리", "브레드")) return "empty bakery bread display";
        if (containsAny(n, "커피", "카페")) return "empty coffee shop interior";
        if (containsAny(n, "도넛")) return "donut dessert still life";
        if (containsAny(n, "케이크", "디저트")) return "dessert cake still life";
        if (containsAny(n, "향수", "퍼퓸")) return "perfume bottle still life";
        if (containsAny(n, "화장품", "뷰티", "코스메틱", "메이크업")) return "cosmetics product still life";
        if (containsAny(n, "전시", "아트", "미술", "갤러리")) return "empty art gallery exhibition";
        if (containsAny(n, "캐릭터", "피규어", "인형", "토이", "장난감")) return "colorful toy display";
        if (containsAny(n, "꽃", "플라워")) return "flower shop bouquet still life";
        if (containsAny(n, "와인", "위스키", "칵테일")) return "drinks bottles still life";
        if (containsAny(n, "패션", "의류", "브랜드")) return "empty fashion boutique interior";
        if (containsAny(n, "가전", "테크", "전자")) return "technology product still life";
        return switch (category == null ? "" : category.toUpperCase()) {
            case "FOOD" -> "food shop interior still life";
            case "FASHION" -> "empty fashion boutique interior";
            case "BEAUTY" -> "beauty product still life";
            case "CULTURE" -> "empty art exhibition gallery";
            case "CHARACTER" -> "colorful toy display";
            case "TECH" -> "technology product still life";
            default -> "empty retail store interior";
        };
    }

    private static Long positiveLong(Object value) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        try {
            long parsed = Long.parseLong(String.valueOf(value));
            return parsed > 0 ? parsed : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String firstString(Object... values) {
        for (Object value : values) {
            String text = stringValue(value);
            if (text != null) return text;
        }
        return null;
    }

    private static String stringValue(Object value) {
        if (value == null) return null;
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static boolean hasPexelsHost(String value) {
        if (value == null) return false;
        try {
            String host = URI.create(value).getHost();
            return host != null && (host.equals("pexels.com") || host.endsWith(".pexels.com"));
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static boolean hasHost(String value, String expectedHost) {
        if (value == null) return false;
        try {
            return expectedHost.equalsIgnoreCase(URI.create(value).getHost());
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private static boolean containsAny(String s, String... keys) {
        for (String k : keys) {
            if (s.contains(k)) return true;
        }
        return false;
    }
}
