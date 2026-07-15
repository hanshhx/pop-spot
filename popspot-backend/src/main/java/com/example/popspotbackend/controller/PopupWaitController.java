package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.PopupWaitService;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 팝업 "지금 어때요?" 대기 제보 API.
 *
 * <p>로그인 없이(게스트도) 버튼 한 번으로 참여할 수 있게 열어둔다 — 참여 문턱을 낮추는 게 이 기능의 존재 이유다. 게스트는 익명 visitorId 로 중복만
 * 막는다.
 */
@RestController
@RequestMapping("/api/popups")
@RequiredArgsConstructor
public class PopupWaitController {

    private final PopupWaitService waitService;

    /** 현재 대기 상태(최근 3시간 집계). 제보가 없으면 204. */
    @GetMapping("/{popupId}/wait")
    public ResponseEntity<Map<String, Object>> get(@PathVariable Long popupId) {
        PopupWaitService.WaitStatus s = waitService.status(popupId);
        if (s == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(toBody(s, null));
    }

    /**
     * 원터치 제보. body: {@code {"level": 0|1|2, "visitorId": "..."}}
     *
     * <p>쿨다운(1시간) 중이면 저장은 안 하고 {@code reported:false} 와 현재 집계를 함께 돌려준다(프론트가 조용히 최신 상태만 갱신).
     */
    @PostMapping("/{popupId}/wait")
    public ResponseEntity<Map<String, Object>> report(
            @PathVariable Long popupId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal UserDetails user) {

        int level = body != null && body.get("level") instanceof Number n ? n.intValue() : -1;
        String key = reporterKey(user, body);
        boolean reported = waitService.report(popupId, level, key);
        return ResponseEntity.ok(toBody(waitService.status(popupId), reported));
    }

    /** 로그인 유저는 계정 기준, 게스트는 익명 visitorId 기준으로 중복 제보를 막는다. */
    private static String reporterKey(UserDetails user, Map<String, Object> body) {
        if (user != null) return "u:" + user.getUsername();
        Object vid = body == null ? null : body.get("visitorId");
        return vid == null || vid.toString().isBlank() ? "" : "g:" + vid;
    }

    private static Map<String, Object> toBody(PopupWaitService.WaitStatus s, Boolean reported) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (reported != null) m.put("reported", reported);
        // null 과 int 를 삼항으로 섞으면 박싱 규칙이 헷갈리므로 명시적으로 Integer 로 만든다.
        m.put("level", s == null ? null : Integer.valueOf(s.level()));
        m.put("count", s == null ? Integer.valueOf(0) : Integer.valueOf(s.count()));
        m.put("updatedAt", s == null || s.updatedAt() == null ? null : s.updatedAt().toString());
        return m;
    }
}
