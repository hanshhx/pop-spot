package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.Stamp;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팝업 방문 스탬프 적립 + 보상 지급.
 *
 * <p>어뷰징 방어 두 단계: (1) 하루 1회 — KST 기준 오늘 다른 곳에서 이미 찍었으면 거부, (2) 평생 1회 — 동일 팝업 재인증 거부. 누적 스탬프가 3의 배수가
 * 될 때마다 확성기 1개를 자동 지급.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StampService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int MEGAPHONE_REWARD_INTERVAL = 3;

    private final StampRepository stampRepository;
    private final PopupStoreRepository popupStoreRepository;
    private final UserRepository userRepository;

    @Transactional
    public void addStamp(String userId, Long popupId) {
        rejectIfAlreadyStampedToday(userId);
        rejectIfDuplicatePopup(userId, popupId);

        PopupStore popup = findPopupOrThrow(popupId);
        User user = findUserOrThrow(userId);

        stampRepository.save(Stamp.builder().userId(userId).popupStore(popup).build());
        grantStampReward(user, userId);

        log.info("[Stamp] 발급 성공 userId={} popupId={}", userId, popupId);
    }

    public List<Stamp> getMyStamps(String userId) {
        return stampRepository.findAllByUserId(userId);
    }

    /* ============================== 방어 / 보상 ============================== */

    private void rejectIfAlreadyStampedToday(String userId) {
        LocalDate today = LocalDate.now(KST);
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        if (stampRepository.existsByUserIdAndStampDateBetween(userId, startOfDay, endOfDay)) {
            log.warn("[Stamp] 어뷰징 방어 — 유저 {} 가 오늘 이미 스탬프 획득", userId);
            throw new IllegalArgumentException(
                    "스탬프는 하루에 딱 한 곳에서만 획득할 수 있습니다. 내일 다시 방문해주세요.");
        }
    }

    private void rejectIfDuplicatePopup(String userId, Long popupId) {
        if (stampRepository.existsByUserIdAndPopupStore_Id(userId, popupId)) {
            throw new IllegalArgumentException("이미 방문 인증이 완료된 팝업스토어입니다.");
        }
    }

    private void grantStampReward(User user, String userId) {
        int newCount = user.getStampCount() + 1;
        user.setStampCount(newCount);
        if (newCount % MEGAPHONE_REWARD_INTERVAL == 0) {
            user.setMegaphoneCount(user.getMegaphoneCount() + 1);
            log.info("[Stamp] 보상 지급 — 유저 {} 확성기 +1 (누적 스탬프: {})", userId, newCount);
        }
    }

    /* ============================== 단순 조회 헬퍼 ============================== */

    private PopupStore findPopupOrThrow(Long popupId) {
        return popupStoreRepository
                .findById(popupId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 팝업입니다."));
    }

    private User findUserOrThrow(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));
    }
}
