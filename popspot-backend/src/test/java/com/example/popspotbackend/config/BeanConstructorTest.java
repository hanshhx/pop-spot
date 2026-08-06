package com.example.popspotbackend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 스프링 빈이 <b>기동 시점에</b> 만들어질 수 있는지 확인한다.
 *
 * <p><b>왜 만들었나.</b> 2026-08-05 에 {@code TakedownNotifier} 가 서비스를 죽였다. 생성자를 둘 두고 (운영용·테스트용) 어느 쪽에도
 * {@code @Autowired} 를 안 붙였더니, 스프링이 <b>기본 생성자를 찾다가</b> {@code NoSuchMethodException: <init>()} 로
 * 기동에 실패했다. 재시작 73번이 전부 같은 지점에서 죽었다.
 *
 * <p><b>왜 단위 테스트가 못 잡았나.</b> 단위 테스트는 생성자를 <b>직접</b> 부른다. 그래서 5건 전부 통과했다. 이 실패는 스프링이 대신 만들어 줄 때만
 * 드러난다.
 *
 * <p><b>왜 컨텍스트 테스트로 안 하나.</b> {@code PopspotBackendApplicationTests} 가 이미 있지만 DB 가 있어야 뜬다. 그래서 DB
 * 없는 환경(로컬 빠른 검증·CI 일부)에서는 건너뛰어지고, 실제로 이번에 그렇게 새어 나갔다. 이 테스트는 <b>소스만 읽으므로</b> 어디서든 돈다 — 컨텍스트 테스트를
 * 대신하는 게 아니라 그 앞에 두는 값싼 그물이다.
 */
class BeanConstructorTest {

    private static final Path SOURCE_ROOT = Path.of("src/main/java");

    /** 스프링이 인스턴스를 직접 만들어 주는 애너테이션. 이 중 하나라도 있으면 검사 대상이다. */
    private static final Pattern STEREOTYPE =
            Pattern.compile("(?m)^@(Component|Service|Repository|RestController|Controller)\\b");

    /** {@code @Configuration} 은 제외 — 그 안의 {@code @Bean} 메서드는 규칙이 다르다. */
    private static final Pattern CLASS_NAME =
            Pattern.compile("(?m)^(?:public\\s+)?(?:final\\s+|abstract\\s+)?class\\s+(\\w+)");

    private record Offender(String file, String reason) {}

    @Test
    @DisplayName("생성자가 둘 이상인 빈은 스프링이 쓸 것을 @Autowired 로 지정해야 한다")
    void multipleConstructorsMustBeDisambiguated() throws IOException {
        List<Offender> offenders = new ArrayList<>();

        try (Stream<Path> files = Files.walk(SOURCE_ROOT)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                /*
                 * 주석을 먼저 걷어낸다. 이걸 안 하면 자바독에 적힌 "@Autowired 를 지우지 마라"
                 * 같은 문장이 실제 애너테이션으로 오인돼, 표시를 떼도 테스트가 <b>계속
                 * 통과한다</b> — 아무것도 못 잡는 테스트가 된다. 실제로 첫 판이 그랬다.
                 */
                String src = stripComments(Files.readString(file));
                if (!STEREOTYPE.matcher(src).find()) continue;

                Matcher nameMatcher = CLASS_NAME.matcher(src);
                if (!nameMatcher.find()) continue;
                String className = nameMatcher.group(1);

                /*
                 * 애너테이션은 <b>바깥 클래스 선언 앞</b>만 본다. 중첩 DTO 에 붙은 @NoArgsConstructor
                 * 까지 세면 PlanningController · TermsController 처럼 멀쩡한 빈이 걸린다 — 실제로
                 * 이 테스트의 첫 판이 그렇게 오탐 4건을 냈다.
                 */
                String header = src.substring(0, nameMatcher.start());

                int explicit = countConstructors(src, className);
                int lombok = countLombokConstructors(header);
                int total = explicit + lombok;

                if (total <= 1) continue;
                if (src.contains("@Autowired")) continue;
                /*
                 * 인자 없는 생성자가 있으면 스프링은 그것을 쓴다 — 기동은 된다.
                 * OllamaTranslationClient · IndexNowService 가 이 경우다. 의존성이 null 로 남는
                 * 별개의 위험은 있지만 <b>이 테스트가 막으려는 실패(기동 불가)</b>는 아니다.
                 */
                if (hasNoArgConstructor(src, className) || header.contains("@NoArgsConstructor")) {
                    continue;
                }

                offenders.add(
                        new Offender(
                                file.getFileName().toString(),
                                "생성자 "
                                        + total
                                        + "개(직접 "
                                        + explicit
                                        + " · Lombok "
                                        + lombok
                                        + ")인데 @Autowired 표시가 없다"));
            }
        }

        assertThat(offenders)
                .describedAs(
                        "스프링은 생성자가 여럿이고 표시가 없으면 기본 생성자를 찾는다. 없으면"
                                + " NoSuchMethodException: <init>() 로 <b>기동 자체가 실패</b>한다."
                                + " 스프링이 쓸 생성자에 @Autowired 를 붙여라.")
                .isEmpty();
    }

    /**
     * {@code TakedownNotifier(} 처럼 <b>클래스 이름 바로 뒤에 괄호</b>가 오는 줄만 센다.
     *
     * <p>{@code static TakedownNotifier defaultExecutor(} 같은 메서드는 이름과 괄호 사이에 메서드명이 끼므로 걸리지 않는다.
     */
    private static int countConstructors(String src, String className) {
        Pattern ctor =
                Pattern.compile(
                        "(?m)^\\s*(?:public\\s+|protected\\s+|private\\s+)?"
                                + Pattern.quote(className)
                                + "\\s*\\(");
        return (int) ctor.matcher(src).results().count();
    }

    /** Lombok 이 만들어 주는 생성자도 한 개로 센다 — 스프링에게는 구분이 없다. */
    private static int countLombokConstructors(String header) {
        int n = 0;
        if (header.contains("@RequiredArgsConstructor")) n++;
        if (header.contains("@AllArgsConstructor")) n++;
        if (header.contains("@NoArgsConstructor")) n++;
        return n;
    }

    /**
     * 블록 주석과 줄 주석을 지운다. 줄 수는 보존해야 {@code (?m)^} 기반 패턴들이 그대로 동작한다.
     *
     * <p>문자열 리터럴 안의 {@code //} 까지 완벽히 가리지는 않는다 — 여기서 찾는 것은 애너테이션과 생성자 선언이라 그 정도 정밀도면 충분하다.
     */
    private static String stripComments(String src) {
        String noBlock =
                Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL)
                        .matcher(src)
                        .replaceAll(m -> m.group().replaceAll("[^\n]", " "));
        return noBlock.replaceAll("(?m)//.*$", "");
    }

    /** {@code ClassName()} — 괄호 안이 빈 생성자가 직접 선언돼 있는가. */
    private static boolean hasNoArgConstructor(String src, String className) {
        return Pattern.compile(
                        "(?m)^\\s*(?:public\\s+|protected\\s+|private\\s+)?"
                                + Pattern.quote(className)
                                + "\\s*\\(\\s*\\)")
                .matcher(src)
                .find();
    }
}
