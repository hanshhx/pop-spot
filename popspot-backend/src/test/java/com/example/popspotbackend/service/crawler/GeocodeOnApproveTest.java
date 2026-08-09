package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.popspotbackend.entity.PopupStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 승인할 때 좌표를 채울 대상인지 판정한다.
 *
 * <p><b>왜 필요한가.</b> 제보로 들어온 팝업은 구조적으로 좌표가 없다 — 제보 폼에 위도·경도 칸이 없고, 승인 핸들러도 상태만 바꿨다. 그래서 승인해도 목록·검색에만
 * 나오고 <b>지도에는 안 떴다.</b> 정작 "빠졌다" 고 느끼는 곳이 지도인데도 그랬다.
 *
 * <p>2026-08-09 에 "해즈빈 호텔 팝업이 빠졌다" 는 제보가 들어오면서 드러났다. 게스트 제보를 막 열었으니 이 경로로 들어오는 팝업이 늘어난다.
 *
 * <p><b>이미 좌표가 있으면 건드리지 않는 것</b>이 이 판정의 핵심이다. 자동수집으로 들어온 팝업은 승인 시점에 이미 좌표를 갖고 있는데, 그걸 다시 조회하면 (1)
 * 카카오 API 쿼터를 태우고 (2) 멀쩡한 좌표가 '지역 중심점' 같은 뭉뚱그린 값으로 덮일 수 있다.
 */
class GeocodeOnApproveTest {

    private static PopupStore at(String latitude, String longitude) {
        return PopupStore.builder()
                .name("해즈빈 호텔 팝업스토어")
                .location("서울 영등포구 더현대 서울 지하 2층 아이코닉 존")
                .latitude(latitude)
                .longitude(longitude)
                .build();
    }

    @Test
    @DisplayName("좌표가 없으면 채울 대상이다 — 제보로 들어온 팝업이 전부 여기 해당한다")
    void needsCoordinatesWhenMissing() {
        assertThat(PopupCrawlOrchestrator.needsCoordinates(at(null, null))).isTrue();
    }

    @Test
    @DisplayName("이미 좌표가 있으면 건드리지 않는다 — 쿼터를 태우고 멀쩡한 값을 덮을 수 있다")
    void leavesExistingCoordinatesAlone() {
        assertThat(
                        PopupCrawlOrchestrator.needsCoordinates(
                                at("37.525458250804405", "126.92801776417245")))
                .isFalse();
    }

    /**
     * 한쪽만 있는 것은 지도에 찍을 수 없다. 둘 다 있어야 온전한 좌표다.
     *
     * <p>{@code InteractiveMap} 이 {@code if (!m.latitude || !m.longitude) continue} 로 거르므로, 반쪽짜리를
     * "있음" 으로 보면 영원히 안 채워지는 행이 생긴다.
     */
    @Test
    @DisplayName("한쪽만 있으면 채울 대상이다 — 반쪽 좌표로는 지도에 못 찍는다")
    void halfCoordinatesStillNeedFilling() {
        assertThat(PopupCrawlOrchestrator.needsCoordinates(at("37.5254", null))).isTrue();
        assertThat(PopupCrawlOrchestrator.needsCoordinates(at(null, "126.9280"))).isTrue();
    }

    @Test
    @DisplayName("빈 문자열도 좌표가 없는 것으로 본다")
    void blankCountsAsMissing() {
        assertThat(PopupCrawlOrchestrator.needsCoordinates(at("", ""))).isTrue();
        assertThat(PopupCrawlOrchestrator.needsCoordinates(at("  ", "126.9280"))).isTrue();
    }
}
