package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 탈퇴 시 업로드 파일을 실제로 지우는지 — <b>진짜 파일로</b> 확인한다.
 *
 * <p>이 테스트가 없어서 결함이 두 번 지나갔다. 처음에는 울타리 비교의 한쪽만 canonical 로 바꿔 아무것도 못 지웠고, 그다음에는 마지막 경로 조각만 떼어
 * <b>{@code uploads/avatar/} 아래의 프로필 사진을 못 지웠다.</b> 두 번 다 삭제기를 목으로 대체한 테스트만 있어서 통과했다.
 *
 * <p>그래서 여기서는 임시 폴더에 실제 파일을 만들고, <b>실제 저장 구조를 그대로</b> 쓴다 — 프로필 사진은 {@code avatar/} 하위, 채팅 이미지는 업로드
 * 루트에 평평하게.
 */
class UploadedFileCleanerTest {

    private static Path touch(Path path) throws IOException {
        Files.createDirectories(path.getParent());
        Files.writeString(path, "x");
        return path;
    }

    @Test
    @DisplayName("프로필 사진은 avatar 하위에 있어도 지운다")
    void deletesAvatarInSubdirectory() throws IOException, InterruptedException {
        Path root = Files.createTempDirectory("popspot-upload");
        Path avatar = touch(root.resolve("avatar").resolve("me.webp"));
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        // UserProfileController 가 DB 에 넣는 형태 그대로(절대 URL).
        boolean deleted = cleaner.delete("https://popspot.co.kr/uploads/avatar/me.webp");

        assertThat(deleted).isTrue();
        assertThat(Files.exists(avatar)).isFalse();
    }

    @Test
    @DisplayName("공개 경로 형태로 저장된 값도 지운다")
    void deletesAvatarFromPublicPath() throws IOException {
        Path root = Files.createTempDirectory("popspot-upload");
        Path avatar = touch(root.resolve("avatar").resolve("me.webp"));
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        assertThat(cleaner.delete("/uploads/avatar/me.webp")).isTrue();
        assertThat(Files.exists(avatar)).isFalse();
    }

    @Test
    @DisplayName("채팅 이미지는 업로드 루트에 평평하게 저장된다 — 그쪽도 계속 지운다")
    void stillDeletesFlatChatFile() throws IOException {
        Path root = Files.createTempDirectory("popspot-upload");
        Path chat = touch(root.resolve("chat-1.webp"));
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        assertThat(cleaner.delete("/uploads/chat-1.webp")).isTrue();
        assertThat(Files.exists(chat)).isFalse();
    }

    @Test
    @DisplayName("업로드 폴더 밖을 가리키면 지우지 않는다")
    void refusesToEscapeUploadRoot() throws IOException {
        Path base = Files.createTempDirectory("popspot-base");
        Path root = Files.createDirectory(base.resolve("uploads-root"));
        Path outside = touch(base.resolve("secret.txt"));
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        for (String attack :
                List.of(
                        "/uploads/../secret.txt",
                        "/uploads/avatar/../../secret.txt",
                        "..\\secret.txt",
                        "/uploads/",
                        "/uploads/avatar/")) {
            assertThat(cleaner.delete(attack)).describedAs(attack).isFalse();
        }
        assertThat(Files.exists(outside)).describedAs("밖의 파일은 그대로 있어야 한다").isTrue();
    }

    @Test
    @DisplayName("우리 파일이 아닌 외부 URL 은 건드리지 않는다")
    void ignoresExternalUrls() throws IOException {
        Path root = Files.createTempDirectory("popspot-upload");
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        // 소셜 로그인 프로필 사진 — 우리 디스크에 없다.
        assertThat(cleaner.delete("https://lh3.googleusercontent.com/a/abc123")).isFalse();
        assertThat(cleaner.delete("http://k.kakaocdn.net/dn/profile.jpg")).isFalse();
    }

    @Test
    @DisplayName("없는 파일·빈 값은 조용히 false — 탈퇴를 막지 않는다")
    void survivesMissingValues() throws IOException {
        Path root = Files.createTempDirectory("popspot-upload");
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        assertThat(cleaner.delete("/uploads/avatar/nope.webp")).isFalse();
        assertThat(cleaner.delete("")).isFalse();
        assertThat(cleaner.delete(null)).isFalse();
    }

    @Test
    @DisplayName("여러 개를 넘기면 지운 개수를 돌려준다")
    void countsDeletions() throws IOException {
        Path root = Files.createTempDirectory("popspot-upload");
        touch(root.resolve("avatar").resolve("a.webp"));
        touch(root.resolve("b.webp"));
        UploadedFileCleaner cleaner = new UploadedFileCleaner(root.toString());

        int deleted =
                cleaner.deleteAll(
                        List.of("/uploads/avatar/a.webp", "/uploads/b.webp", "/uploads/gone.webp"));

        assertThat(deleted).isEqualTo(2);
    }
}
