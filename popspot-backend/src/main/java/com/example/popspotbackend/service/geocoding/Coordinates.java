package com.example.popspotbackend.service.geocoding;

/**
 * 위경도 좌표 값 객체.
 *
 * <p>{@code PopupStore} 가 좌표를 문자열로 저장하므로 record 도 문자열 형태를 그대로 노출한다. 호출부에서 한 번에 latitude/longitude 를
 * 받기 위해 만든 단순 컨테이너.
 */
public record Coordinates(String latitude, String longitude) {}
