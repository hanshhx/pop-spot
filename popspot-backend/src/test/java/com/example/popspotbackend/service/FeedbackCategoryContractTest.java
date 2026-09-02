package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.dto.FeedbackCreateRequestDto;
import com.example.popspotbackend.repository.FeedbackRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 화면이 보내는 의견 종류와 서버가 받는 종류가 <b>같은지</b> 지킨다.
 *
 * <p><b>왜 필요한가.</b> 목록이 타입스크립트와 자바에 나뉘어 있어 컴파일러가 못 묶어 준다. 한쪽만 늘리면 사용자에게는 "보내기를 눌렀는데 안 됨" 으로만 보이고,
 * 서버 로그를 열기 전에는 원인이 드러나지 않는다.
 *
 * <p>목록이 바뀌면 여기와 {@code popspot-frontend/src/types/feedback.ts} 를 <b>같이</b> 고쳐야 한다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FeedbackCategoryContractTest {

    @Mock private FeedbackRepository feedbackRepository;

    private FeedbackService service;

    /** 프론트 {@code FeedbackCategory} union 과 글자까지 같아야 한다. */
    private static final List<String> 화면이_보내는_종류 =
            List.of("BUG", "FEATURE", "GOOD", "PARTNERSHIP", "OTHER");

    @BeforeEach
    void setUp() {
        when(feedbackRepository.save(any())).thenAnswer(call -> call.getArgument(0));
        service = new FeedbackService(feedbackRepository);
    }

    private static FeedbackCreateRequestDto 요청(String category) {
        FeedbackCreateRequestDto dto = new FeedbackCreateRequestDto();
        dto.setCategory(category);
        dto.setTitle("제목");
        dto.setContent("내용");
        return dto;
    }

    @Test
    @DisplayName("화면이 보내는 종류를 서버가 모두 받는다")
    void 모든_종류를_받는다() {
        for (String category : 화면이_보내는_종류) {
            assertThat(카테고리로_거절됐나(category)).as("화면에 있는 종류인데 서버가 거절한다: %s", category).isFalse();
        }
    }

    /* 화이트리스트가 화이트리스트로 남아 있어야 한다 — 아무 값이나 받으면 오타가 새 종류로 쌓여 집계가 갈라진다. */
    @Test
    @DisplayName("목록에 없는 종류는 거절한다")
    void 모르는_종류는_거절한다() {
        assertThatThrownBy(() -> service.submit(요청("PARTNER"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("카테고리");
        assertThatThrownBy(() -> service.submit(요청("아무거나"), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * 카테고리 때문에 막혔는지만 본다.
     *
     * <p>저장·응답 변환 단계에서 나는 다른 문제는 이 검사의 관심이 아니다. 그것까지 실패로 세면 검사가 무엇을 지키는지 흐려진다.
     */
    private boolean 카테고리로_거절됐나(String category) {
        try {
            service.submit(요청(category), null);
            return false;
        } catch (IllegalArgumentException e) {
            return String.valueOf(e.getMessage()).contains("카테고리");
        } catch (RuntimeException e) {
            return false;
        }
    }
}
