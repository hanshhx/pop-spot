package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.AdminUserDto;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 운영 로직 — 팝업 승인 / 거절 / 상태 변경, 메이트 게시글 강제 삭제, 대시보드 통계.
 *
 * <p>v2.53 — 보상 지급(수동 · 제보 승인 자동)을 걷어냈다. 서비스에서 보상 제도를 접었는데 관리자 쪽 지급 경로만 남아 있었다. 확성기·POP-PASS 자체는
 * 결제로 살아 있다(OrderService) — 여기서 지운 것은 <b>관리자가 공짜로 주던 경로</b>뿐이다.
 *
 * <p>상태 코드는 한글 "영업중" / "PENDING" / "EXPIRED" 등으로 운영자가 직접 보는 값을 그대로 쓴다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private static final String STATUS_OPEN = "영업중";
    private static final String STATUS_PENDING = "PENDING";

    private final PopupStoreRepository popupStoreRepository;
    private final UserRepository userRepository;
    private final MatePostRepository matePostRepository;

    /* ============================== 팝업 승인 / 상태 변경 ============================== */

    @Transactional(readOnly = true)
    public List<PopupStore> findPendingPopups() {
        return popupStoreRepository.findByStatus(STATUS_PENDING);
    }

    /** 관리자는 PENDING / 영업중 / 종료 구분 없이 모든 팝업을 본다. */
    @Transactional(readOnly = true)
    public List<PopupStore> findAllPopups() {
        return popupStoreRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<MatePost> findAllMatePostsOrdered() {
        return matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc();
    }

    /** v2.27 — 회원 목록(가입 최신순). 비밀번호 제외 DTO 로 변환. */
    @Transactional(readOnly = true)
    public List<AdminUserDto> findAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(AdminUserDto::from)
                .toList();
    }

    /**
     * 제보된 팝업 승인 — 상태를 "영업중" 으로 바꾼다.
     *
     * <p>예전에는 제보자에게 확성기 1개를 자동 지급했다. 서비스에서 보상 제도를 접으면서 지웠다. 제보 화면은 애초에 보상을 약속하지
     * 않으므로(ReportPopupModal) 사용자와의 약속이 깨지지 않는다. {@code reporterId} 는 남긴다 — 누가 제보했는지는 검수에 필요하다.
     */
    @Transactional
    public void approvePopup(Long popupId) {
        findPopupOrThrow(popupId).setStatus(STATUS_OPEN);
    }

    @Transactional
    public void rejectPopup(Long popupId) {
        popupStoreRepository.deleteById(popupId);
    }

    @Transactional
    public void changePopupStatus(Long popupId, String newStatus) {
        findPopupOrThrow(popupId).setStatus(newStatus);
    }

    /* ============================== 메이트 운영 ============================== */

    @Transactional
    public void forceDeleteMatePost(Long postId) {
        matePostRepository.deleteById(postId);
    }

    /* ============================== 대시보드 통계 ============================== */

    /** 카운트 쿼리만 사용해 N+1 / 전체 조회 부하 없이 통계를 계산한다. */
    @Transactional(readOnly = true)
    public Map<String, Object> getAdminStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("activePopups", popupStoreRepository.countByStatus(STATUS_OPEN));
        stats.put("totalMatePosts", matePostRepository.count());
        stats.put("pendingPopups", popupStoreRepository.countByStatus(STATUS_PENDING));
        return stats;
    }

    /* ============================== 내부 헬퍼 ============================== */

    private PopupStore findPopupOrThrow(Long popupId) {
        return popupStoreRepository
                .findById(popupId)
                .orElseThrow(() -> ResourceNotFoundException.popup(popupId));
    }
}
