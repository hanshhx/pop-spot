package com.example.popspotbackend.service.geocoding;

import java.util.Optional;

/**
 * 외부 지도 API 와 분리된 지오코딩 인터페이스.
 *
 * <p>현재는 {@link KakaoGeocodingService} 만 구현하지만, 향후 Naver/Google 로 교체하거나 두 곳을 합성하기 쉽도록 추상화한다. 실패 시
 * 예외 대신 빈 {@link Optional} 을 반환해 호출부가 fallback 흐름을 명확히 표현할 수 있게 했다.
 */
public interface GeocodingService {

    /**
     * 이름 + 위치 조합으로 좌표를 검색.
     *
     * <p>구현체는 이름이 비어있으면 위치만으로 fallback 해야 한다.
     */
    Optional<Coordinates> geocode(String name, String location);
}
