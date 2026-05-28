package com.example.popspotbackend.controller;

import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.SpotifyAuthRepository;
import com.example.popspotbackend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Size;
import java.io.File;
import java.io.IOException;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * v2.16 — 회원 프로필 수정 API.
 *
 * <p>제공:
 *
 * <ul>
 *   <li>{@code GET /api/v1/users/check-nickname?value=...} — 닉네임 중복 검사 (본인 제외)
 *   <li>{@code POST /api/v1/users/me/avatar} — 프로필 사진 multipart 업로드
 *   <li>{@code PATCH /api/v1/users/me} — nickname / picture 갱신 (JSON body)
 * </ul>
 *
 * <p>아바타 업로드는 {@link ChatFileController} 와 동일한 패턴 (UUID 재명명 + traversal 차단 + 확장자/MIME 화이트리스트) 을
 * 따른다. 저장 위치만 {@code uploads/avatar/} 하위로 분리.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/users")
public class UserProfileController {

    private static final List<String> ALLOWED_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");
    private static final List<String> ALLOWED_CONTENT_TYPES =
            List.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_AVATAR_BYTES = 5L * 1024 * 1024; // 5MB
    private static final String PATH_TRAVERSAL_TOKEN = "..";

    private static final int NICKNAME_MIN_LENGTH = 2;
    private static final int NICKNAME_MAX_LENGTH = 20;

    private static final String HEADER_X_FORWARDED_PROTO = "X-Forwarded-Proto";
    private static final String HEADER_X_FORWARDED_HOST = "X-Forwarded-Host";
    private static final int HTTP_PORT = 80;
    private static final int HTTPS_PORT = 443;

    private static final String ALLOWED_HOST_PATTERNS_PROP = "app.upload.allowed-host-patterns";

    private final UserRepository userRepository;
    private final SpotifyAuthRepository spotifyAuthRepository;
    private final List<Pattern> allowedHostPatterns;

    private final String avatarDir =
            Paths.get(System.getProperty("user.dir"), "uploads", "avatar").toString();

    public UserProfileController(
            UserRepository userRepository,
            SpotifyAuthRepository spotifyAuthRepository,
            @Value("${" + ALLOWED_HOST_PATTERNS_PROP + ":}") String allowedHostPatternsCsv) {
        this.userRepository = userRepository;
        this.spotifyAuthRepository = spotifyAuthRepository;
        this.allowedHostPatterns = compilePatterns(allowedHostPatternsCsv);
    }

    /* ============================== 닉네임 중복 검사 ============================== */

    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Object>> checkNickname(
            @RequestParam("value") String value, Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        String trimmed = value == null ? "" : value.trim();

        if (!isValidNicknameLength(trimmed)) {
            return ResponseEntity.ok(Map.of("available", false, "reason", "닉네임은 2~20자여야 합니다."));
        }

        // 본인이 이미 그 닉네임을 쓰고 있으면 OK (변경 안 함)
        if (userId != null) {
            User self = userRepository.findById(userId).orElse(null);
            if (self != null && trimmed.equals(self.getNickname())) {
                return ResponseEntity.ok(Map.of("available", true, "self", true));
            }
        }

        boolean taken = userRepository.existsByNickname(trimmed);
        if (taken) {
            return ResponseEntity.ok(Map.of("available", false, "reason", "이미 사용 중인 닉네임입니다."));
        }
        return ResponseEntity.ok(Map.of("available", true));
    }

    /* ============================== 아바타 업로드 ============================== */

    @PostMapping("/me/avatar")
    public ResponseEntity<?> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            Authentication authentication,
            HttpServletRequest request) {
        String userId = requireAuthenticatedUserId(authentication);

        ResponseEntity<String> validationError = validateAvatar(file);
        if (validationError != null) return validationError;

        String extension = extractExtension(StringUtils.cleanPath(file.getOriginalFilename()));

        try {
            File destination = prepareDestination(extension);
            file.transferTo(destination);

            String fileUrl = buildPublicUrl(request, destination.getName());

            // DB 의 picture 컬럼도 함께 갱신.
            User user =
                    userRepository
                            .findById(userId)
                            .orElseThrow(() -> ResourceNotFoundException.user(userId));
            user.setPicture(fileUrl);
            userRepository.save(user);

            Map<String, String> response = new HashMap<>();
            response.put("url", fileUrl);
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            log.warn("[Avatar] path traversal 시도 차단");
            return ResponseEntity.badRequest().body("잘못된 경로입니다.");
        } catch (IOException e) {
            log.error("[Avatar] 저장 실패: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(500).body("아바타 저장 중 오류가 발생했습니다.");
        }
    }

    /* ============================== 프로필 메타 수정 ============================== */

    @Data
    public static class UpdateProfileRequest {
        @Size(min = NICKNAME_MIN_LENGTH, max = NICKNAME_MAX_LENGTH)
        private String nickname;

        @Size(max = 2048)
        private String picture;
    }

    @PatchMapping("/me")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateMe(
            @RequestBody UpdateProfileRequest dto, Authentication authentication) {
        String userId = requireAuthenticatedUserId(authentication);

        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));

        if (dto.getNickname() != null) {
            String trimmed = dto.getNickname().trim();
            if (!isValidNicknameLength(trimmed)) {
                throw new IllegalArgumentException("닉네임은 2~20자여야 합니다.");
            }
            if (!trimmed.equals(user.getNickname()) && userRepository.existsByNickname(trimmed)) {
                throw new IllegalArgumentException("이미 사용 중인 닉네임입니다.");
            }
            user.setNickname(trimmed);
        }

        if (dto.getPicture() != null) {
            user.setPicture(dto.getPicture().isBlank() ? null : dto.getPicture());
        }

        userRepository.save(user);

        Map<String, Object> resp = new HashMap<>();
        resp.put("userId", user.getUserId());
        resp.put("nickname", user.getNickname());
        resp.put("picture", user.getPicture());
        return ResponseEntity.ok(resp);
    }

    /* ============================== 회원 탈퇴 ============================== */

    /**
     * v2.17 — PIPA 의무 회원 탈퇴.
     *
     * <p>이메일 / 닉네임 / 휴대전화 / 프로필 사진 등 식별 정보를 즉시 익명화하고 비밀번호를 무효화한다. 사용자가 작성한 동행 글 / 의견 / 코스 등은 데이터
     * 무결성 + 운영 통계 목적으로 닉네임만 {@code [탈퇴한 회원]} 으로 익명화한 채 유지한다. 30일 후 영구 삭제는 별도 cron 으로 처리할 수 있다 (현재는
     * 즉시 익명화만).
     *
     * <p>비밀번호 확인 본인 인증은 추후 강화 가능. 현재는 토큰 보유 자체가 본인 인증.
     */
    @DeleteMapping("/me")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteMe(Authentication authentication) {
        String userId = requireAuthenticatedUserId(authentication);
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));

        // 식별 정보 즉시 익명화 — 이메일 / 휴대전화 unique 충돌 방지를 위해 무작위 suffix.
        String anonSuffix = UUID.randomUUID().toString().substring(0, 8);
        user.setNickname("[탈퇴한 회원]");
        user.setEmail("deleted-" + anonSuffix + "@popspot.invalid");
        user.setPhoneNumber(null);
        user.setPicture(null);
        // 비밀번호를 사용 불가 토큰으로 — 재로그인 불가.
        user.changePassword("DELETED-" + anonSuffix);
        userRepository.save(user);

        // v2.21-S14 — Spotify 연결 토큰 즉시 삭제 (PIPA + Spotify Developer Policy 의무).
        // FK CASCADE 도 있지만 users 는 익명화만 하고 삭제 안 하므로 명시적 삭제 필요.
        spotifyAuthRepository.deleteByUserId(userId);

        log.info("[User] 회원 탈퇴 — userId={} 익명화 + Spotify 토큰 삭제 완료", userId);
        return ResponseEntity.ok(Map.of("status", "DELETED", "userId", userId));
    }

    /* ============================== 내부 헬퍼 ============================== */

    private String authenticatedUserId(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || "anonymousUser".equals(authentication.getName())) {
            return null;
        }
        return authentication.getName();
    }

    private String requireAuthenticatedUserId(Authentication authentication) {
        String userId = authenticatedUserId(authentication);
        if (userId == null) {
            throw new SecurityException("로그인이 필요합니다.");
        }
        return userId;
    }

    private boolean isValidNicknameLength(String value) {
        return value != null
                && value.length() >= NICKNAME_MIN_LENGTH
                && value.length() <= NICKNAME_MAX_LENGTH;
    }

    private ResponseEntity<String> validateAvatar(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 없습니다.");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            return ResponseEntity.badRequest().body("파일 크기는 5MB 이하만 허용됩니다.");
        }

        String cleanedName = StringUtils.cleanPath(safe(file.getOriginalFilename()));
        if (cleanedName.contains(PATH_TRAVERSAL_TOKEN)) {
            return ResponseEntity.badRequest().body("잘못된 파일명입니다.");
        }

        String extension = extractExtension(cleanedName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body("허용되지 않는 파일 형식입니다. (jpg/jpeg/png/webp 만 가능)");
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

    private File prepareDestination(String extension) throws IOException {
        File directory = new File(avatarDir);
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("업로드 디렉토리 생성 실패");
        }

        File dest = new File(avatarDir + File.separator + UUID.randomUUID() + "." + extension);
        String uploadCanon = directory.getCanonicalPath();
        if (!dest.getCanonicalPath().startsWith(uploadCanon + File.separator)) {
            throw new SecurityException("Path traversal");
        }
        return dest;
    }

    private String buildPublicUrl(HttpServletRequest request, String savedFileName) {
        String scheme = resolveScheme(request);
        String host = resolveHost(request);
        return scheme + "://" + host + "/uploads/avatar/" + savedFileName;
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
        int port = request.getServerPort();
        boolean omitPort = port == HTTP_PORT || port == HTTPS_PORT;
        return request.getServerName() + (omitPort ? "" : ":" + port);
    }

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
