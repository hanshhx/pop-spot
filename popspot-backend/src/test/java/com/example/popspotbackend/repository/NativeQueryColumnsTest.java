package com.example.popspotbackend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 네이티브 SQL 이 <b>존재하지 않는 칼럼</b>을 참조하지 못하게 막는다.
 *
 * <p>실제로 이런 일이 있었다. 관리자 통계 하나가 {@code LEFT JOIN popup_store p ON p.id = e.popup_id} 라고 적었는데, {@code
 * popup_store} 의 기본키 칼럼은 {@code id} 가 아니라 {@code popup_id} 였다({@code PopupStore} 의 자바 필드명이 {@code
 * id} 라서 그대로 옮겨 적은 것이다). 그 조회는 <b>배포된 순간부터 계속 죽어 있었고 몇 주 동안 아무도 몰랐다.</b>
 *
 * <p>왜 아무도 못 잡았나 — 방어선이 셋 다 통과했다.
 *
 * <ul>
 *   <li>자바 컴파일러는 문자열 안을 보지 않는다.
 *   <li>하이버네이트는 시동할 때 네이티브 SQL 을 파싱하지 않는다. JPQL 과 달리 그냥 DB 로 보낸다.
 *   <li>테스트는 전부 리포지터리를 Mock 하는 단위 테스트라, SQL 이 실제 DB 로 나갈 일이 없다.
 * </ul>
 *
 * <p>그래서 이 테스트는 DB 없이 <b>소스만 읽어서</b> 검사한다. 엔티티의 {@code @Table}·{@code @Column} 으로 실제 테이블·칼럼 표를 만들고,
 * 네이티브 쿼리가 참조하는 칼럼을 그 표에 대조한다.
 *
 * <p><b>일부러 좁게 본다.</b> {@code alias.column} 처럼 별칭이 붙은 참조만 검사한다. 별칭 없는 칼럼까지 보려 하면 출력 별칭({@code AS
 * name})과 문자열 리터럴({@code 'internal'})을 칼럼으로 오인해 오탐이 쏟아진다 — 오탐이 나는 검사는 곧 무시되므로, 확실한 것만 잡는 쪽을 택했다. 이
 * 좁은 규칙만으로도 실제 사고는 잡힌다.
 */
class NativeQueryColumnsTest {

    /** 스키마의 진실은 마이그레이션이 아니라 엔티티에 있다 — V1 은 no-op 이고 스키마는 엔티티로부터 생성됐다. */
    private static final Path BACKEND_SRC = findSourceRoot();

    private static final Pattern TABLE =
            Pattern.compile("@Table\\s*\\(\\s*name\\s*=\\s*\"([^\"]+)\"");

    /**
     * 필드 하나와 <b>그 바로 앞에 붙은 애노테이션들</b>을 함께 잡는다.
     *
     * <p>둘을 따로 모으면 안 된다. 처음엔 {@code @Column(name=...)} 값들과 필드명들을 각각 전부 칼럼 목록에 넣었는데, 그러면
     * {@code @Column(name = "popup_id") private Long id;} 에서 {@code popup_id} 와 {@code id} 가 <b>둘
     * 다</b> 유효한 칼럼이 된다. 잡으려던 사고가 정확히 그 모양이라, 검사가 통과해 버렸다. 이름을 명시했으면 그 이름<b>만</b> 칼럼이다.
     */
    private static final Pattern ANNOTATED_FIELD =
            Pattern.compile(
                    "((?:@\\w+(?:\\([^)]*\\))?\\s*)*)"
                            + "private\\s+(?!static)[\\w.<>\\[\\], ]+?\\s+(\\w+)\\s*[;=]");

    private static final Pattern EXPLICIT_NAME =
            Pattern.compile("@(?:Column|JoinColumn)\\s*\\([^)]*name\\s*=\\s*\"([^\"]+)\"");

    /** 칼럼이 아닌 필드 — 컬렉션 관계와 비영속 필드. */
    private static final Pattern NOT_A_COLUMN =
            Pattern.compile("@(?:OneToMany|ManyToMany|Transient|ElementCollection)\\b");

    /**
     * {@code FROM visit_event e} · {@code JOIN popup_store p} — 별칭이 어느 테이블을 가리키는지.
     *
     * <p><b>{@code (?<![:\w])} 가 핵심이다.</b> 이게 없으면 명명 파라미터 {@code :from} 이 키워드
     * {@code FROM} 으로 읽힌다. {@code WHERE e.created_at >= :from AND e.created_at < :to} 에서
     * "{@code from} 다음 낱말 = 테이블, 그다음 = 별칭" 으로 잡혀 <b>{@code e → and}</b> 라는 엉뚱한
     * 짝이 만들어지고, 그것이 진짜 짝({@code e → visit_event})을 덮어써서 그 쿼리가 검사에서 통째로
     * 빠졌다. 테스트는 초록불인데 아무것도 안 보고 있는 상태다.
     *
     * <p>2026-08-05 에 실제로 그렇게 새어 나갔다 — 새로 넣은 세션 집계 쿼리에 오타를 심어도
     * 이 테스트가 통과했다.
     */
    private static final Pattern ALIAS =
            Pattern.compile(
                    "(?<![:\\w])\\b(?:FROM|JOIN)\\s+([a-z_][a-z0-9_]*)\\s+(?:AS\\s+)?([a-z][a-z0-9_]*)\\b",
                    Pattern.CASE_INSENSITIVE);

    /** {@code p.popup_id} — 별칭이 붙은 칼럼 참조. */
    private static final Pattern QUALIFIED =
            Pattern.compile("\\b([a-z][a-z0-9_]*)\\.([a-z_][a-z0-9_]*)\\b");

    /** SQL 예약어라 별칭으로 오인하면 안 되는 것들. */
    private static final Set<String> NOT_ALIASES =
            Set.of(
                    "select", "from", "where", "join", "on", "and", "or", "as", "by", "set",
                    "values");

    @Test
    @DisplayName("네이티브 SQL 이 참조하는 칼럼은 엔티티에 실재해야 한다")
    void nativeQueriesReferenceRealColumns() {
        Map<String, Set<String>> schema = readSchemaFromEntities();
        assertThat(schema)
                .describedAs("엔티티를 하나도 못 읽었다면 이 테스트는 아무것도 검사하지 않은 것이다")
                .hasSizeGreaterThan(10);

        List<String> offenders = new ArrayList<>();
        int checked = 0;

        for (Path file : javaFiles(BACKEND_SRC.resolve("repository"))) {
            String source = read(file);
            for (String sql : nativeQueries(source)) {
                checked++;
                Map<String, String> aliases = aliasToTable(sql);
                if (aliases.isEmpty()) continue;

                Matcher m = QUALIFIED.matcher(sql);
                while (m.find()) {
                    String table = aliases.get(m.group(1).toLowerCase());
                    if (table == null) continue; // 우리가 아는 별칭이 아니면 판단하지 않는다
                    Set<String> columns = schema.get(table);
                    if (columns == null) continue; // 엔티티가 없는 표(뷰 등)는 검사 대상 밖
                    if (!columns.contains(m.group(2).toLowerCase())) {
                        offenders.add(
                                file.getFileName()
                                        + ": "
                                        + m.group()
                                        + " — "
                                        + table
                                        + " 에 그런 칼럼이 없다 (있는 것: "
                                        + columns.stream().sorted().limit(8).toList()
                                        + "…)");
                    }
                }
            }
        }

        assertThat(checked).describedAs("네이티브 쿼리를 하나도 못 찾았다면 추출 규칙이 깨진 것이다").isGreaterThan(5);
        assertThat(offenders)
                .describedAs("없는 칼럼을 참조하는 네이티브 SQL 이다. 자바 필드명이 아니라 @Column(name=...) 이 실제 칼럼명이다")
                .isEmpty();
    }

    /** 엔티티에서 테이블 → 칼럼 집합. {@code @Column} 이 없으면 자바 필드명의 snake_case 가 칼럼명이다. */
    private static Map<String, Set<String>> readSchemaFromEntities() {
        Map<String, Set<String>> schema = new HashMap<>();
        for (Path file : javaFiles(BACKEND_SRC.resolve("entity"))) {
            String source = read(file);
            Matcher t = TABLE.matcher(source);
            if (!t.find()) continue;

            Set<String> columns = new HashSet<>();
            Matcher f = ANNOTATED_FIELD.matcher(source);
            while (f.find()) {
                String annotations = f.group(1);
                if (NOT_A_COLUMN.matcher(annotations).find()) continue;

                Matcher named = EXPLICIT_NAME.matcher(annotations);
                // 이름을 명시했으면 그 이름만이 칼럼이다. 자바 필드명은 칼럼명이 아니다.
                columns.add(named.find() ? named.group(1).toLowerCase() : snake(f.group(2)));
            }

            schema.put(t.group(1).toLowerCase(), columns);
        }
        return schema;
    }

    /**
     * {@code @Query(value = "...", nativeQuery = true)} 의 SQL 본문만.
     *
     * <p><b>주석은 걷어낸다.</b> {@code @Query} 안에 설명 주석이 함께 있는 경우가 흔한데, 그 주석에 예전에 틀렸던 SQL 을 인용해 두기도 한다
     * (예: "p.id 로 적었다가 죽었다"). 주석까지 훑으면 <b>고쳐 놓은 코드가 자기 경고문 때문에 실패한다.</b>
     */
    private static List<String> nativeQueries(String source) {
        List<String> found = new ArrayList<>();
        for (int at = source.indexOf("nativeQuery = true"); at >= 0; ) {
            int start = source.lastIndexOf("@Query", at);
            if (start >= 0) found.add(stripComments(source.substring(start, at)));
            at = source.indexOf("nativeQuery = true", at + 1);
        }
        return found;
    }

    private static String stripComments(String java) {
        return java.replaceAll("(?s)/\\*.*?\\*/", " ").replaceAll("(?m)//[^\n]*", " ");
    }

    private static Map<String, String> aliasToTable(String sql) {
        Map<String, String> aliases = new HashMap<>();
        Matcher m = ALIAS.matcher(sql);
        while (m.find()) {
            String alias = m.group(2).toLowerCase();
            if (!NOT_ALIASES.contains(alias)) aliases.put(alias, m.group(1).toLowerCase());
        }
        return aliases;
    }

    private static String snake(String camel) {
        return camel.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
    }

    private static List<Path> javaFiles(Path dir) {
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> walk = Files.walk(dir)) {
            return walk.filter(p -> p.toString().endsWith(".java")).toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Path findSourceRoot() {
        Path dir = Path.of("").toAbsolutePath();
        for (int depth = 0; depth < 6 && dir != null; depth++, dir = dir.getParent()) {
            Path candidate = dir.resolve("src/main/java/com/example/popspotbackend");
            if (Files.isDirectory(candidate)) return candidate;
            Path inModule = dir.resolve("popspot-backend/src/main/java/com/example/popspotbackend");
            if (Files.isDirectory(inModule)) return inModule;
        }
        throw new IllegalStateException("백엔드 소스 루트를 찾지 못했습니다.");
    }
}
