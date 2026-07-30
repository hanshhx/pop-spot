package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 인증 검사가 <b>익명 사용자를 걸러내는지</b> 컨트롤러 전체에서 확인한다.
 *
 * <p>Spring 의 익명 인증에서는 {@code authentication.isAuthenticated()} 가 <b>참</b>을 돌려주고 이름이 {@code
 * "anonymousUser"} 다. 그래서 {@code isAuthenticated()} 만 보는 검사는 <b>비로그인 요청을 그대로 통과시킨다.</b> {@code
 * /api/**} 가 permitAll 이라 필터 단에서도 막히지 않는다.
 *
 * <p>실제로 컨트롤러마다 검사가 갈려 있었다 — 결제는 {@code @PreAuthorize}, 채팅·스탬프·동행은 {@code "anonymousUser"} 를 명시적으로
 * 걸러냈는데 게임과 코스 저장 두 곳만 빠져 있었다. 한 곳씩 고치는 방식은 다음에 또 빠뜨린다. 그래서 <b>소스를 훑어</b> 규칙을 지키는지 본다.
 *
 * <p>완벽한 검사는 아니다(문자열 대조라 우회 가능). 목적은 <b>같은 실수를 반복할 때 알려주는 것</b>이다.
 */
class AnonymousAuthGuardTest {

    private static final Path CONTROLLERS =
            Path.of("src/main/java/com/example/popspotbackend/controller");

    /** {@code isAuthenticated()} 를 직접 부르는 곳. Spring SpEL 의 동명 함수는 안전하므로 뺀다. */
    private static final Pattern DIRECT_CHECK =
            Pattern.compile("authentication\\s*\\.\\s*isAuthenticated\\s*\\(\\s*\\)");

    @Test
    @DisplayName("isAuthenticated() 를 직접 보는 컨트롤러는 anonymousUser 도 함께 걸러낸다")
    void everyDirectCheckAlsoRejectsAnonymous() throws IOException {
        List<String> offenders = new ArrayList<>();

        try (var files = Files.list(CONTROLLERS)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                String source = Files.readString(file);
                if (!DIRECT_CHECK.matcher(source).find()) continue;

                // @PreAuthorize("isAuthenticated()") 는 SpEL 이라 익명에 대해 거짓이다 — 안전하다.
                boolean guardedBySpel = source.contains("@PreAuthorize");
                boolean guardedExplicitly = source.contains("\"anonymousUser\"");

                if (!guardedBySpel && !guardedExplicitly) {
                    offenders.add(file.getFileName().toString());
                }
            }
        }

        assertThat(offenders)
                .describedAs(
                        "이 컨트롤러들은 authentication.isAuthenticated() 만 봐서 비로그인 요청이 통과한다. "
                                + "\"anonymousUser\" 검사를 추가하거나 @PreAuthorize 를 쓸 것")
                .isEmpty();
    }

    @Test
    @DisplayName("검사 대상이 실제로 존재한다 — 규칙이 조용히 무력화되지 않게")
    void ruleActuallyScansSomething() throws IOException {
        long scanned;
        try (var files = Files.list(CONTROLLERS)) {
            scanned =
                    files.filter(p -> p.toString().endsWith(".java"))
                            .map(
                                    p -> {
                                        try {
                                            return Files.readString(p);
                                        } catch (IOException e) {
                                            return "";
                                        }
                                    })
                            .filter(s -> DIRECT_CHECK.matcher(s).find())
                            .count();
        }

        // 경로가 바뀌거나 패턴이 안 맞으면 0 이 되어 위 테스트가 항상 통과해 버린다.
        assertThat(scanned).describedAs("컨트롤러 경로·패턴 확인").isGreaterThan(3);
    }
}
