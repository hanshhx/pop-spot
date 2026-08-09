package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 좌표를 <b>아예 저장하면 안 되는</b> 주소를 가린다.
 *
 * <p>2026-08-09 운영 데이터에서 한 좌표에 98곳이 뭉쳐 있었다. 전부 주소가 {@code "서울"} 한 단어인 팝업이었고, 지오코더가 서울 시청 근처를 돌려준
 * 것이다. 그 핀은 "서울 어딘가" 라는 뜻인데 화면에는 정확한 핀처럼 찍힌다.
 *
 * <p><b>동네 이름은 여기서 막지 않는다.</b> "성수동" 은 정보가 있다 — 그 동네까지는 맞다. 화면이 점선 핀으로 "대략 위치" 라고 알려 주면 쓸모가 있다. 반면
 * "서울" 은 서울 팝업 지도에서 아무것도 좁혀 주지 못한다.
 *
 * <p>기존 갯수 기준({@code MAX_POPUPS_PER_COORD})은 증상만 막았다. 98곳·51곳은 걸렀지만 명동 18곳은 통과시켰고, 반대로 더현대 서울 같은
 * <b>진짜 건물</b>에 팝업이 40개 넘게 몰리면 그것까지 막는다.
 */
class UnusableLocationTest {

    @Test
    @DisplayName("시·도 이름뿐이면 좌표를 저장하지 않는다 — 98곳이 한 점에 뭉친 원인")
    void cityOnlyIsUnusable() {
        for (String location : new String[] {"서울", "서울시", "서울특별시", " 서울 ", "대한민국 서울"}) {
            assertThat(PopupCrawlOrchestrator.isUnusableLocation(location))
                    .describedAs("'%s' 는 서울 팝업 지도에서 아무것도 좁혀 주지 못한다", location)
                    .isTrue();
        }
    }

    @Test
    @DisplayName("주소가 비었으면 저장하지 않는다")
    void blankIsUnusable() {
        assertThat(PopupCrawlOrchestrator.isUnusableLocation(null)).isTrue();
        assertThat(PopupCrawlOrchestrator.isUnusableLocation("")).isTrue();
        assertThat(PopupCrawlOrchestrator.isUnusableLocation("   ")).isTrue();
    }

    /** 동네 이름은 <b>막지 않는다.</b> 여기서 걸러 버리면 화면이 "대략 위치" 로 보여 줄 것 자체가 없어져, 결국 지도가 절반으로 줄어든다. */
    @Test
    @DisplayName("동네 이름이 있으면 저장한다 — 화면이 대략 위치로 표시한다")
    void areaNameIsUsable() {
        for (String location : new String[] {"서울 성수동", "서울 성동구", "서울 명동", "서울 홍대"}) {
            assertThat(PopupCrawlOrchestrator.isUnusableLocation(location))
                    .describedAs("'%s' 는 그 동네까지는 맞는 정보다", location)
                    .isFalse();
        }
    }

    @Test
    @DisplayName("건물 주소는 당연히 저장한다")
    void venueIsUsable() {
        assertThat(PopupCrawlOrchestrator.isUnusableLocation("서울 영등포구 더현대 서울 지하 2층")).isFalse();
        assertThat(PopupCrawlOrchestrator.isUnusableLocation("서울 코엑스")).isFalse();
    }
}
