package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.VisitService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 익명 방문 비콘 수신.
 *
 * <p>로그인 불필요(게스트도 기록). 로그인 여부(guest)·경로만 받고 IP·개인정보는 저장하지 않는다. 항상 204 로 응답해 클라이언트 부담을 없앤다.
 */
@RestController
@RequestMapping("/api/visits")
@RequiredArgsConstructor
public class VisitController {

    private final VisitService visitService;

    @PostMapping
    public ResponseEntity<Void> record(@RequestBody(required = false) Map<String, Object> body) {
        if (body != null) {
            Object visitorId = body.get("visitorId");
            Object path = body.get("path");
            // guest 가 명시적으로 false 일 때만 회원, 그 외(누락/true)는 게스트로 간주.
            boolean guest = !Boolean.FALSE.equals(body.get("guest"));
            visitService.record(
                    visitorId == null ? null : visitorId.toString(),
                    path == null ? null : path.toString(),
                    guest);
        }
        return ResponseEntity.noContent().build();
    }
}
