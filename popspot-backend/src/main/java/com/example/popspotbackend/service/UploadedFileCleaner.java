package com.example.popspotbackend.service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 업로드 폴더의 파일을 지운다 — 회원 탈퇴 시 개인정보 파기용.
 *
 * <p>v2.47 — 탈퇴하면 DB 는 정리되는데 <b>프로필 사진과 채팅에 올린 이미지 파일은 디스크에 그대로</b> 남아 있었다. {@code /uploads/**} 는
 * 공개 경로라, 주소를 아는 사람은 탈퇴 후에도 계속 볼 수 있다. 개인정보 파기 관점에서 DB 행만 지우는 것으로는 부족하다.
 *
 * <p><b>업로드 폴더 안인지 반드시 확인하고 지운다.</b> 지우는 대상 경로는 DB 에 저장된 값에서 오는데, 그 값이 예전에 다른 규칙으로 저장됐거나 조작됐다면
 * {@code ../} 가 섞여 폴더 밖 파일을 가리킬 수 있다. 삭제는 되돌릴 수 없으므로 실제 경로(canonical)를 계산해 울타리 안인지 본 뒤에만 지운다.
 *
 * <p>실패는 삼킨다. 파일이 이미 없거나 권한이 없다고 해서 <b>탈퇴 자체가 실패하면 안 된다</b> — 사용자는 탈퇴를 못 하게 되고, 정작 데이터는 DB 에 남는다.
 */
@Slf4j
@Service
public class UploadedFileCleaner {

    /** 공개 경로 접두사. DB 에는 이 형태로 저장된다(MateService.normalizeFileUrl 참고). */
    private static final String PUBLIC_PREFIX = "/uploads/";

    /**
     * 울타리 기준 경로 — <b>실제 경로(canonical)로 맞춰 둔다.</b>
     *
     * <p>비교 대상만 canonical 로 바꾸고 이쪽은 그냥 normalize 만 했다가, 같은 폴더인데도 "밖" 으로 판정돼 <b>아무것도 못 지우는</b> 상태였다.
     * 윈도우 8.3 단축명(KIMDON~1 ↔ kim donghyun)에서 드러났지만, 운영에서도 심볼릭 링크·대소문자 차이가 있으면 같은 일이 생긴다. 조용히 실패하는
     * 종류라 로그만 봐서는 "지울 게 없었나 보다" 로 읽힌다.
     */
    private final Path uploadRoot;

    public UploadedFileCleaner(@Value("${app.upload.path}") String uploadPath) {
        Path normalized = Paths.get(uploadPath).toAbsolutePath().normalize();
        Path canonical = normalized;
        try {
            canonical = normalized.toFile().getCanonicalFile().toPath();
        } catch (IOException e) {
            // 폴더가 아직 없을 수 있다(첫 업로드 전). 그때는 normalize 값으로 두고,
            // 실제 삭제 시점에 다시 계산되므로 동작에는 지장이 없다.
            log.warn("[FileCleanup] 업로드 경로 확정 실패 — normalize 값 사용: {}", normalized);
        }
        this.uploadRoot = canonical;
    }

    /**
     * 여러 개를 한 번에. null·빈 값·업로드 폴더 밖 경로는 조용히 건너뛴다.
     *
     * @return 실제로 지운 개수
     */
    public int deleteAll(Collection<String> urlsOrPaths) {
        if (urlsOrPaths == null || urlsOrPaths.isEmpty()) return 0;
        int deleted = 0;
        for (String value : urlsOrPaths) {
            if (delete(value)) deleted++;
        }
        return deleted;
    }

    /** 파일 하나. 지웠으면 true. */
    public boolean delete(String urlOrPath) {
        String fileName = extractFileName(urlOrPath);
        if (fileName == null) return false;

        try {
            Path target = uploadRoot.resolve(fileName).normalize();

            // 울타리 검사 — resolve/normalize 후에도 업로드 폴더 안이어야 한다.
            if (!target.toFile().getCanonicalFile().toPath().startsWith(uploadRoot)) {
                log.warn("[FileCleanup] 업로드 폴더 밖 경로 — 건너뜀: {}", urlOrPath);
                return false;
            }
            return Files.deleteIfExists(target);
        } catch (IOException | RuntimeException e) {
            // 탈퇴를 막지 않는다. 남은 파일은 운영자가 별도로 정리할 수 있다.
            log.warn("[FileCleanup] 삭제 실패 {} — {}", urlOrPath, e.toString());
            return false;
        }
    }

    /**
     * 저장된 값에서 파일명만 뽑는다.
     *
     * <p>세 가지 형태가 섞여 있다 — 절대 URL({@code https://호스트/uploads/a.webp}), 공개 경로 ({@code
     * /uploads/a.webp}), 파일명만({@code a.webp}). 어느 쪽이든 마지막 조각만 쓴다.
     *
     * <p>업로드 폴더 밖을 가리키는 값(외부 URL·경로 구분자 포함)은 null 로 돌려 지우지 않는다.
     */
    private String extractFileName(String urlOrPath) {
        if (urlOrPath == null || urlOrPath.isBlank()) return null;
        String value = urlOrPath.trim();

        int marker = value.indexOf(PUBLIC_PREFIX);
        String tail = marker >= 0 ? value.substring(marker + PUBLIC_PREFIX.length()) : value;

        // 외부 URL 인데 /uploads/ 가 없으면 우리 파일이 아니다(소셜 프로필 사진 등).
        if (marker < 0 && (tail.startsWith("http://") || tail.startsWith("https://"))) return null;

        // 쿼리스트링 제거 후 마지막 경로 조각만.
        int query = tail.indexOf('?');
        if (query >= 0) tail = tail.substring(0, query);
        tail = tail.replace('\\', '/');
        int slash = tail.lastIndexOf('/');
        if (slash >= 0) tail = tail.substring(slash + 1);

        if (tail.isBlank() || tail.contains("..") || tail.contains(File.separator)) return null;
        return tail;
    }
}
