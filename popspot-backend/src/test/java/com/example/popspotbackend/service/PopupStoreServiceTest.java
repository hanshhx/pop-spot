package com.example.popspotbackend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.PopupStoreRepository;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PopupStoreServiceTest {

    @Mock private PopupStoreRepository popupStoreRepository;

    @Test
    @DisplayName("공개 팝업 상세 열람은 DB에서 원자적으로 조회수를 올리고 최신 값을 반환한다")
    void getPopupById_incrementsViewCountAtomically() {
        long id = 42L;
        PopupStore before =
                PopupStore.builder()
                        .id(id)
                        .name("테스트 팝업")
                        .status("OPEN")
                        .reviewStatus("APPROVED")
                        .viewCount(9)
                        .build();
        PopupStore after =
                PopupStore.builder()
                        .id(id)
                        .name("테스트 팝업")
                        .status("OPEN")
                        .reviewStatus("APPROVED")
                        .viewCount(10)
                        .build();
        when(popupStoreRepository.findById(id)).thenReturn(Optional.of(before), Optional.of(after));
        when(popupStoreRepository.incrementViewCount(id)).thenReturn(1);

        PopupStore result = new PopupStoreService(popupStoreRepository).getPopupById(id);

        assertThat(result.getViewCount()).isEqualTo(10);
        verify(popupStoreRepository).incrementViewCount(id);
    }

    @Test
    @DisplayName("공개할 수 없는 팝업은 조회수를 올리지 않고 404로 숨긴다")
    void getPopupById_hiddenPopupDoesNotIncrement() {
        long id = 43L;
        PopupStore hidden =
                PopupStore.builder()
                        .id(id)
                        .name("내려간 팝업")
                        .status("OPEN")
                        .reviewStatus("TAKEDOWN")
                        .viewCount(3)
                        .build();
        when(popupStoreRepository.findById(id)).thenReturn(Optional.of(hidden));

        assertThatThrownBy(() -> new PopupStoreService(popupStoreRepository).getPopupById(id))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(popupStoreRepository, never()).incrementViewCount(id);
    }

    @Test
    @DisplayName("사용자 제보 승인은 상태와 검수 상태를 함께 공개 가능 값으로 바꾼다")
    void approveReview_promotesPendingUserReportAtomically() {
        long id = 44L;
        PopupStore pending =
                PopupStore.builder()
                        .id(id)
                        .name("사용자 제보 팝업")
                        .status("PENDING")
                        .reviewStatus("PENDING_REVIEW")
                        .build();
        when(popupStoreRepository.findById(id)).thenReturn(Optional.of(pending));
        when(popupStoreRepository.save(pending)).thenReturn(pending);

        PopupStore approved = new PopupStoreService(popupStoreRepository).approveReview(id);

        assertThat(approved.getStatus()).isEqualTo("영업중");
        assertThat(approved.getReviewStatus()).isEqualTo("APPROVED");
        verify(popupStoreRepository).save(pending);
    }

    @Test
    @DisplayName("반려는 팝업을 삭제하지 않고 검수 이력을 보존한다")
    void rejectReview_preservesRowForAudit() {
        long id = 45L;
        PopupStore pending =
                PopupStore.builder()
                        .id(id)
                        .name("반려할 팝업")
                        .status("PENDING")
                        .reviewStatus("PENDING_REVIEW")
                        .build();
        when(popupStoreRepository.findById(id)).thenReturn(Optional.of(pending));
        when(popupStoreRepository.save(pending)).thenReturn(pending);

        PopupStore rejected = new PopupStoreService(popupStoreRepository).rejectReview(id);

        assertThat(rejected.getReviewStatus()).isEqualTo("REJECTED");
        verify(popupStoreRepository).save(pending);
        verify(popupStoreRepository, never()).delete(pending);
    }
}
