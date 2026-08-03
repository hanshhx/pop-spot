package com.example.popspotbackend.controller;

import com.example.popspotbackend.config.CsvWriter;
import com.example.popspotbackend.service.VisitService;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 통계 내려받기.
 *
 * <p><b>이 경로는 파일로 데이터를 꺼내는 곳이다.</b> 화면에서 보는 것과 달리, 내려받은 파일은 우리 통제 밖으로 나가 메일에 첨부되고 클라우드에 올라가고 다른
 * 컴퓨터에 남는다. 그래서 세 가지를 함께 둔다.
 *
 * <ul>
 *   <li><b>감사 기록</b> — {@code AdminAuditInterceptor} 의 조회 허용 목록에 넣어 내려받을 때마다 남긴다. 조회는 원래 기록하지 않지만,
 *       대량으로 꺼내는 것은 예외다.
 *   <li><b>요청 제한</b> — 전체 기간을 훑는 무거운 조회라 반복 호출이 서버를 붙잡는다.
 *   <li><b>화면과 같은 값</b> — 파일에만 더 담지 않는다. 화면에서 가린 것을 파일로 우회해 꺼낼 수 있으면 가린 의미가 없다.
 * </ul>
 *
 * <p>형식은 CSV 와 JSON 두 가지다. CSV 는 엑셀·구글 시트에서 바로 열리고, JSON 은 다른 도구로 넘길 때 쓴다. 엑셀 전용 형식(xlsx)은 라이브러리를
 * 더해야 하는데, CSV 로 열리는 것과 결과가 같아 넣지 않았다.
 */
@RestController
@RequestMapping("/api/admin/export")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminExportController {

    /**
     * 한 번에 내려받을 수 있는 최대 행 수.
     *
     * <p>서버가 한 요청에 붙잡히지 않게 하는 상한이다. 넘으면 <b>잘라서 주되 그 사실을 알린다</b> — 조용히 자르면 "전체를 받았다" 고 믿고 분석해서 틀린
     * 결론에 이른다.
     */
    private static final int MAX_ROWS = 50_000;

    /**
     * 방문자를 몇 줄씩 끊어 가져올지.
     *
     * <p>{@code VisitService.getRecentVisitors} 는 한 번에 200줄까지만 준다. 그래서 <b>한 번 부르고 끝내면 200줄짜리 파일이
     * 나온다</b> — 그런데 파일을 받은 사람은 그게 전부인 줄 안다. 상한에 걸릴 때까지 쪽수를 넘겨 가며 모은다.
     *
     * <p>이 값이 서비스 상한보다 크면 서비스가 알아서 줄인다. 건너뛰는 양도 줄인 크기로 계산되므로 쪽 번호만 하나씩 올리면 결과는 그대로 맞고 요청 횟수만 늘어난다.
     */
    private static final int VISITORS_PAGE = 200;

    /**
     * 인기 팝업은 순위표라 서비스가 100위까지만 준다.
     *
     * <p>딱 100줄이 오면 그 뒤가 더 있는지 알 수 없다. 이럴 때는 <b>잘렸다고 알리는 쪽</b>을 고른다 — 실제로 딱 100개였다면 불필요한 안내가 한 번 뜰
     * 뿐이지만, 반대로 놓치면 잘린 걸 전부인 줄 안다.
     */
    private static final int RANKING_CAP = 100;

    private final VisitService visitService;

    /** 모은 결과와 "이게 전부가 아니다" 는 표시. */
    private record Rows(List<Map<String, Object>> rows, boolean truncated) {}

    /** 내려받을 수 있는 것 — 이름과 칸 구성을 한곳에 모은다. */
    private enum Dataset {
        VISITORS(
                "visitors",
                List.of("방문자ID", "세션수", "경로수", "다녀간 경로", "회원여부", "마지막 방문", "브라우저"),
                List.of(
                        "visitorId",
                        "visits",
                        "pathCount",
                        "paths",
                        "guest",
                        "lastSeen",
                        "userAgent")),
        POPUP_OPENS(
                "popup-opens",
                List.of("팝업ID", "팝업명", "열린 횟수", "연 사람 수"),
                List.of("popupId", "name", "opens", "visitors")),
        CAMPAIGNS(
                "campaigns",
                List.of("어디서", "방식", "캠페인", "데려온 사람"),
                List.of("source", "medium", "campaign", "visitors"));

        private final String slug;
        private final List<String> headers;
        private final List<String> keys;

        Dataset(String slug, List<String> headers, List<String> keys) {
            this.slug = slug;
            this.headers = headers;
            this.keys = keys;
        }

        static Dataset of(String slug) {
            for (Dataset d : values()) {
                if (d.slug.equals(slug)) return d;
            }
            throw new IllegalArgumentException("내려받을 수 없는 항목입니다: " + slug);
        }
    }

    /**
     * @param dataset visitors · popup-opens · campaigns
     * @param format csv(기본) 또는 json
     */
    @GetMapping("/{dataset}")
    public ResponseEntity<byte[]> export(
            @PathVariable String dataset,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "csv") String format) {

        Dataset target = Dataset.of(dataset);
        Rows loaded = load(target, days);
        List<Map<String, Object>> rows = loaded.rows();
        boolean truncated = loaded.truncated();

        boolean json = "json".equalsIgnoreCase(format);
        byte[] body =
                json
                        ? toJson(rows).getBytes(StandardCharsets.UTF_8)
                        : CsvWriter.write(target.headers, target.keys, rows)
                                .getBytes(StandardCharsets.UTF_8);

        // 파일 이름에 기간을 넣는다. 여러 번 받아 두면 어느 것이 무엇인지 파일명으로만 구분된다.
        String filename =
                "popspot-"
                        + target.slug
                        + "-"
                        + days
                        + "d-"
                        + LocalDate.now()
                        + (json ? ".json" : ".csv");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(
                json ? MediaType.APPLICATION_JSON : MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", filename);
        // 잘렸으면 헤더로 알린다. 조용히 자르면 전체를 받았다고 믿는다.
        // 상한이 아니라 실제로 담은 줄 수를 보낸다 — 받는 쪽이 알아야 할 건 "몇 줄까지 왔나" 다.
        if (truncated) headers.add("X-Popspot-Truncated", String.valueOf(rows.size()));

        return new ResponseEntity<>(body, headers, org.springframework.http.HttpStatus.OK);
    }

    private Rows load(Dataset target, int days) {
        return switch (target) {
                // 화면과 같은 서비스 메서드를 쓴다. 파일 전용 조회를 따로 만들면 언젠가 화면보다 많은
                // 것이 담기고, 그러면 화면에서 가린 값을 파일로 우회해 꺼낼 수 있게 된다.
            case VISITORS -> visitorRows(days);
            case POPUP_OPENS -> {
                List<Map<String, Object>> rows = visitService.topOpenedPopups(days, RANKING_CAP);
                yield new Rows(rows, rows.size() >= RANKING_CAP);
            }
            case CAMPAIGNS -> cap(visitService.campaigns(days));
        };
    }

    /**
     * 방문자 — 쪽을 넘겨 가며 모은다.
     *
     * <p>서비스가 한 번에 주는 양이 정해져 있어 한 번만 부르면 그 양이 곧 파일 전체가 된다. 전체 수({@code totalElements})와 비교해 더 있는지
     * 판단하고, 상한에 걸리면 걸렸다고 알린다.
     */
    @SuppressWarnings("unchecked")
    private Rows visitorRows(int days) {
        List<Map<String, Object>> all = new ArrayList<>();
        long total = 0;

        for (int page = 0; all.size() < MAX_ROWS; page++) {
            Map<String, Object> chunk = visitService.getRecentVisitors(days, page, VISITORS_PAGE);
            List<Map<String, Object>> content = (List<Map<String, Object>>) chunk.get("content");
            if (chunk.get("totalElements") instanceof Number n) total = n.longValue();

            // 쪽 번호로 넘긴다. 서비스가 요청한 크기를 줄이더라도 줄인 크기를 기준으로 건너뛰므로
            // 쪽만 하나씩 올리면 빠지는 줄 없이 이어진다.
            if (content == null || content.isEmpty()) break;
            all.addAll(content);
        }

        return new Rows(all, total > all.size());
    }

    /** 상한을 넘으면 자르고 잘랐다고 표시한다. */
    private Rows cap(List<Map<String, Object>> rows) {
        if (rows.size() <= MAX_ROWS) return new Rows(rows, false);
        return new Rows(rows.subList(0, MAX_ROWS), true);
    }

    /** 의존성을 더하지 않고 만드는 JSON. 값이 숫자·불리언·문자열뿐이라 이걸로 충분하다. */
    private String toJson(List<Map<String, Object>> rows) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < rows.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> e : rows.get(i).entrySet()) {
                if (!first) sb.append(',');
                first = false;
                sb.append(jsonString(e.getKey())).append(':').append(jsonValue(e.getValue()));
            }
            sb.append('}');
        }
        return sb.append(']').toString();
    }

    private String jsonValue(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        return jsonString(value.toString());
    }

    private String jsonString(String raw) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : raw.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    // 제어문자는 그대로 넣으면 JSON 이 깨진다.
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }
}
