package com.example.popspotbackend.controller;

import io.sentry.Sentry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 브라우저 오류 경계가 보낸 최소 정보만 수집한다. 토큰·사용자 입력·브라우저 저장소는 받지 않는다. */
@Slf4j
@RestController
@RequestMapping("/api/client-errors")
public class ClientErrorController {

    public record ClientErrorReport(
            @NotBlank @Size(max = 500) String message,
            @Size(max = 255) String path,
            @Size(max = 100) String digest,
            @Size(max = 8000) String stack) {}

    @PostMapping
    public ResponseEntity<Map<String, String>> report(
            @Valid @RequestBody ClientErrorReport report) {
        log.error(
                "[ClientError] path={} digest={} message={}",
                report.path(),
                report.digest(),
                report.message());
        Sentry.withScope(
                scope -> {
                    scope.setTag("source", "next-error-boundary");
                    if (report.path() != null) scope.setExtra("path", report.path());
                    if (report.digest() != null) scope.setExtra("digest", report.digest());
                    if (report.stack() != null) scope.setExtra("clientStack", report.stack());
                    Sentry.captureMessage("Client error: " + report.message());
                });
        return ResponseEntity.accepted().body(Map.of("status", "RECORDED"));
    }
}
