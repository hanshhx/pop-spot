package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.AdminAuditLog;
import com.example.popspotbackend.repository.AdminAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 감사 로그 조회.
 *
 * <p>이 조회 자체는 감사 대상이 아니다({@code AdminAuditInterceptor} 의 조회 허용 목록에 없다). 감사 로그를 볼 때마다 감사 로그가 쌓이면 표가
 * 자기 자신으로 채워진다.
 */
@RestController
@RequestMapping("/api/admin/audit")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAuditController {

    /** 한 번에 가져올 수 있는 최대치. 화면이 감당하지 못할 양을 요청해 서버를 붙잡지 못하게 한다. */
    private static final int SIZE_MAX = 200;

    private static final int SIZE_DEFAULT = 50;

    private final AdminAuditLogRepository repository;

    /**
     * 최근순 목록.
     *
     * @param actorId 특정 계정만 — 토큰 유출이 의심될 때 쓴다
     * @param failedOnly 실패(권한 거부·오류)만 — 사고 조사에서 가장 먼저 보는 화면
     */
    @GetMapping
    public ResponseEntity<Page<AdminAuditLog>> list(
            @RequestParam(required = false) String actorId,
            @RequestParam(defaultValue = "false") boolean failedOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SIZE_DEFAULT) int size) {

        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, SIZE_MAX));

        if (actorId != null && !actorId.isBlank()) {
            return ResponseEntity.ok(
                    repository.findByActorIdOrderByCreatedAtDesc(actorId.trim(), pageable));
        }
        if (failedOnly) {
            return ResponseEntity.ok(repository.findBySuccessFalseOrderByCreatedAtDesc(pageable));
        }
        return ResponseEntity.ok(repository.findAllByOrderByCreatedAtDesc(pageable));
    }
}
