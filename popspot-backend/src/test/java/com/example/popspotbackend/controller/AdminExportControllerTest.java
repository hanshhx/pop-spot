package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.service.VisitService;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

/**
 * 내려받기가 <b>전부를 담았는지</b> 확인한다.
 *
 * <p>여기서 막으려는 사고는 하나다 — 화면용 조회는 한 번에 200줄까지만 준다. 그걸 그대로 파일로 만들면 "한 달치 방문자" 라는 이름의 200줄짜리 파일이 나오고,
 * 받은 사람은 그게 전부인 줄 알고 판단한다. 오류도 안 나고 로그도 안 남아서 아무도 모른다.
 */
class AdminExportControllerTest {

    private VisitService visitService;
    private AdminExportController controller;

    @BeforeEach
    void setUp() {
        visitService = mock(VisitService.class);
        controller = new AdminExportController(visitService);
    }

    /** 한 쪽 분량의 가짜 방문자. */
    private static Map<String, Object> visitorPage(int size, long total) {
        List<Map<String, Object>> content = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("visitorId", "v" + i);
            content.add(row);
        }
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("content", content);
        page.put("totalElements", total);
        return page;
    }

    private static String bodyOf(ResponseEntity<byte[]> res) {
        return new String(res.getBody(), StandardCharsets.UTF_8);
    }

    @Test
    @DisplayName("방문자가 한 쪽을 넘으면 쪽을 넘겨 가며 전부 담는다")
    void pagesThroughAllVisitors() {
        // 총 450명 — 200 + 200 + 50 으로 세 쪽에 나뉘어 있다.
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt()))
                .thenReturn(visitorPage(200, 450));
        when(visitService.getRecentVisitors(anyInt(), eq(1), anyInt()))
                .thenReturn(visitorPage(200, 450));
        when(visitService.getRecentVisitors(anyInt(), eq(2), anyInt()))
                .thenReturn(visitorPage(50, 450));
        when(visitService.getRecentVisitors(anyInt(), eq(3), anyInt()))
                .thenReturn(visitorPage(0, 450));

        ResponseEntity<byte[]> res = controller.export("visitors", 30, "csv");

        // 헤더 한 줄 + 데이터 450줄.
        long dataRows = bodyOf(res).lines().count() - 1;
        assertThat(dataRows).describedAs("한 쪽만 담으면 200줄에서 멈춘다 — 그게 이 테스트가 막는 사고다").isEqualTo(450);
        assertThat(res.getHeaders().getFirst("X-Popspot-Truncated"))
                .describedAs("전부 담았으면 잘렸다고 알리면 안 된다")
                .isNull();
    }

    @Test
    @DisplayName("서비스가 더 있다고 알려 주는데 못 담았으면 잘렸다고 알린다")
    void reportsTruncationWhenMoreRemain() {
        // 전체는 500명인데 한 쪽만 주고 그 다음은 빈손 — 실제로는 못 담은 것이다.
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt()))
                .thenReturn(visitorPage(200, 500));
        when(visitService.getRecentVisitors(anyInt(), eq(1), anyInt()))
                .thenReturn(visitorPage(0, 500));

        ResponseEntity<byte[]> res = controller.export("visitors", 30, "csv");

        assertThat(res.getHeaders().getFirst("X-Popspot-Truncated"))
                .describedAs("조용히 자르면 받은 사람이 전체라고 믿는다")
                .isEqualTo("200");
    }

    @Test
    @DisplayName("인기 팝업이 상한만큼 꽉 차면 잘렸다고 알린다 — 그 뒤가 있는지 알 수 없으므로")
    void flagsRankingAtCap() {
        List<Map<String, Object>> full = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("popupId", i);
            row.put("name", "팝업" + i);
            full.add(row);
        }
        when(visitService.topOpenedPopups(anyInt(), anyInt())).thenReturn(full);

        ResponseEntity<byte[]> res = controller.export("popup-opens", 7, "csv");

        assertThat(res.getHeaders().getFirst("X-Popspot-Truncated")).isEqualTo("100");
    }

    @Test
    @DisplayName("CSV 는 화면과 같은 칸만 담는다 — 파일로 우회해 더 꺼낼 수 없어야 한다")
    void csvCarriesOnlyScreenColumns() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("source", "instagram");
        row.put("medium", "post");
        row.put("campaign", "summer");
        row.put("visitors", 12);
        // 서비스가 실수로 더 담아 보내도 파일에는 나가면 안 된다.
        row.put("email", "someone@example.com");
        when(visitService.campaigns(anyInt())).thenReturn(List.of(row));

        String csv = bodyOf(controller.export("campaigns", 30, "csv"));

        assertThat(csv).contains("instagram");
        assertThat(csv).describedAs("칸 목록에 없는 값이 파일로 새어 나갔다").doesNotContain("someone@example.com");
    }

    @Test
    @DisplayName("게스트/회원을 화면과 같은 낱말로 적는다 — 참/거짓은 뒤집어 읽힌다")
    void writesGuestAsWordsNotBoolean() {
        // guest=true 는 "순수 게스트" 다. 이걸 그대로 내보내면 파일을 받은 사람이
        // "회원=true" 로 읽어 회원 수를 정반대로 센다. 실제로 그런 파일이 나갔었다.
        Map<String, Object> guest = new LinkedHashMap<>();
        guest.put("visitorId", "g1");
        guest.put("guest", Boolean.TRUE);
        Map<String, Object> member = new LinkedHashMap<>();
        member.put("visitorId", "m1");
        member.put("guest", Boolean.FALSE);

        Map<String, Object> page = new LinkedHashMap<>();
        page.put("content", List.of(guest, member));
        page.put("totalElements", 2L);
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt())).thenReturn(page);
        when(visitService.getRecentVisitors(anyInt(), eq(1), anyInt()))
                .thenReturn(visitorPage(0, 2));

        String csv = bodyOf(controller.export("visitors", 7, "csv"));

        assertThat(csv).contains("\"게스트\"").contains("\"회원\"");
        assertThat(csv)
                .describedAs("참/거짓이 그대로 나가면 칸 이름을 어떻게 달든 뒤집어 읽힌다")
                .doesNotContain("\"true\"")
                .doesNotContain("\"false\"");
    }

    @Test
    @DisplayName("칸 이름이 그 안의 값과 같은 뜻이어야 한다")
    void headerNamesMatchTheirValues() {
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt()))
                .thenReturn(visitorPage(1, 1));

        String header =
                bodyOf(controller.export("visitors", 7, "csv")).lines().findFirst().orElse("");

        // "회원여부" 는 guest 값과 정반대의 뜻이다. 다시 붙는 순간 파일이 거짓말을 한다.
        assertThat(header).describedAs("guest 값에 '회원여부' 라는 이름을 달면 뜻이 뒤집힌다").doesNotContain("회원여부");
        // visits 는 COUNT(*) — 방문 횟수지 세션 수가 아니다. visit_log 에 세션 개념이 없다.
        assertThat(header).describedAs("visits 는 세션이 아니라 조회 수다").doesNotContain("세션");
    }

    @Test
    @DisplayName("첨부파일로 선언한다 — form-data 는 올릴 때 쓰는 형식이다")
    void declaresAttachment() {
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt()))
                .thenReturn(visitorPage(1, 1));

        ResponseEntity<byte[]> res = controller.export("visitors", 7, "csv");

        String disposition = res.getHeaders().getFirst("Content-Disposition");
        assertThat(disposition).startsWith("attachment;");
        assertThat(disposition).contains("popspot-visitors-7d-");
    }

    @Test
    @DisplayName("JSON 은 값을 그대로 둔다 — 키 이름이 남아 뜻이 흐려지지 않는다")
    void jsonKeepsRawValues() {
        Map<String, Object> guest = new LinkedHashMap<>();
        guest.put("visitorId", "g1");
        guest.put("guest", Boolean.TRUE);
        Map<String, Object> page = new LinkedHashMap<>();
        page.put("content", List.of(guest));
        page.put("totalElements", 1L);
        when(visitService.getRecentVisitors(anyInt(), eq(0), anyInt())).thenReturn(page);

        String json = bodyOf(controller.export("visitors", 7, "json"));

        assertThat(json).contains("\"guest\":true");
    }

    @Test
    @DisplayName("모르는 항목은 거절한다")
    void rejectsUnknownDataset() {
        assertThat(
                        org.assertj.core.api.Assertions.catchThrowable(
                                () -> controller.export("users", 30, "csv")))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
