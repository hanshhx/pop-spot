package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 관리자 API 가 <b>실제로 레이트리밋 대상인지</b>, 그리고 무겁게 취급하기로 한 경로 이름이 <b>진짜 엔드포인트와 맞는지</b> 확인한다.
 *
 * <p>둘 다 <b>틀려도 아무 증상이 없다.</b> 경로를 등록하지 않으면 그냥 무제한으로 잘 동작하고, 무거운 경로 이름에 오타가 나도 일반 한도(분당 120)가 적용돼
 * 화면은 멀쩡하다. 실제로 작업 중에 보상 지급 경로를 {@code /rewards} 로 적었는데 진짜 경로는 {@code /reward} 였다 — 컴파일도 통과하고 화면도
 * 정상이라 사람이 알아챌 방법이 없었다.
 *
 * <p>그래서 <b>컨트롤러 소스를 훑어</b> 대조한다. 완벽한 검사는 아니지만, 경로가 바뀌었는데 여기만 그대로인 상황을 잡아 준다.
 */
class AdminRateLimitTest {

    /**
     * 소스 루트. <b>현재 디렉터리에 기대지 않는다</b> — Gradle 은 모듈 폴더에서 돌지만 다른 러너는 그렇지 않아, 상대경로로 두면 "파일이 없다" 로
     * 실패한다. 실제로 그렇게 한 번 깨졌다.
     */
    private static final Path CONTROLLERS = findSourceRoot();

    private static Path findSourceRoot() {
        Path dir = Path.of("").toAbsolutePath();
        for (int depth = 0; depth < 6 && dir != null; depth++, dir = dir.getParent()) {
            Path candidate = dir.resolve("src/main/java/com/example/popspotbackend");
            if (Files.isDirectory(candidate)) return candidate;
            // 저장소 루트에서 돌 때는 백엔드 모듈 안까지 한 단계 더 들어간다.
            Path inModule = dir.resolve("popspot-backend/src/main/java/com/example/popspotbackend");
            if (Files.isDirectory(inModule)) return inModule;
        }
        throw new IllegalStateException("백엔드 소스 루트를 찾지 못했습니다.");
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (Exception e) {
            return "";
        }
    }

    @Test
    @DisplayName("관리자 경로가 레이트리밋 대상에 등록돼 있다")
    void adminPathsAreRateLimited() throws Exception {
        String webConfig = Files.readString(CONTROLLERS.resolve("config/WebConfig.java"));

        assertThat(webConfig)
                .describedAs(
                        "/api/admin/** 이 RATE_LIMITED_API_PATTERNS 에 없으면 관리자 API 가 무제한이 된다. "
                                + "권한 검사는 통과 여부만 정하지 횟수를 세지 않는다")
                .contains("\"/api/admin/**\"");
    }

    @Test
    @DisplayName("무겁게 취급하는 관리자 경로가 실제 엔드포인트와 일치한다")
    void heavyPathsMatchRealEndpoints() throws Exception {
        String interceptor =
                Files.readString(CONTROLLERS.resolve("config/RateLimitInterceptor.java"));

        // ADMIN_HEAVY_PATHS 배열에서 경로 문자열만 뽑는다.
        String block = interceptor.split("ADMIN_HEAVY_PATHS = \\{")[1].split("\\};")[0];
        List<String> declared =
                Pattern.compile("\"(/api/admin/[^\"]+)\"")
                        .matcher(block)
                        .results()
                        .map(m -> m.group(1))
                        .toList();

        assertThat(declared).describedAs("무거운 경로 목록이 비어 있다").isNotEmpty();

        // 컨트롤러 전체를 한 덩어리로 합쳐 각 경로의 마지막 조각이 실제로 존재하는지 본다.
        StringBuilder all = new StringBuilder();
        try (var files = Files.walk(CONTROLLERS)) {
            files.filter(p -> p.toString().endsWith(".java")).forEach(p -> all.append(read(p)));
        }
        String source = all.toString();

        for (String path : declared) {
            // 매핑은 클래스와 메서드로 쪼개져 있다 — @RequestMapping("/api/admin") +
            // @PostMapping("/popups/dedupe") 일 수도, @RequestMapping("/api/admin/popups/crawl") +
            // @PostMapping("/run") 일 수도 있다. 그래서 앞에서부터 한 조각씩 떼며 어느 형태로든
            // 실제 소스에 그 꼬리가 있는지 본다.
            assertThat(hasMappingFor(source, path))
                    .describedAs(
                            "%s 에 해당하는 엔드포인트를 컨트롤러에서 찾지 못했다 — 경로 오타이거나 엔드포인트가"
                                    + " 바뀌었다. 이대로면 이 경로는 무거운 한도가 아니라 일반 한도를 받는다",
                            path)
                    .isTrue();
        }
    }

    /** 경로의 어떤 꼬리든 소스에 매핑 문자열로 존재하면 참. */
    private static boolean hasMappingFor(String source, String fullPath) {
        String[] segments = fullPath.split("/");
        // 마지막 조각만 남을 때까지 앞에서부터 떼어 본다.
        for (int start = 1; start < segments.length; start++) {
            StringBuilder tail = new StringBuilder();
            for (int i = start; i < segments.length; i++) tail.append('/').append(segments[i]);
            if (source.contains("\"" + tail + "\"")) return true;
        }
        return false;
    }

    @Test
    @DisplayName("세션 무효화 경로가 무거운 목록에 있다 — 보안 조치는 반복될 이유가 없다")
    void revokeAllIsHeavy() throws Exception {
        String interceptor =
                Files.readString(CONTROLLERS.resolve("config/RateLimitInterceptor.java"));

        assertThat(interceptor.split("ADMIN_HEAVY_PATHS = \\{")[1].split("\\};")[0])
                .contains("/api/admin/session/revoke-all");
    }

    @Test
    @DisplayName("관리자 버킷은 계정을 섞는다 — IP 만 쓰면 직접 호출 경로에서 전원이 한 바구니가 된다")
    void adminBucketIncludesAccount() throws Exception {
        String interceptor =
                Files.readString(CONTROLLERS.resolve("config/RateLimitInterceptor.java"));

        assertThat(interceptor)
                .describedAs("rateLimitIdentity 가 관리자 경로에서 계정을 섞지 않으면 이 방어는 의미가 없다")
                .contains("rateLimitIdentity")
                .contains("currentAccountId");
    }
}
