package com.example.popspotbackend.controller;

import com.example.popspotbackend.service.media.ImageUploadGuard;
import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 채팅 첨부 이미지 업로드.
 *
 * <p>방어: 크기 / 확장자 / MIME 화이트리스트, traversal 차단, canonical path 검증, UUID 재명명.
 *
 * <p>{@code X-Forwarded-Host} 스푸핑 방어 — {@link #ALLOWED_HOST_PATTERNS_PROP} 매칭 시에만 신뢰, 아니면 컨테이너 서버명
 * 폴백.
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

    /**
     * 운영에서 신뢰할 호스트 정규식 패턴 — 콤마 구분.
     *
     * <p>예: {@code popspot\.co\.kr,.*\.vercel\.app}. 비어 있으면 컨테이너 서버명만 사용 (보수적).
     */
    private static final String ALLOWED_HOST_PATTERNS_PROP = "app.upload.allowed-host-patterns";

    /**
     * 저장 위치. 정적 서빙(WebConfig)과 <b>같은 프로퍼티</b>를 읽어야 한다.
     *
     * <p>이전에는 {@code user.dir/uploads} 로 하드코딩돼 있었고 WebConfig 는 {@code app.upload.path} 를 봤다.
     * 기본값이 {@code ${user.dir}/uploads/} 라 우연히 일치했을 뿐이고, {@code .env.example} 이 안내하는 대로
     * {@code APP_UPLOAD_PATH=/var/popspot/uploads/} 를 설정하는 순간 저장 위치와 공개 위치가 갈려 모든 업로드가
     * 404 가 됐다. 한 곳에서 읽어 그 지뢰를 제거한다.
     */
    private final String uploadDir;

    private final List<Pattern> allowedHostPatterns;
    private final ImageUploadGuard imageGuard;

    public ChatFileController(
            @Value("${" + ALLOWED_HOST_PATTERNS_PROP + ":}") String allowedHostPatternsCsv,
            @Value("${app.upload.path}") String uploadPath,
            ImageUploadGuard imageGuard) {
        this.allowedHostPatterns = compilePatterns(allowedHostPatternsCsv);
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize().toString();
        this.imageGuard = imageGuard;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            Authentication authentication,
            HttpServletRequest request) {
        // 보안(v2.22): 인증 필수. 이전엔 누구나 업로드 가능해 디스크 채우기 DoS 가 가능했다.
        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getName())) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }
        ResponseEntity<String> validationError = validate(file);
        if (validationError != null) return validationError;

        String extension = extractExtension(StringUtils.cleanPath(file.getOriginalFilename()));

        // 확장자와 Content-Type 은 둘 다 클라이언트가 정하는 값이다. 파일 내용으로 실체를 확인하고,
        // 가능하면 픽셀만 남겨 재인코딩한 바이트를 받는다(EXIF 위치정보·트레일러 payload 제거).
        ImageUploadGuard.Inspection inspection = imageGuard.inspect(file, extension);
        if (inspection.rejected()) {
            return ResponseEntity.badRequest().body(inspection.rejection());
        }

        try {
            File destination = prepareDestination(inspection.extension());
            Files.write(destination.toPath(), inspection.bytes());

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
        if (forwardedHost != null && isAllowedHost(forwardedHost)) {
            return forwardedHost;
        }
        if (forwardedHost != null) {
            log.warn("X-Forwarded-Host 헤더 '{}' 가 허용 패턴과 일치하지 않아 무시.", forwardedHost);
        }
        int port = request.getServerPort();
        boolean omitPort = port == HTTP_PORT || port == HTTPS_PORT;
        return request.getServerName() + (omitPort ? "" : ":" + port);
    }

    /**
     * 허용 패턴 매칭 시 true. 패턴이 비어 있으면 어떤 헤더도 신뢰하지 않는다.
     *
     * <p>{@code Pattern.matches} 는 전체 매칭이므로 부분 일치 우회 위험 없음.
     */
    private boolean isAllowedHost(String host) {
        if (allowedHostPatterns.isEmpty()) return false;
        for (Pattern p : allowedHostPatterns) {
            if (p.matcher(host).matches()) return true;
        }
        return false;
    }

    private static List<Pattern> compilePatterns(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        String[] tokens = csv.split(",");
        java.util.List<Pattern> out = new java.util.ArrayList<>(tokens.length);
        for (String t : tokens) {
            String trimmed = t.trim();
            if (trimmed.isEmpty()) continue;
            out.add(Pattern.compile(trimmed));
        }
        return java.util.Collections.unmodifiableList(out);
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
