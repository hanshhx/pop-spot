package com.example.popspotbackend.controller;

import io.sentry.Sentry;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.regex.Pattern;
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

    private static final Pattern CONTROL_CHARACTERS = Pattern.compile("[\\p{Cntrl}&&[^\\r\\n\\t]]");
    private static final Pattern LINE_BREAKS = Pattern.compile("[\\r\\n\\t]+");
    private static final Pattern EMAIL =
            Pattern.compile("(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b");
    private static final Pattern BEARER_TOKEN =
            Pattern.compile("(?i)\\bBearer\\s+[A-Z0-9._~+/-]+=*\\b");
    private static final Pattern JWT =
            Pattern.compile("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b");
    private static final Pattern SECRET_QUERY_PARAMETER =
            Pattern.compile(
                    "(?i)((?:[?&]|\\b)(?:access_token|refresh_token|id_token|token|code)=)[^\\s&#]*");

    public record ClientErrorReport(
            @NotBlank @Size(max = 500) String message,
            @Size(max = 255) String path,
            @Size(max = 100) String digest,
            @Size(max = 8000) String stack) {}

    @PostMapping
    public ResponseEntity<Map<String, String>> report(
            @Valid @RequestBody ClientErrorReport report) {
        String safePath = sanitizePath(report.path());
        String safeDigest = sanitizeTelemetry(report.digest(), 100);
        String safeMessage = sanitizeTelemetry(report.message(), 500);
        String safeStack = sanitizeTelemetry(report.stack(), 8000);
        log.error("[ClientError] path={} digest={} message={}", safePath, safeDigest, safeMessage);
        Sentry.withScope(
                scope -> {
                    scope.setTag("source", "next-error-boundary");
                    if (safePath != null) scope.setExtra("path", safePath);
                    if (safeDigest != null) scope.setExtra("digest", safeDigest);
                    if (safeStack != null) scope.setExtra("clientStack", safeStack);
                    Sentry.captureMessage("Client error: " + safeMessage);
                });
        return ResponseEntity.accepted().body(Map.of("status", "RECORDED"));
    }

    static String sanitizePath(String value) {
        if (value == null) return null;
        int queryStart = value.indexOf('?');
        int fragmentStart = value.indexOf('#');
        int end = value.length();
        if (queryStart >= 0) end = Math.min(end, queryStart);
        if (fragmentStart >= 0) end = Math.min(end, fragmentStart);
        return sanitizeTelemetry(value.substring(0, end), 255);
    }

    static String sanitizeTelemetry(String value, int maxLength) {
        if (value == null) return null;
        String sanitized = CONTROL_CHARACTERS.matcher(value).replaceAll("");
        sanitized = LINE_BREAKS.matcher(sanitized).replaceAll(" ");
        sanitized = EMAIL.matcher(sanitized).replaceAll("[EMAIL]");
        sanitized = BEARER_TOKEN.matcher(sanitized).replaceAll("Bearer [REDACTED]");
        sanitized = JWT.matcher(sanitized).replaceAll("[JWT]");
        sanitized = SECRET_QUERY_PARAMETER.matcher(sanitized).replaceAll("$1[REDACTED]");
        return sanitized.length() <= maxLength ? sanitized : sanitized.substring(0, maxLength);
    }
}
