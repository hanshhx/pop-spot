package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * D-4 — 보안 담당과 분석 담당을 <b>역할로</b> 나눈다.
 *
 * <p>지금은 관리자가 한 명이라 동작이 달라지지 않는다. 두 번째 사람에게 <b>방문 통계만</b> 열어 줄 수 있게 미리 자리를 만들어 두는 것이다.
 *
 * <p><b>계층(RoleHierarchy)을 쓰지 않았다.</b> {@code ROLE_ADMIN > ROLE_SECURITY} 로 선언하는 쪽이 짧지만, 그 계층이 메서드
 * 보안까지 연결되는지는 Spring 버전마다 다르다. 연결이 안 되면 증상이 <b>"관리자가 자기 화면에서 403"</b> 이라 대가가 너무 크다. 장황해도 역할을 그대로
 * 적는다.
 *
 * <p>그래서 이 테스트가 필요하다 — 손으로 적는 방식은 <b>한 곳을 빠뜨리기 쉽고</b>, 빠뜨린 결과가 바로 잠금이다.
 */
class AdminRoleSeparationTest {

    private static final Path CONTROLLERS =
            Path.of("src/main/java/com/example/popspotbackend/controller");

    /** 권한식만 뽑는다 — {@code @PreAuthorize("...")} 안쪽. */
    private static final Pattern PRE_AUTHORIZE = Pattern.compile("@PreAuthorize\\(\"([^\"]+)\"\\)");

    private static String source(String className) {
        try {
            return Files.readString(
                    CONTROLLERS.resolve(className + ".java"), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(className + " 를 읽지 못했다 — 이름이 바뀌었나?", e);
        }
    }

    private static List<String> expressions(String source) {
        Matcher m = PRE_AUTHORIZE.matcher(source);
        return m.results().map(r -> r.group(1)).toList();
    }

    /**
     * <b>이 테스트가 이 파일의 존재 이유다.</b>
     *
     * <p>역할을 쪼개다가 어느 한 곳에서 {@code 'ADMIN'} 을 빠뜨리면, 지금 유일한 관리자가 그 화면에서 즉시 잠긴다. 되돌리려면 배포를 다시 해야 하는데 그
     * 배포도 관리자 화면 없이 해야 한다.
     */
    @Test
    @DisplayName("모든 관리자 화면이 여전히 ROLE_ADMIN 을 받는다 — 한 곳만 빠뜨려도 사장님이 잠긴다")
    void everyAdminScreenStillAcceptsAdmin() throws IOException {
        try (Stream<Path> files = Files.list(CONTROLLERS)) {
            for (Path file : files.filter(f -> f.toString().endsWith(".java")).toList()) {
                String text = Files.readString(file, StandardCharsets.UTF_8);

                for (String expression : expressions(text)) {
                    // 역할을 안 보는 식(isAuthenticated 등)은 이 검사 대상이 아니다.
                    if (!expression.contains("hasRole") && !expression.contains("hasAnyRole")) {
                        continue;
                    }
                    assertThat(expression)
                            .describedAs(
                                    "%s 의 '%s' 가 ADMIN 을 안 받는다 — 지금 관리자는 ROLE_ADMIN 하나뿐이다",
                                    file.getFileName(), expression)
                            .contains("ADMIN");
                }
            }
        }
    }

    /**
     * 관문이 둘이라 <b>둘 다</b> 봐야 한다.
     *
     * <p>{@code SecurityConfig} 의 URL 규칙이 먼저 걸러내고, 컨트롤러의 {@code @PreAuthorize} 가 한 번 더 본다. 위 테스트는
     * 뒤쪽만 본다 — 앞쪽에서 ADMIN 이 빠지면 컨트롤러가 아무리 옳아도 관리자는 URL 층에서 403 을 맞는다.
     */
    @Test
    @DisplayName("URL 규칙의 역할 목록에도 ADMIN 이 빠지지 않았다 — 관문이 둘이다")
    void urlRulesAlsoKeepAdmin() throws IOException {
        String config =
                Files.readString(
                        Path.of(
                                "src/main/java/com/example/popspotbackend/config/SecurityConfig.java"),
                        StandardCharsets.UTF_8);

        Matcher m = Pattern.compile("hasAnyRole\\(([^)]*)\\)").matcher(config);
        List<String> roleLists = m.results().map(r -> r.group(1)).toList();

        assertThat(roleLists).describedAs("역할을 나눈 URL 규칙이 하나도 없다").isNotEmpty();
        assertThat(roleLists)
                .describedAs("URL 규칙에서 ADMIN 이 빠지면 지금 관리자가 그 경로에서 잠긴다")
                .allMatch(roles -> roles.contains("ADMIN"));
    }

    @Test
    @DisplayName("보안 화면은 보안 역할을 함께 받는다 — 쪼갠 것이 실제로 반영됐는가")
    void securityScreensNameTheSecurityRole() {
        for (String controller : new String[] {"AdminAuditController", "AdminIpBlockController"}) {
            assertThat(expressions(source(controller)))
                    .describedAs("%s 가 보안 역할을 안 받으면 역할을 쪼갠 의미가 없다", controller)
                    .anyMatch(e -> e.contains("SECURITY"));
        }
    }

    @Test
    @DisplayName("분석 화면은 분석 역할을 함께 받는다")
    void analyticsScreensNameTheAnalyticsRole() {
        for (String controller : new String[] {"AdminVisitController", "AdminMetricsController"}) {
            assertThat(expressions(source(controller)))
                    .describedAs("%s 가 분석 역할을 안 받으면 두 번째 사람에게 열어 줄 것이 없다", controller)
                    .anyMatch(e -> e.contains("ANALYTICS"));
        }
    }

    /**
     * 분리의 <b>실질</b>은 여기다. 분석만 맡은 사람이 보안 기록을 볼 수 있으면 쪼갠 것이 아니다.
     *
     * <p>감사 로그에는 관리자가 어디서 접속하는지가 적혀 있고, IP 차단은 그 사람을 밀어낼 수 있다.
     */
    @Test
    @DisplayName("분석 담당은 보안 화면에 못 들어간다 — 이게 분리의 실질이다")
    void analyticsRoleCannotReachSecurityScreens() {
        for (String controller : new String[] {"AdminAuditController", "AdminIpBlockController"}) {
            assertThat(expressions(source(controller)))
                    .describedAs("%s 가 ANALYTICS 를 받으면 분석 담당이 감사 로그를 읽는다", controller)
                    .noneMatch(e -> e.contains("ANALYTICS"));
        }
    }

    @Test
    @DisplayName("보안 담당은 분석 화면에 못 들어간다 — 방문 통계는 회원 행동 기록이다")
    void securityRoleCannotReachAnalyticsScreens() {
        for (String controller : new String[] {"AdminVisitController", "AdminMetricsController"}) {
            assertThat(expressions(source(controller)))
                    .describedAs("%s 가 SECURITY 를 받으면 보안 담당이 방문 통계를 본다", controller)
                    .noneMatch(e -> e.contains("SECURITY"));
        }
    }
}
