package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final PopupStoreRepository popupStoreRepository;
    private final UserRepository userRepository;

    // 🔥 [신규 추가] 커뮤니티(메이트 게시판) 관리를 위해 레포지토리 의존성 추가
    private final MatePostRepository matePostRepository;

    // ================= [기존 로직 유지] =================
    @Transactional
    public void approvePopup(Long popupId) {
        PopupStore popup = popupStoreRepository.findById(popupId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 팝업입니다."));

        // 🔥 동현님 DB 규격에 맞춰 "OPEN" 대신 "영업중"으로 저장!
        popup.setStatus("영업중");

        if (popup.getReporterId() != null) {
            userRepository.findById(popup.getReporterId()).ifPresent(user -> {
                user.addMegaphone(1);
                userRepository.save(user);
                System.out.println("🎁 [보상 지급] " + user.getNickname() + "님에게 확성기 지급 완료!");
            });
        }
    }

    @Transactional
    public void rejectPopup(Long popupId) {
        popupStoreRepository.deleteById(popupId);
    }

    // ================= [🔥 신규 관리자 로직 추가] =================

    // 1. 🛑 팝업스토어 '상태' 강제 제어 (운영 관리)
    @Transactional
    public void changePopupStatus(Long popupId, String newStatus) {
        PopupStore popup = popupStoreRepository.findById(popupId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 팝업입니다."));
        popup.setStatus(newStatus);
    }

    // 2. 🎁 이벤트 아이템 수동 지급 (유저 관리 CS)
    @Transactional
    public void giveReward(String nickname, String itemType, int amount) {
        User user = userRepository.findByNickname(nickname)
                .orElseThrow(() -> new RuntimeException("해당 닉네임의 유저를 찾을 수 없습니다."));

        if ("MEGAPHONE".equalsIgnoreCase(itemType)) {
            user.addMegaphone(amount);
            System.out.println("📢 관리자가 " + nickname + "님에게 확성기 " + amount + "개 지급!");
        } else if ("POPPASS".equalsIgnoreCase(itemType)) {
            user.extendPremium(amount); // amount를 일(days)로 계산해서 연장
            System.out.println("👑 관리자가 " + nickname + "님에게 POP-PASS " + amount + "일권 지급!");
        } else {
            throw new IllegalArgumentException("알 수 없는 아이템 타입입니다.");
        }
    }

    // 3. 🧹 악성 메이트 게시글 강제 삭제 (콘텐츠 관리)
    @Transactional
    public void forceDeleteMatePost(Long postId) {
        matePostRepository.deleteById(postId);
    }

    // 4. 📊 대시보드 통계 요약 (데이터 분석)
    @Transactional(readOnly = true)
    public Map<String, Object> getAdminStats() {
        Map<String, Object> stats = new HashMap<>();
        // 총 가입 유저 수
        stats.put("totalUsers", userRepository.count());
        // 현재 영업중인 팝업 수
        stats.put("activePopups", popupStoreRepository.findByStatus("영업중").size());
        // 전체 메이트 게시글 수
        stats.put("totalMatePosts", matePostRepository.count());
        // 승인 대기 중인 제보 수
        stats.put("pendingPopups", popupStoreRepository.findByStatus("PENDING").size());

        return stats;
    }
}