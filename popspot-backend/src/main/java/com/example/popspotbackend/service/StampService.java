package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.entity.Stamp;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

/**
 * [로직 구조 해석]
 * 1. @Service: 이 클래스를 비즈니스 로직을 처리하는 서비스 빈으로 등록합니다.
 * 2. @RequiredArgsConstructor: final로 선언된 Repository들을 자동으로 주입받습니다.
 * 3. @Slf4j: 어뷰징 방어 및 보상 지급 확인을 위한 로그를 남깁니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StampService {

    private final StampRepository stampRepository;
    private final PopupStoreRepository popupStoreRepository;
    private final UserRepository userRepository; // 🔥 [추가] 유저 보상 지급을 위해 추가됨

    /**
     * [로직 해석] 스탬프 찍기 (방문 인증 저장) 및 보상 지급 시스템
     * - 변경 사항: 무한 파밍 방지를 위해 '하루에 딱 한 곳만' 스탬프를 찍을 수 있도록 방어 로직 추가
     * - 추가 사항: 스탬프 3개 누적 시 자동으로 확성기 1개를 지급하는 보상 로직 추가
     * @param userId 프론트에서 넘어온 사용자 ID
     * @param popupId 프론트에서 넘어온 팝업 스토어 고유 ID
     */
    @Transactional
    @SuppressWarnings("null") // Null 안정성 경고 무시
    public void addStamp(String userId, Long popupId) {

        // ==========================================
        // 🛡️ [방어 1단계] 하루 1번, 단 한 곳만 스탬프 가능! (어뷰징 원천 차단)
        // ==========================================
        // 1-1. 한국 시간(KST) 기준으로 오늘의 날짜를 가져옵니다.
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));

        // 1-2. 오늘의 시작 시간(00:00:00)과 끝 시간(23:59:59)을 계산합니다.
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        // 1-3. 해당 유저가 '오늘' 다른 팝업이든 어디든 도장을 찍은 적이 있는지 확인합니다.
        // (주의: Repository에 existsByUserIdAndStampDateBetween 메서드가 필요합니다)
        if (stampRepository.existsByUserIdAndStampDateBetween(userId, startOfDay, endOfDay)) {
            log.warn("🚨 [어뷰징 방어] 유저 {} 님이 오늘 이미 스탬프를 획득했습니다.", userId);
            throw new RuntimeException("스탬프는 하루에 딱 한 곳에서만 획득할 수 있습니다! 내일 다시 방문해주세요. 🚫");
        }

        // ==========================================
        // 🛡️ [방어 2단계] 평생 동일한 팝업 중복 인증 불가
        // ==========================================
        // (주의: Repository에 existsByUserIdAndPopupStore_Id 메서드가 필요합니다)
        if (stampRepository.existsByUserIdAndPopupStore_Id(userId, popupId)) {
            throw new RuntimeException("이미 방문 인증이 완료된 팝업스토어입니다. ✅");
        }

        // ==========================================
        // ✅ [정상 처리] 대상 조회 및 스탬프 발급
        // ==========================================
        // 대산 팝업과 유저가 DB에 존재하는지 확인합니다.
        PopupStore popup = popupStoreRepository.findById(popupId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 팝업입니다."));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("존재하지 않는 유저입니다."));

        // Builder 패턴을 사용하여 Stamp 객체를 생성합니다.
        Stamp stamp = Stamp.builder()
                .userId(userId)
                .popupStore(popup)
                .build();

        // 최종적으로 DB에 스탬프 INSERT 쿼리를 실행합니다.
        stampRepository.save(stamp);

        // ==========================================
        // 🎁 [보상 지급 로직] 밸런스 패치 적용
        // ==========================================
        // 스탬프 카운트를 1 올립니다.
        int currentStampCount = user.getStampCount() + 1;
        user.setStampCount(currentStampCount);

        // 스탬프가 3의 배수가 될 때마다 확성기를 1개씩 추가 지급합니다.
        if (currentStampCount % 3 == 0) {
            user.setMegaphoneCount(user.getMegaphoneCount() + 1);
            log.info("🎉 [보상 지급] 유저 {} 님에게 확성기가 지급되었습니다! (누적 스탬프: {})", userId, currentStampCount);
        }

        log.info("✅ [스탬프 발급 성공] 유저 {} 님이 팝업 {} 의 스탬프를 획득했습니다.", userId, popupId);

        // ※ @Transactional 덕분에 user 엔티티의 변경된 필드 값은 메서드 종료 시 DB에 자동 업데이트(Dirty Checking) 됩니다.
    }

    /**
     * [로직 해석] 특정 유저의 스탬프 목록 조회
     * @param userId 조회할 사용자 ID
     * @return 해당 유저가 가진 모든 Stamp 리스트
     */
    public List<Stamp> getMyStamps(String userId) {
        // [코드 해석] Repository를 통해 USER_ID 컬럼이 일치하는 모든 데이터를 가져옵니다.
        return stampRepository.findAllByUserId(userId);
    }
}