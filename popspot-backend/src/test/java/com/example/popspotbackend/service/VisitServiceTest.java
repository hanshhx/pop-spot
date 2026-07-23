package com.example.popspotbackend.service;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void 개인정보처리방침에_맞춰_90일_이전_방문로그를_삭제한다() {
        VisitService service = new VisitService(visitLogRepository);
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
}
