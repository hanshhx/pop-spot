package com.example.popspotbackend.service.crawler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.CrawlCursor;
import com.example.popspotbackend.repository.CrawlCursorRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 키워드 순회 커서 회귀 테스트.
 *
 * <p>이 커서가 존재하는 이유: TPM 8000 제약으로 크롤은 회차마다 앞쪽 키워드 몇 개만 처리하고 멈춘다. 커서가 없으면 다음 회차도 같은 앞부분부터 시작해 뒤쪽
 * 키워드가 영영 LLM 에 도달하지 못했다(390개 중 앞 5개만 반복). 커서가 회차마다 전진해 전체를 순회하는 게 핵심이므로, 순환·경계·무동작 조건을 고정한다.
 *
 * <p>실제 저장을 흉내 내는 in-memory 맵을 mock 에 물려, 여러 번 전진했을 때의 누적·wrap 을 검증한다.
 */
class CrawlCursorServiceTest {

    private static final int TOTAL = 390;

    private Map<Integer, CrawlCursor> store;
    private CrawlCursorService service;

    @BeforeEach
    void setUp() {
        store = new HashMap<>();
        CrawlCursorRepository repository = mock(CrawlCursorRepository.class);
        when(repository.findById(CrawlCursor.SINGLETON_ID))
                .thenAnswer(inv -> Optional.ofNullable(store.get(CrawlCursor.SINGLETON_ID)));
        when(repository.save(any(CrawlCursor.class)))
                .thenAnswer(
                        inv -> {
                            CrawlCursor saved = inv.getArgument(0);
                            store.put(saved.getId(), saved);
                            return saved;
                        });
        service = new CrawlCursorService(repository);
    }

    @Test
    @DisplayName("저장된 커서가 없으면 0 에서 시작한다")
    void 초기값은_0() {
        assertThat(service.currentCursor(TOTAL)).isZero();
    }

    @Test
    @DisplayName("담당한 키워드 수만큼 전진한다")
    void 담당한_만큼_전진() {
        service.advance(20, TOTAL);
        assertThat(service.currentCursor(TOTAL)).isEqualTo(20);
    }

    @Test
    @DisplayName("끝에 닿으면 처음으로 돌아온다 — 전체를 순회하려면 wrap 이 필수")
    void 끝에서_순환() {
        for (int i = 0; i < 19; i++) service.advance(20, TOTAL); // 380 까지
        assertThat(service.currentCursor(TOTAL)).isEqualTo(380);

        service.advance(20, TOTAL); // 400 % 390 = 10
        assertThat(service.currentCursor(TOTAL)).isEqualTo(10);
    }

    @Test
    @DisplayName("처리한 키워드가 0 이면 커서를 움직이지 않는다 — rate limit 으로 한 개도 못 한 날 헛돌지 않게")
    void 처리_0은_무동작() {
        service.advance(30, TOTAL);
        service.advance(0, TOTAL);
        assertThat(service.currentCursor(TOTAL)).isEqualTo(30);
    }

    @Test
    @DisplayName("키워드 목록이 줄어 커서가 범위를 넘으면 모듈로로 접는다 — 저장값이 total 보다 커도 안전")
    void 목록_축소_방어() {
        service.advance(100, TOTAL); // 커서 100 저장
        assertThat(service.currentCursor(50)).isZero(); // 100 % 50 = 0
    }

    @Test
    @DisplayName("키워드가 하나도 없어도 터지지 않는다")
    void 키워드_0_방어() {
        assertThat(service.currentCursor(0)).isZero();
        service.advance(10, 0); // no-op, 예외 없음
        assertThat(service.currentCursor(TOTAL)).isZero();
    }
}
