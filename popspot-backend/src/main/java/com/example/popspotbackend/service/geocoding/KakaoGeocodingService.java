package com.example.popspotbackend.service.geocoding;

import com.example.popspotbackend.service.KakaoApiService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    /**
     * 카카오가 좌표와 함께 주는 주소 칸. 도로명이 먼저다.
     *
     * <p>도로명주소({@code road_address_name})가 사람이 찾아가기 쉽고, 우리 지역 분류 ({@code regions.ts})도 도로명·동 이름으로
     * 걸러낸다. 신축 건물처럼 도로명이 비어 있을 때만 지번 ({@code address_name})으로 내려간다.
     */
    private static final String FIELD_ROAD_ADDRESS = "road_address_name";

    private static final String FIELD_ADDRESS = "address_name";

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

            // 좌표와 함께 온 주소도 들고 간다. 그전까지 여기서 버렸고, 그래서 위치가 "서울" 한 마디뿐인
            // 행을 고칠 재료를 매번 받아 놓고 폐기하고 있었다(Coordinates 주석에 경위).
            return Optional.of(
                    new Coordinates(
                            String.valueOf(latitude),
                            String.valueOf(longitude),
                            firstNonBlank(
                                    firstDoc.get(FIELD_ROAD_ADDRESS),
                                    firstDoc.get(FIELD_ADDRESS))));
        } catch (Exception e) {
            throw new GeocodingUnavailableException("지오코딩 API 호출 실패: " + query, e);
        }
    }

    private String safeTrim(String s) {
        return s == null ? "" : s.trim();
    }

    /** 앞의 것부터 보고 비어 있지 않은 첫 값. 전부 비면 null — 빈 문자열을 주소인 척 넘기지 않는다. */
    private String firstNonBlank(Object... values) {
        for (Object v : values) {
            if (v == null) continue;
            String s = String.valueOf(v).trim();
            if (!s.isBlank()) return s;
        }
        return null;
    }
}
