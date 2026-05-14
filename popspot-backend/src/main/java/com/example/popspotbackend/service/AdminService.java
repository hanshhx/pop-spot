package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자 운영 로직 — 팝업 승인 / 거절 / 상태 변경, 이벤트 보상 지급, 메이트 게시글 강제 삭제, 대시보드 통계.
 *
 * <p>상태 코드는 한글 "영업중" / "PENDING" / "EXPIRED" 등으로 운영자가 직접 보는 값을 그대로 쓴다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private static final String STATUS_OPEN = "영업중";
    private static final String STATUS_PENDING = "PENDING";

    private static final String ITEM_MEGAPHONE = "MEGAPHONE";
    private static final String ITEM_POPPASS = "POPPASS";

    private final PopupStoreRepository popupStoreRepository;
    private final UserRepository userRepository;
    private final MatePostRepository matePostRepository;

    /* ============================== 팝업 승인 / 상태 변경 ============================== */

    /** 제보된 팝업 승인 — 상태를 "영업중" 으로 바꾸고 신고자에게 확성기 1개를 보상으로 지급. */
    @Transactional
    public void approvePopup(Long popupId) {
        PopupStore popup = findPopupOrThrow(popupId);
        popup.setStatus(STATUS_OPEN);
        rewardReporterIfPresent(popup);
    }

    @Transactional
    public void rejectPopup(Long popupId) {
        popupStoreRepository.deleteById(popupId);
    }

    @Transactional
    public void changePopupStatus(Long popupId, String newStatus) {
        findPopupOrThrow(popupId).setStatus(newStatus);
    }

    /* ============================== 보상 / 메이트 운영 ============================== */

    /** {@code MEGAPHONE} 또는 {@code POPPASS} 를 닉네임으로 식별된 유저에게 직접 지급. */
    @Transactional
    public void giveReward(String nickname, String itemType, int amount) {
        User user =
                userRepository
                        .findByNickname(nickname)
                        .orElseThrow(() -> new RuntimeException("해당 닉네임의 유저를 찾을 수 없습니다."));

        if (ITEM_MEGAPHONE.equalsIgnoreCase(itemType)) {
            user.addMegaphone(amount);
            log.info("[Admin] {}님에게 확성기 {}개 지급", nickname, amount);
        } else if (ITEM_POPPASS.equalsIgnoreCase(itemType)) {
            user.extendPremium(amount);
            log.info("[Admin] {}님에게 POP-PASS {}일권 지급", nickname, amount);
        } else {
            throw new IllegalArgumentException("알 수 없는 아이템 타입입니다.");
        }
    }

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
                .orElseThrow(() -> new RuntimeException("존재하지 않는 팝업입니다."));
    }

    private void rewardReporterIfPresent(PopupStore popup) {
        if (popup.getReporterId() == null) return;
        userRepository
                .findById(popup.getReporterId())
                .ifPresent(
                        user -> {
                            user.addMegaphone(1);
                            userRepository.save(user);
                            log.info("[Admin] 신고자 {}님에게 확성기 1개 보상 지급", user.getNickname());
                        });
    }
}
