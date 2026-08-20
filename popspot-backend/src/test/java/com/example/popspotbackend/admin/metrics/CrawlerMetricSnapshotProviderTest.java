package com.example.popspotbackend.admin.metrics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.repository.PopupStoreRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CrawlerMetricSnapshotProviderTest {

    @Mock private PopupStoreRepository popupStoreRepository;

    @InjectMocks private CrawlerMetricSnapshotProvider provider;

    @BeforeEach
    void setUp() {
        when(popupStoreRepository.countCrawledSince(any())).thenReturn(3L);
        when(popupStoreRepository.averageConfidenceSince(any())).thenReturn(new BigDecimal("0.91"));
        when(popupStoreRepository.countPendingReview()).thenReturn(2L);
    }

    @Test
    void exposesWhenGlobalOrCrawlerSwitchIsOff() {
        ReflectionTestUtils.setField(provider, "schedulingEnabled", false);
        ReflectionTestUtils.setField(provider, "crawlerEnabled", true);
        when(popupStoreRepository.findLatestCrawledAt())
                .thenReturn(LocalDateTime.now().minusHours(1));

        Map<String, Object> snapshot = provider.snapshot();

        assertThat(snapshot)
                .containsEntry("schedulingEnabled", false)
                .containsEntry("crawlerEnabled", true)
                .containsEntry("automationEnabled", false)
                .containsEntry("newPopupDataStale", false);
    }

    @Test
    void warnsWhenNoNewCrawledPopupWasSavedForThirtySixHours() {
        ReflectionTestUtils.setField(provider, "schedulingEnabled", true);
        ReflectionTestUtils.setField(provider, "crawlerEnabled", true);
        when(popupStoreRepository.findLatestCrawledAt())
                .thenReturn(LocalDateTime.now().minusHours(40));

        Map<String, Object> snapshot = provider.snapshot();

        assertThat(snapshot)
                .containsEntry("automationEnabled", true)
                .containsEntry("newPopupDataStale", true);
        assertThat(snapshot.get("lastNewPopupAt")).isInstanceOf(String.class);
    }
}
