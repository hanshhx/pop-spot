package com.example.popspotbackend.service;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.repository.VisitEventRepository;
import com.example.popspotbackend.repository.VisitLogRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class VisitServiceTest {

    @Mock private VisitLogRepository visitLogRepository;
    @Mock private VisitEventRepository visitEventRepository;

    @Test
    void 개인정보처리방침에_맞춰_90일_이전_방문로그를_삭제한다() {
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);
        ReflectionTestUtils.setField(service, "retentionDays", 90);
        LocalDateTime before = LocalDateTime.now().minusDays(90).minusSeconds(2);
        LocalDateTime after = LocalDateTime.now().minusDays(90).plusSeconds(2);
        when(visitLogRepository.deleteByCreatedAtBefore(org.mockito.ArgumentMatchers.any()))
                .thenReturn(3);

        service.deleteExpiredVisitLogs();

        verify(visitLogRepository)
                .deleteByCreatedAtBefore(
                        argThat(cutoff -> cutoff.isAfter(before) && cutoff.isBefore(after)));
    }

    @Test
    void 행동_기록도_같은_기준으로_함께_지운다() {
        // 따로 두면 한쪽만 정리돼 방침의 90일 약속이 반만 지켜진다.
        // 그 어긋남은 아무 데도 드러나지 않아서, 테스트로 묶어 둔다.
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);
        ReflectionTestUtils.setField(service, "retentionDays", 90);
        LocalDateTime before = LocalDateTime.now().minusDays(90).minusSeconds(2);
        LocalDateTime after = LocalDateTime.now().minusDays(90).plusSeconds(2);

        service.deleteExpiredVisitLogs();

        verify(visitEventRepository)
                .deleteOlderThan(
                        argThat(cutoff -> cutoff.isAfter(before) && cutoff.isBefore(after)));
    }

    @Test
    void 목록에_없는_행동_종류는_저장하지_않는다() {
        // 클라이언트가 보낸 값이라 무엇이든 올 수 있다. 그대로 저장하면 오타가 새 종류로 쌓여
        // 집계가 갈라지고, 예상 못 한 값이 DB 에 들어간다.
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);

        service.recordEvent("visitor-1", "session-1", "아무거나", 1L, "/", true);
        service.recordEvent("visitor-1", "session-1", null, 1L, "/", true);

        verify(visitEventRepository, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void 방문자_식별자가_없으면_저장하지_않는다() {
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);

        service.recordEvent(null, "session-1", "popup_open", 1L, "/", true);
        service.recordEvent("  ", "session-1", "popup_open", 1L, "/", true);

        verify(visitEventRepository, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void UTM_은_허용_문자만_남기고_저장한다() {
        // 이 값은 사용자가 주소창으로 보내는 것이다. 그대로 저장하면 집계 화면에 임의의
        // 문자열이 뜨고, 같은 캠페인이 표기 차이로 여러 줄로 갈라진다.
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);

        service.record(
                "visitor-1",
                "/",
                true,
                "Mozilla/5.0",
                null,
                "  InstaGram  ",
                "post<script>",
                "여름_팝업");

        verify(visitLogRepository)
                .save(
                        argThat(
                                v ->
                                        "instagram".equals(v.getUtmSource())
                                                && "postscript".equals(v.getUtmMedium())
                                                // 한글은 허용 문자가 아니라 통째로 걸러지고,
                                                // 남는 것이 없으면 '없음' 으로 둔다 —
                                                // 빈 문자열을 저장하면 집계에 이름 없는 줄이 생긴다.
                                                && v.getUtmCampaign() == null));
    }

    @Test
    void UTM_이_없으면_비워_둔다() {
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);

        service.record("visitor-1", "/", true, "Mozilla/5.0", null, null, null, null);

        verify(visitLogRepository)
                .save(argThat(v -> v.getUtmSource() == null && v.getUtmMedium() == null));
    }

    @Test
    void 허용된_종류는_저장한다() {
        VisitService service = new VisitService(visitLogRepository, visitEventRepository);

        service.recordEvent("visitor-1", "session-1", "popup_open", 42L, "/", true);

        verify(visitEventRepository).save(argThat(e -> e.getPopupId() == 42L));
    }
}
