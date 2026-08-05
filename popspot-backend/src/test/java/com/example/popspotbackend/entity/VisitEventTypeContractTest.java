package com.example.popspotbackend.entity;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 프론트가 보내는 행동 종류와 백엔드가 받는 목록이 <b>같은지</b> 확인한다.
 *
 * <p><b>이 어긋남은 소리 없이 실패한다.</b> {@code VisitService.recordEvent} 는 목록에 없는 종류를
 * 400 으로 알리지 않고 조용히 버린다 — 비콘이라 화면이 실패를 처리할 방법도 이유도 없기 때문이다.
 * 그래서 한쪽만 고치면 <b>화면은 정상, 통계만 0</b> 인 상태가 되고, 그걸 알아차리는 유일한 방법은
 * 몇 주 뒤 "왜 이 칸이 계속 0 이지" 하고 의심하는 것뿐이다.
 *
 * <p>C-4 에서 {@code wishlist_add} · {@code outbound_click} 을 양쪽에 더하면서 만들었다. 실제로
 * 프론트 타입만 늘리고 백엔드를 잊으면 퍼널의 뒤 두 칸이 영원히 0 이 된다.
 *
 * <p>소스를 읽어서 비교하므로 DB 도 스프링 컨텍스트도 필요 없다.
 */
class VisitEventTypeContractTest {

    private static final Path BACKEND_ENTITY =
            Path.of("src/main/java/com/example/popspotbackend/entity/VisitEvent.java");

    private static final Path FRONTEND_TYPES = Path.of("../popspot-frontend/src/lib/visitEvent.ts");

    /** {@code public static final String TYPE_X = "value";} */
    private static final Pattern BACKEND_TYPE =
            Pattern.compile("String\\s+TYPE_\\w+\\s*=\\s*\"([a-z_]+)\"");

    /** {@code 'popup_open' | 'map_search' | ...} — 타입 별칭 안의 문자열 리터럴. */
    private static final Pattern FRONT_UNION =
            Pattern.compile("export type VisitEventType\\s*=([^;]+);", Pattern.DOTALL);

    private static final Pattern FRONT_LITERAL = Pattern.compile("'([a-z_]+)'");

    @Test
    @DisplayName("프론트가 보내는 종류와 백엔드가 받는 종류가 정확히 같다")
    void frontendAndBackendAgreeOnEventTypes() throws IOException {
        Set<String> backend = backendTypes();
        Set<String> frontend = frontendTypes();

        assertThat(backend)
                .describedAs("백엔드 상수를 하나도 못 읽었다면 이 테스트는 아무것도 검사하지 않은 것이다")
                .isNotEmpty();
        assertThat(frontend)
                .describedAs("프론트 타입을 못 읽었다면 마찬가지다")
                .isNotEmpty();

        assertThat(frontend)
                .describedAs(
                        "프론트만 아는 종류는 서버가 조용히 버린다 — 화면은 정상인데 통계만 0 이 된다."
                                + " VisitEvent.ALLOWED_TYPES 에도 추가하라")
                .isSubsetOf(backend);

        assertThat(backend)
                .describedAs(
                        "백엔드만 아는 종류는 아무도 보내지 않는다 — 쓰지 않을 것이면 지우고,"
                                + " 쓸 것이면 visitEvent.ts 의 VisitEventType 에 추가하라")
                .isSubsetOf(frontend);
    }

    @Test
    @DisplayName("ALLOWED_TYPES 가 선언된 상수를 하나도 빠뜨리지 않는다")
    void allowedTypesContainsEveryDeclaredConstant() throws IOException {
        String src = Files.readString(BACKEND_ENTITY);
        int at = src.indexOf("ALLOWED_TYPES");
        assertThat(at).describedAs("ALLOWED_TYPES 를 못 찾았다").isGreaterThan(0);

        // Set.of(...) 안에 어떤 상수 이름이 들어 있는지.
        String setBlock = src.substring(at, src.indexOf(";", at));
        for (String constant : declaredConstantNames(src)) {
            assertThat(setBlock)
                    .describedAs(
                            constant
                                    + " 를 선언해 놓고 ALLOWED_TYPES 에 안 넣었다 —"
                                    + " 그 종류는 저장되지 않는다")
                    .contains(constant);
        }
    }

    private static Set<String> backendTypes() throws IOException {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = BACKEND_TYPE.matcher(Files.readString(BACKEND_ENTITY));
        while (m.find()) out.add(m.group(1));
        return out;
    }

    private static Set<String> declaredConstantNames(String src) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = Pattern.compile("String\\s+(TYPE_\\w+)\\s*=").matcher(src);
        while (m.find()) out.add(m.group(1));
        return out;
    }

    private static Set<String> frontendTypes() throws IOException {
        String src = Files.readString(FRONTEND_TYPES);
        Matcher union = FRONT_UNION.matcher(src);
        assertThat(union.find()).describedAs("visitEvent.ts 에서 VisitEventType 을 못 찾았다").isTrue();

        Set<String> out = new LinkedHashSet<>();
        Matcher lit = FRONT_LITERAL.matcher(union.group(1));
        while (lit.find()) out.add(lit.group(1));
        return out;
    }
}
