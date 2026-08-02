package com.example.popspotbackend.service.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 복구 코드 — <b>폰을 잃었을 때 유일한 입구</b>다.
 *
 * <p>관리자가 한 명뿐이라 "다른 관리자에게 부탁" 같은 우회로가 없다. 여기가 틀리면 영구 잠금이고, 그때는 고칠 수 있는 화면에도 못 들어간다. 그래서 정상 경로보다
 * <b>사람이 실수하는 입력</b>을 더 촘촘히 본다.
 */
class RecoveryCodeServiceTest {

    private final RecoveryCodeService codes = new RecoveryCodeService();

    @Test
    @DisplayName("10개를 발급하고 원문은 서로 다르다")
    void issuesTenDistinctCodes() {
        RecoveryCodeService.Issued issued = codes.issue();

        assertThat(issued.plainCodes()).hasSize(10);
        assertThat(new HashSet<>(issued.plainCodes())).hasSize(10);
        assertThat(codes.remaining(issued.storedHashes())).isEqualTo(10);
    }

    @Test
    @DisplayName("저장하는 값에 원문이 들어 있지 않다 — 해시만 남아야 한다")
    void storesOnlyHashes() {
        RecoveryCodeService.Issued issued = codes.issue();

        for (String plain : issued.plainCodes()) {
            assertThat(issued.storedHashes()).doesNotContain(plain);
        }
    }

    @Test
    @DisplayName("맞는 코드를 쓰면 그 코드만 사라진다")
    void consumesOneCode() {
        RecoveryCodeService.Issued issued = codes.issue();
        String first = issued.plainCodes().get(0);

        String after = codes.consume(issued.storedHashes(), first);

        assertThat(after).isNotNull();
        assertThat(codes.remaining(after)).isEqualTo(9);
    }

    @Test
    @DisplayName("같은 코드를 두 번 쓸 수 없다 — 일회용이 아니면 의미가 없다")
    void codeCannotBeReused() {
        RecoveryCodeService.Issued issued = codes.issue();
        String first = issued.plainCodes().get(0);

        String after = codes.consume(issued.storedHashes(), first);

        assertThat(codes.consume(after, first)).describedAs("두 번째 사용은 거부").isNull();
    }

    @Test
    @DisplayName("나머지 코드는 그대로 쓸 수 있다")
    void otherCodesStillWork() {
        RecoveryCodeService.Issued issued = codes.issue();
        String after = codes.consume(issued.storedHashes(), issued.plainCodes().get(0));

        assertThat(codes.consume(after, issued.plainCodes().get(1))).isNotNull();
    }

    @Test
    @DisplayName("소문자·하이픈 없음·공백 섞임 모두 받아들인다 — 급할 때 손으로 치는 값이다")
    void acceptsMessyInput() {
        RecoveryCodeService.Issued issued = codes.issue();
        String code = issued.plainCodes().get(0);

        assertThat(codes.consume(issued.storedHashes(), code.toLowerCase())).isNotNull();
        assertThat(codes.consume(issued.storedHashes(), code.replace("-", ""))).isNotNull();
        assertThat(codes.consume(issued.storedHashes(), "  " + code + "  ")).isNotNull();
        assertThat(codes.consume(issued.storedHashes(), code.replace("-", " "))).isNotNull();
    }

    @Test
    @DisplayName("헷갈리는 글자를 쓰지 않는다 — 0/O, 1/I/L 을 잘못 읽으면 입구가 막힌다")
    void avoidsAmbiguousCharacters() {
        Set<Character> banned = Set.of('0', 'O', '1', 'I', 'L');

        for (int attempt = 0; attempt < 20; attempt++) {
            for (String code : codes.issue().plainCodes()) {
                for (char c : code.toCharArray()) {
                    if (c == '-') continue;
                    assertThat(banned).describedAs("코드 %s", code).doesNotContain(c);
                }
            }
        }
    }

    @Test
    @DisplayName("틀린 코드·빈 값은 거부하고 남은 코드를 건드리지 않는다")
    void rejectsWrongInput() {
        RecoveryCodeService.Issued issued = codes.issue();

        assertThat(codes.consume(issued.storedHashes(), "ZZZZZ-ZZZZZ")).isNull();
        assertThat(codes.consume(issued.storedHashes(), "")).isNull();
        assertThat(codes.consume(issued.storedHashes(), null)).isNull();
        assertThat(codes.consume(null, "ZZZZZ-ZZZZZ")).isNull();
        assertThat(codes.remaining(issued.storedHashes())).describedAs("남은 개수 그대로").isEqualTo(10);
    }

    @Test
    @DisplayName("마지막 코드까지 쓰면 0개가 된다")
    void canExhaustAllCodes() {
        RecoveryCodeService.Issued issued = codes.issue();
        String stored = issued.storedHashes();

        for (String code : issued.plainCodes()) {
            stored = codes.consume(stored, code);
            assertThat(stored).describedAs("코드 %s 사용 실패", code).isNotNull();
        }
        assertThat(codes.remaining(stored)).isZero();
    }
}
