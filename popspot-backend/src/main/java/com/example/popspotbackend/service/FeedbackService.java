package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.FeedbackCreateRequestDto;
import com.example.popspotbackend.dto.FeedbackReplyRequestDto;
import com.example.popspotbackend.dto.FeedbackResponseDto;
import com.example.popspotbackend.entity.Feedback;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.FeedbackRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 의견 보내기 도메인 로직.
 *
 * <p>컨트롤러는 인증 정보 추출 + URL 매핑만 담당하고, 카테고리/상태 화이트리스트 검증과 영속화는 모두 본 서비스가 처리한다. 비로그인 사용자도 작성할 수 있으므로
 * {@code userId} 는 nullable.
 */
@Service
@Transactional(readOnly = true)
public class FeedbackService {

    /**
     * 화면이 보내올 수 있는 종류.
     *
     * <p><b>프론트의 {@code FeedbackCategory} 와 반드시 같아야 한다.</b> 한쪽만 늘리면 사용자에게는 "제보가 안 됨" 으로만 보이고, 서버
     * 로그를 열기 전에는 원인이 드러나지 않는다. 언어가 달라 컴파일러가 못 묶어 주는 자리라 검사로 묶어 둔다.
     *
     * <p>{@code PARTNERSHIP} 은 브랜드·기관이 팝업 등록이나 소개를 요청하는 자리다. 전용 화면을 새로 만들지 않은 것은, 제휴 건수가 아직 한 건이라
     * 폼·저장·관리자 확인을 새로 짓는 값이 없기 때문이다 — 여기에 이미 셋 다 있다.
     */
    private static final Set<String> ALLOWED_CATEGORIES =
            Set.of("BUG", "FEATURE", "GOOD", "PARTNERSHIP", "OTHER");

    private static final Set<String> ALLOWED_STATUSES =
            Set.of("PENDING", "REVIEWING", "RESOLVED", "WONT_FIX");
    private static final String STATUS_RESOLVED = "RESOLVED";
    private static final int DEFAULT_PAGE_SIZE = 50;

    private final FeedbackRepository feedbackRepository;

    public FeedbackService(FeedbackRepository feedbackRepository) {
        this.feedbackRepository = feedbackRepository;
    }

    /** 새 의견 저장. userId 가 null 이면 게스트 작성으로 처리하고, 이때는 guestEmail 형식만 (DTO 단에서) 검증한 뒤 그대로 보관. */
    @Transactional
    public FeedbackResponseDto submit(FeedbackCreateRequestDto dto, String userId) {
        requireCategory(dto.getCategory());

        Feedback saved =
                feedbackRepository.save(
                        Feedback.builder()
                                .userId(userId)
                                .guestEmail(emptyToNull(dto.getGuestEmail()))
                                .category(dto.getCategory())
                                .title(dto.getTitle())
                                .content(dto.getContent())
                                .build());
        return FeedbackResponseDto.fromEntity(saved);
    }

    /** 본인이 보낸 의견 목록 (최신순). */
    public List<FeedbackResponseDto> findMine(String userId) {
        return feedbackRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(FeedbackResponseDto::fromEntity)
                .toList();
    }

    /** 어드민 검수 큐. status 가 null 이면 전체, 값이 있으면 화이트리스트 검증 후 필터. */
    public List<FeedbackResponseDto> findForAdmin(String status, int page, int size) {
        String normalized = normalizeStatusFilter(status);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.max(size, 1));
        return feedbackRepository.findForAdmin(normalized, pageable).stream()
                .map(FeedbackResponseDto::fromEntity)
                .toList();
    }

    /** 어드민 대시보드 메트릭 카드용 — 상태별 카운트. */
    public Map<String, Long> countByStatus() {
        return Map.of(
                "PENDING", feedbackRepository.countByStatus("PENDING"),
                "REVIEWING", feedbackRepository.countByStatus("REVIEWING"),
                "RESOLVED", feedbackRepository.countByStatus("RESOLVED"),
                "WONT_FIX", feedbackRepository.countByStatus("WONT_FIX"));
    }

    /** 어드민 답변 + 상태 변경. 답변이 채워졌으면 repliedAt 도 함께 갱신. */
    @Transactional
    public FeedbackResponseDto reply(Long id, FeedbackReplyRequestDto dto) {
        Feedback feedback =
                feedbackRepository
                        .findById(id)
                        .orElseThrow(
                                () -> new ResourceNotFoundException("Feedback not found: " + id));

        requireStatus(dto.getStatus());
        feedback.setStatus(dto.getStatus());

        String reply = emptyToNull(dto.getAdminReply());
        if (reply != null) {
            feedback.setAdminReply(reply);
            feedback.setRepliedAt(LocalDateTime.now());
        } else if (STATUS_RESOLVED.equals(dto.getStatus()) && feedback.getRepliedAt() == null) {
            feedback.setRepliedAt(LocalDateTime.now());
        }
        return FeedbackResponseDto.fromEntity(feedback);
    }

    /** 어드민 영구 삭제. 스팸/욕설/중복 의견 정리용. */
    @Transactional
    public void deleteById(Long id) {
        if (!feedbackRepository.existsById(id)) {
            throw new ResourceNotFoundException("Feedback not found: " + id);
        }
        feedbackRepository.deleteById(id);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private void requireCategory(String category) {
        if (!ALLOWED_CATEGORIES.contains(category)) {
            throw new IllegalArgumentException("허용되지 않은 카테고리: " + category);
        }
    }

    private void requireStatus(String status) {
        if (!ALLOWED_STATUSES.contains(status)) {
            throw new IllegalArgumentException("허용되지 않은 상태: " + status);
        }
    }

    private String normalizeStatusFilter(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        requireStatus(status);
        return status;
    }

    private String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    /** 외부에서 페이지 사이즈 기본값을 노출해야 하는 경우를 대비한 상수 게터. */
    public static int defaultPageSize() {
        return DEFAULT_PAGE_SIZE;
    }
}
