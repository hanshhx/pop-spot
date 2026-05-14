package com.example.popspotbackend.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 채팅 첨부 이미지 업로드.
 *
 * <p>방어 레이어: 크기 상한 / 확장자 화이트리스트 / MIME 화이트리스트 / 파일명 traversal 차단 / canonical path 검증. 저장 시 원본 파일명을
 * 폐기하고 UUID 로 재명명해 XSS / 충돌 / 인코딩 이슈를 회피.
 */
@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatFileController {

    private static final List<String> ALLOWED_EXTENSIONS =
            List.of("jpg", "jpeg", "png", "gif", "webp");
    private static final List<String> ALLOWED_CONTENT_TYPES =
            List.of("image/jpeg", "image/png", "image/gif", "image/webp");

    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;
    private static final String PATH_TRAVERSAL_TOKEN = "..";

    private static final String HEADER_X_FORWARDED_PROTO = "X-Forwarded-Proto";
    private static final String HEADER_X_FORWARDED_HOST = "X-Forwarded-Host";
    private static final int HTTP_PORT = 80;
    private static final int HTTPS_PORT = 443;

    private final String uploadDir =
            Paths.get(System.getProperty("user.dir"), "uploads").toString();

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file, HttpServletRequest request) {
        ResponseEntity<String> validationError = validate(file);
        if (validationError != null) return validationError;

        String extension = extractExtension(StringUtils.cleanPath(file.getOriginalFilename()));

        try {
            File destination = prepareDestination(extension);
            file.transferTo(destination);

            String savedFileName = destination.getName();
            String fileUrl = buildPublicUrl(request, savedFileName);

            Map<String, String> response = new HashMap<>();
            response.put("fileUrl", fileUrl);
            response.put("fileName", StringUtils.cleanPath(file.getOriginalFilename()));
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            log.warn("Path traversal 시도 감지");
            return ResponseEntity.badRequest().body("잘못된 경로입니다.");
        } catch (IOException e) {
            log.error("파일 저장 실패: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(500).body("파일 저장 중 오류가 발생했습니다.");
        }
    }

    /* ============================== 검증 ============================== */

    private ResponseEntity<String> validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 없습니다.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return ResponseEntity.badRequest().body("파일 크기는 10MB 이하만 허용됩니다.");
        }

        String cleanedName = StringUtils.cleanPath(safe(file.getOriginalFilename()));
        if (cleanedName.contains(PATH_TRAVERSAL_TOKEN)) {
            return ResponseEntity.badRequest().body("잘못된 파일명입니다.");
        }

        String extension = extractExtension(cleanedName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest()
                    .body("허용되지 않는 파일 형식입니다. (jpg/jpeg/png/gif/webp 만 가능)");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            return ResponseEntity.badRequest().body("허용되지 않는 컨텐츠 타입입니다.");
        }
        return null;
    }

    private String extractExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex >= 0 ? filename.substring(dotIndex + 1).toLowerCase() : "";
    }

    /* ============================== 저장 ============================== */

    private File prepareDestination(String extension) throws IOException {
        File directory = new File(uploadDir);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("업로드 디렉토리 생성 실패");
        }

        File dest = new File(uploadDir + File.separator + UUID.randomUUID() + "." + extension);
        String uploadCanon = directory.getCanonicalPath();
        if (!dest.getCanonicalPath().startsWith(uploadCanon + File.separator)) {
            throw new SecurityException("Path traversal");
        }
        return dest;
    }

    /* ============================== URL 조립 ============================== */

    private String buildPublicUrl(HttpServletRequest request, String savedFileName) {
        String scheme = resolveScheme(request);
        String host = resolveHost(request);
        return scheme + "://" + host + "/uploads/" + savedFileName;
    }

    private String resolveScheme(HttpServletRequest request) {
        String forwardedProto = request.getHeader(HEADER_X_FORWARDED_PROTO);
        return forwardedProto != null ? forwardedProto : request.getScheme();
    }

    private String resolveHost(HttpServletRequest request) {
        String forwardedHost = request.getHeader(HEADER_X_FORWARDED_HOST);
        if (forwardedHost != null) return forwardedHost;

        int port = request.getServerPort();
        boolean omitPort = port == HTTP_PORT || port == HTTPS_PORT;
        return request.getServerName() + (omitPort ? "" : ":" + port);
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
