package com.example.popspotbackend.service;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * <p>팝업 이름/카테고리로 무료 스톡 사진(Pexels)을 검색해 팝업마다 서로 다른 커버를 배정한다. 검색어는 사람이 적은 인테리어/제품 위주로 편향하지만,
 * 동적 검색 특성상 사람(얼굴) 배제를 100% 보장하지는 못한다. 키 미설정/호출 실패 시 빈 값을 반환해 호출부가 기존 동작(fallback 커버)을 유지하도록 한다.
 *
 * <p>설정 키: {@code pexels.api-key} (무료 발급: https://www.pexels.com/api/). 미설정이면 커버 배정이 스킵된다.
 */
@Slf4j
@Service
public class PexelsPhotoService {

    private static final String SEARCH_URL = "https://api.pexels.com/v1/search";
    private static final int PER_PAGE = 80;
    private static final int PAGE_SPREAD = 3; // seed 로 1~3 페이지 분산 → 쿼리당 ~240장에서 고유 선택.

    @Value("${pexels.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    /** 키 설정 여부. 백필/스케줄러가 사전 체크에 사용. */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * 팝업 이름/카테고리에 어울리는 Pexels 사진 URL 한 장. {@code seed}(팝업 id) 로 페이지·인덱스를 결정적으로 골라, 같은 팝업은 항상 같은 사진,
     * 다른 팝업은 서로 다른 사진이 되도록 한다.
     */
    public Optional<String> resolvePhotoUrl(String name, String category, long seed) {
        if (!isConfigured()) return Optional.empty();
        String query = buildQuery(name, category);
        int page = (int) (Math.floorMod(seed / PER_PAGE, PAGE_SPREAD) + 1);
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
                    restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            return pickPhotoUrl(res.getBody(), seed);
        } catch (Exception e) {
            log.warn("[PexelsPhotoService] 검색 실패 query='{}' err={}", query, e.toString());
            return Optional.empty();
        }
    }

    private Optional<String> pickPhotoUrl(Map<?, ?> body, long seed) {
        if (body == null) return Optional.empty();
        Object photosObj = body.get("photos");
        if (!(photosObj instanceof List<?> photos) || photos.isEmpty()) return Optional.empty();
        int idx = (int) Math.floorMod(seed, photos.size());
        Object photo = photos.get(idx);
        if (!(photo instanceof Map<?, ?> p)) return Optional.empty();
        Object srcObj = p.get("src");
        if (!(srcObj instanceof Map<?, ?> src)) return Optional.empty();
        // portrait(800x1200) 우선 — 카드 4:5 에 적합. 없으면 large / original.
        Object url = src.get("portrait");
        if (url == null) url = src.get("large");
        if (url == null) url = src.get("original");
        return url == null ? Optional.empty() : Optional.of(url.toString());
    }

    /** 이름 키워드 → 영어 검색어(사람 적은 인테리어/제품 위주). 매칭 없으면 카테고리 fallback. */
    private String buildQuery(String name, String category) {
        String n = name == null ? "" : name;
        if (containsAny(n, "베이글", "빵", "베이커리", "브레드")) return "bakery bread interior";
        if (containsAny(n, "커피", "카페")) return "coffee shop cafe interior";
        if (containsAny(n, "도넛")) return "donut dessert";
        if (containsAny(n, "케이크", "디저트")) return "dessert cake table";
        if (containsAny(n, "향수", "퍼퓸")) return "perfume bottle product";
        if (containsAny(n, "화장품", "뷰티", "코스메틱", "메이크업")) return "cosmetics makeup product";
        if (containsAny(n, "전시", "아트", "미술", "갤러리")) return "art gallery exhibition interior";
        if (containsAny(n, "캐릭터", "피규어", "인형", "토이", "장난감")) return "colorful toys figures";
        if (containsAny(n, "꽃", "플라워")) return "flower shop bouquet";
        if (containsAny(n, "와인", "위스키", "칵테일")) return "bar drinks bottles";
        if (containsAny(n, "패션", "의류", "브랜드")) return "fashion clothing boutique interior";
        if (containsAny(n, "가전", "테크", "전자")) return "tech gadget product";
        return switch (category == null ? "" : category.toUpperCase()) {
            case "FOOD" -> "cafe food interior";
            case "FASHION" -> "fashion boutique store interior";
            case "BEAUTY" -> "cosmetics beauty product";
            case "CULTURE" -> "art exhibition gallery interior";
            case "CHARACTER" -> "colorful toys display";
            case "TECH" -> "tech gadget product";
            default -> "pop up store retail interior";
        };
    }

    private static boolean containsAny(String s, String... keys) {
        for (String k : keys) {
            if (s.contains(k)) return true;
        }
        return false;
    }
}
