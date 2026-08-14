package com.example.popspotbackend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.dto.PopupReportRequestDto;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.service.PopupStoreService;
import com.example.popspotbackend.service.sla.TakedownNotifier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class PopupStoreControllerReportTest {

    @Mock private PopupStoreService popupStoreService;
    @Mock private YouTubeService youTubeService;
    @Mock private TakedownNotifier takedownNotifier;
    @Mock private Authentication authentication;
    @InjectMocks private PopupStoreController controller;

    @Test
    void keepsEvidenceAndUsesAuthenticatedUserAsReporter() {
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn("member-123");
        when(popupStoreService.save(any(PopupStore.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PopupReportRequestDto request = request();
        controller.reportPopup(request, authentication);

        ArgumentCaptor<PopupStore> saved = ArgumentCaptor.forClass(PopupStore.class);
        verify(popupStoreService).save(saved.capture());
        assertThat(saved.getValue().getAddress()).isEqualTo("서울 성동구 연무장길 1");
        assertThat(saved.getValue().getSourceType()).isEqualTo("USER_REPORT");
        assertThat(saved.getValue().getSourceUrl())
                .isEqualTo("https://official.example.com/notice/1");
        assertThat(saved.getValue().getReviewStatus()).isEqualTo("PENDING_REVIEW");
        assertThat(saved.getValue().getReporterId()).isEqualTo("member-123");
    }

    @Test
    void guestReportDoesNotInventReporterId() {
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authentication.getName()).thenReturn("anonymousUser");
        when(popupStoreService.save(any(PopupStore.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        controller.reportPopup(request(), authentication);

        ArgumentCaptor<PopupStore> saved = ArgumentCaptor.forClass(PopupStore.class);
        verify(popupStoreService).save(saved.capture());
        assertThat(saved.getValue().getReporterId()).isNull();
    }

    private PopupReportRequestDto request() {
        PopupReportRequestDto request = new PopupReportRequestDto();
        request.setName("테스트 팝업");
        request.setLocation("성수");
        request.setAddress("서울 성동구 연무장길 1");
        request.setStartDate("2026-08-14");
        request.setEndDate("2026-08-31");
        request.setSourceUrl("https://official.example.com/notice/1");
        return request;
    }
}
