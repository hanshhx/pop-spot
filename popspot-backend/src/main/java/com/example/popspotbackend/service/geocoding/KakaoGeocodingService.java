package com.example.popspotbackend.service.geocoding;

import com.example.popspotbackend.service.KakaoApiService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Kakao 로컬 키워드 검색 기반 지오코딩.
 *
 * <p>
 *
 * <ol>
 *   <li>1차 시도: {@code 이름 + 위치} — 검색 정확도가 가장 높다.
 *   <li>2차 시도: 위치만 — 1차 실패 시 fallback.
 * </ol>
 *
 * <p>응답 파싱은 모두 Map 단계에서 방어적으로 처리한다 (Kakao 응답 스키마 변경에 대비).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoGeocodingService implements GeocodingService {

    private static final String FIELD_LONGITUDE = "x";
    private static final String FIELD_LATITUDE = "y";
    private static final String FIELD_DOCUMENTS = "documents";

    private final KakaoApiService kakaoApiService;

    @Override
    public Optional<Coordinates> geocode(String name, String location) {
        try {
            String trimmedName = safeTrim(name);
            String trimmedLoc = safeTrim(location);

            String combinedQuery = (trimmedName + " " + trimmedLoc).trim();
            Optional<Coordinates> primary = tryGeocodeOnce(combinedQuery);
            if (primary.isPresent()) return primary;

            if (!trimmedLoc.isBlank() && !trimmedLoc.equals(combinedQuery)) {
                return tryGeocodeOnce(trimmedLoc);
            }
            return Optional.empty();
        } catch (GeocodingUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.debug("[Geocode] '{}' 실패: {}", name, e.toString());
            throw new GeocodingUnavailableException("지오코딩 조회 실패: " + name, e);
        }
    }

    /**
     * 단일 쿼리에 대한 시도.
     *
     * <p>빈 쿼리 / 빈 응답 / 좌표 누락은 {@link Optional#empty()} — <b>물어봤는데 답이 없는</b> 경우다.
     *
     * <p>v2.45 — API 호출이 <b>터진</b> 경우는 {@link GeocodingUnavailableException} 으로 구분해 던진다. 그전까지 둘 다
     * empty 였는데, 좌표 없는 팝업을 버리기 시작하면 이 구분이 없을 때 카카오 API 가 잠깐 죽는 동안 수집분이 통째로 사라진다(그 파일 주석에 경위).
     */
    private Optional<Coordinates> tryGeocodeOnce(String query) {
        if (query == null || query.isBlank()) return Optional.empty();
        try {
            Map<String, Object> response = kakaoApiService.searchPopups(query);
            if (response == null) return Optional.empty();

            Object documentsRaw = response.get(FIELD_DOCUMENTS);
            if (!(documentsRaw instanceof List<?> documents) || documents.isEmpty()) {
                return Optional.empty();
            }

            Object firstDocRaw = documents.get(0);
            if (!(firstDocRaw instanceof Map<?, ?> firstDoc)) return Optional.empty();

            Object longitude = firstDoc.get(FIELD_LONGITUDE);
            Object latitude = firstDoc.get(FIELD_LATITUDE);
            if (longitude == null || latitude == null) return Optional.empty();

            return Optional.of(
                    new Coordinates(String.valueOf(latitude), String.valueOf(longitude)));
        } catch (Exception e) {
            throw new GeocodingUnavailableException("지오코딩 API 호출 실패: " + query, e);
        }
    }

    private String safeTrim(String s) {
        return s == null ? "" : s.trim();
    }
}
