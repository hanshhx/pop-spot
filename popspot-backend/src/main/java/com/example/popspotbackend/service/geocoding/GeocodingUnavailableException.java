package com.example.popspotbackend.service.geocoding;

/**
 * 지오코딩 <b>조회 자체가 실패</b>했음을 알린다(네트워크·인증·쿼터 등).
 *
 * <p>v2.45 — "주소를 못 찾았다" 와 "물어보지도 못했다" 를 구분하기 위해 만들었다. 그전까지 둘 다
 * {@code Optional.empty()} 로 돌아왔는데, 좌표 없는 팝업을 버리기 시작하면 이 구분이 없을 때
 * <b>카카오 API 가 잠깐 죽는 동안 수집분이 통째로 사라진다.</b> 로그만 보면 "주소를 못 찾아서 버렸다"
 * 로 보여 원인을 찾기도 어렵다.
 *
 * <p>호출부는 이 예외를 받으면 <b>버리지 말고 좌표 없이 저장</b>해야 한다. 좌표는 관리자 백필
 * ({@code /api/admin/popups/geocode-missing})이 나중에 채운다.
 */
public class GeocodingUnavailableException extends RuntimeException {

    public GeocodingUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
