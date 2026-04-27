package com.example.popspotbackend.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatFileController {

    private final String UPLOAD_DIR = Paths.get(System.getProperty("user.dir"), "uploads").toString();

    private static final List<String> ALLOWED_EXTENSIONS =
            Arrays.asList("jpg", "jpeg", "png", "gif", "webp");
    private static final List<String> ALLOWED_CONTENT_TYPES =
            Arrays.asList("image/jpeg", "image/png", "image/gif", "image/webp");

    /** 10MB 상한 (application.properties 의 multipart 설정과 일치) */
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file, HttpServletRequest request) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 없습니다.");
        }

        // 1. 사이즈 가드
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body("파일 크기는 10MB 이하만 허용됩니다.");
        }

        // 2. 원본 파일명 안전 정제
        String rawFileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String originalFileName = StringUtils.cleanPath(rawFileName);
        if (originalFileName.contains("..")) {
            return ResponseEntity.badRequest().body("잘못된 파일명입니다.");
        }

        // 3. 확장자 화이트리스트
        String extension = "";
        int dotIndex = originalFileName.lastIndexOf('.');
        if (dotIndex >= 0) {
            extension = originalFileName.substring(dotIndex + 1).toLowerCase();
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body("허용되지 않는 파일 형식입니다. (jpg/jpeg/png/gif/webp 만 가능)");
        }

        // 4. MIME 타입 화이트리스트 — 확장자만 png 로 위장한 실행 파일 차단
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            return ResponseEntity.badRequest().body("허용되지 않는 컨텐츠 타입입니다.");
        }

        try {
            File directory = new File(UPLOAD_DIR);
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IOException("업로드 디렉토리 생성 실패");
            }

            // 원본 파일명 무시 (XSS / 인코딩 이슈 / 충돌 방지). 확장자만 살린다.
            String savedFileName = UUID.randomUUID().toString() + "." + extension;
            File dest = new File(UPLOAD_DIR + File.separator + savedFileName);

            // 5. Path Traversal 최종 방어 — canonical path 비교
            String uploadDirCanon = directory.getCanonicalPath();
            String destCanon = dest.getCanonicalPath();
            if (!destCanon.startsWith(uploadDirCanon + File.separator)) {
                log.warn("⛔ Path traversal 시도 감지");
                return ResponseEntity.status(400).body("잘못된 경로입니다.");
            }

            file.transferTo(dest);

            // 6. 외부 접근 URL 조립 — nginx 뒤에서 X-Forwarded-Proto/Host 신뢰
            String forwardedProto = request.getHeader("X-Forwarded-Proto");
            String forwardedHost = request.getHeader("X-Forwarded-Host");
            String scheme = forwardedProto != null ? forwardedProto : request.getScheme();
            int port = request.getServerPort();
            String hostPart = forwardedHost != null ? forwardedHost
                    : request.getServerName() + ((port == 80 || port == 443) ? "" : ":" + port);
            String fileUrl = scheme + "://" + hostPart + "/uploads/" + savedFileName;

            Map<String, String> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", originalFileName);
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            log.error("파일 저장 실패: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(500).body("파일 저장 중 오류가 발생했습니다.");
        }
    }
}
