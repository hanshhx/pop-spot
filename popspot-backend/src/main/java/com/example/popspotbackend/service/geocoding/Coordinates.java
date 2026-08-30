package com.example.popspotbackend.service.geocoding;

/**
 * 위경도 좌표 값 객체.
 *
 * <p>{@code PopupStore} 가 좌표를 문자열로 저장하므로 record 도 문자열 형태를 그대로 노출한다. 호출부에서 한 번에 latitude/longitude 를
 * 받기 위해 만든 단순 컨테이너.
 *
 * <p><b>{@code address} 를 함께 들고 다니는 이유.</b> 카카오 로컬 검색은 좌표와 <b>도로명주소를 같이</b> 준다. 그런데 그전까지 이 record 는
 * x/y 만 담아서, 매번 받아 놓은 주소를 그 자리에서 버렸다. 그 사이 수집 데이터에는 위치가 {@code "서울"} 한 마디뿐인 행이 쌓였다 — LLM 이 snippet
 * 에서 동네를 못 읽으면 그렇게 적도록 지시돼 있기 때문이다({@code PopupNormalizationService} 프롬프트).
 *
 * <p>즉 <b>고칠 재료를 이미 받고 있으면서 버리고 있었다.</b> 이제 들고 와서, 위치가 비어 있는 팝업에만 채워 넣는다(덮어쓰지 않는다 — 근거는 {@code
 * PopupCrawlOrchestrator#preciseLocation}).
 *
 * @param address 카카오가 준 도로명주소. 없으면 null — 지어내지 않는다.
 */
public record Coordinates(String latitude, String longitude, String address) {

    /** 주소를 모르는 구현·테스트용 축약 생성자. 기존 호출부가 그대로 컴파일된다. */
    public Coordinates(String latitude, String longitude) {
        this(latitude, longitude, null);
    }
}
