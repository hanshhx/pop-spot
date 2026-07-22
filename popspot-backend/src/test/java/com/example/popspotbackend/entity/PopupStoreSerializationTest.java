package com.example.popspotbackend.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 공개 API 직렬화 회귀 테스트.
 *
 * <p><b>왜 필요한가.</b> {@code GET /api/popups/{id}} 는 DTO 를 거치지 않고 이 엔티티를 통째로 내보낸다({@code
 * result.put("data", popup)}). 그래서 엔티티에 필드를 하나 추가하면 그 순간 무인증 공개 API 의 응답 스펙이 같이 늘어난다 — 아무도 그런 의도로
 * 필드를 추가하지 않는데도.
 *
 * <p>실제로 그 경로로 사고가 날 뻔했다. takedown 신고자 이메일은 평소엔 {@code reviewStatus=TAKEDOWN} 게이트에 가려 안 보이지만, admin
 * 이 악성 신고로 판단해 승인하면 게이트가 풀리면서 이메일만 남아 공개된다. 권리침해를 신고한 사람의 신원이라 노출 대가가 특히 크다.
 *
 * <p>게이트는 조회 경로가 늘 때마다 다시 검토해야 하지만 필드 단위 차단은 한 번 걸면 끝난다. 이 테스트는 그 차단이 지워지지 않게 고정한다.
 */
class PopupStoreSerializationTest {

    private ObjectMapper objectMapper;
    private PopupStore popup;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        popup = new PopupStore();
        popup.setId(1L);
        popup.setName("테스트 팝업");
        // 신고가 접수된 뒤 admin 이 승인해 다시 공개된 상태 — 유출이 실제로 일어나는 조합.
        popup.setReviewStatus("APPROVED");
        popup.setTakedownRequestedAt(LocalDateTime.now());
        popup.setTakedownReason("저작권 침해 주장");
        popup.setTakedownRequester("rights-holder@example.com");
    }

    @Test
    @DisplayName("신고자 이메일은 어떤 조합에서도 직렬화되지 않는다")
    void takedown_신고자는_노출되지_않는다() throws Exception {
        String json = objectMapper.writeValueAsString(popup);

        assertThat(json).doesNotContain("rights-holder@example.com");
        assertThat(json).doesNotContain("takedownRequester");
    }

    @Test
    @DisplayName("신고 사유·시각도 함께 가린다 — 사유 문면으로 신고자가 특정될 수 있다")
    void takedown_사유와_시각도_노출되지_않는다() throws Exception {
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = objectMapper.convertValue(popup, Map.class);

        assertThat(fields)
                .doesNotContainKeys("takedownRequester", "takedownReason", "takedownRequestedAt");
    }

    @Test
    @DisplayName("가리는 김에 필요한 필드까지 가리지는 않았는지 — 상세 화면이 쓰는 값은 남아야 한다")
    void 공개에_필요한_필드는_그대로_나간다() throws Exception {
        popup.setSourceType("CRAWLED");
        popup.setSourceUrl("https://blog.naver.com/example/123");
        popup.setImages(
                java.util.List.of(
                        PopupImage.builder()
                                .imageUrl("https://images.pexels.com/photos/1234/photo.jpeg")
                                .mainYn("Y")
                                .photoOrigin(PopupImage.ORIGIN_PEXELS)
                                .photoSourceUrl("https://www.pexels.com/photo/1234/")
                                .photoCreditName("Sample Artist")
                                .photoCreditUrl("https://www.pexels.com/@sample-artist/")
                                .build()));

        @SuppressWarnings("unchecked")
        Map<String, Object> fields = objectMapper.convertValue(popup, Map.class);

        // sourceUrl 은 약관 §10-2 가 요구하는 출처 링크라 반드시 나가야 한다.
        assertThat(fields)
                .containsKeys(
                        "id",
                        "name",
                        "sourceUrl",
                        "sourceType",
                        "reviewStatus",
                        "photoOrigin",
                        "photoSourceUrl",
                        "photoCreditName",
                        "photoCreditUrl");
    }
}
