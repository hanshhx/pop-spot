package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.MyPageDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 마이페이지 도메인 서비스.
 *
 * <p>{@link com.example.popspotbackend.controller.MyPageController} 가 5개 Repository 를 직접 호출하던 패턴을 한
 * 곳으로 모아 컨트롤러는 라우팅만 담당하게 한다. 트랜잭션 경계도 이 클래스에서만 가짐.
 *
 * <p>책임 — ① 사용자 조회 + 누락 시 도메인 예외, ② 프리미엄 만료 lazy expire, ③ 활동량(스탬프·찜·채팅·게시글) 카운트 집계.
 */
@Service
@RequiredArgsConstructor
public class MyPageService {

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final WishlistRepository wishlistRepository;
    private final ChatRepository chatRepository;
    private final MatePostRepository matePostRepository;

    @Transactional
    public MyPageDto findMyPageData(String userId) {
        User user = findUserOrThrow(userId);
        expirePremiumIfNeeded(user);

        int stampCount = stampRepository.countByUserId(userId);
        int likeCount = wishlistRepository.countByUser_UserId(userId);
        int reviewCount = countMyActivity(user);

        return MyPageDto.builder()
                .nickname(user.getNickname())
                .isPremium(user.isPremium())
                .premiumExpiryDate(user.getPremiumExpiryDate())
                .megaphoneCount(user.getMegaphoneCount())
                .stampCount(stampCount)
                .likeCount(likeCount)
                .reviewCount(reviewCount)
                .build();
    }

    private User findUserOrThrow(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }

    /** 프리미엄 유효기간이 지났으면 즉시 만료 처리한다 (조회 시점 lazy expire). */
    private void expirePremiumIfNeeded(User user) {
        if (!user.isPremium() || user.getPremiumExpiryDate() == null) return;
        if (LocalDateTime.now().isAfter(user.getPremiumExpiryDate())) {
            user.expirePremium();
            userRepository.save(user);
        }
    }

    /** 채팅(닉네임 기준) + 게시글(userId 기준) 활동 카운트. */
    private int countMyActivity(User user) {
        int chatCount = chatRepository.countBySender(user.getNickname());
        int postCount = matePostRepository.countByAuthor_UserId(user.getUserId());
        return chatCount + postCount;
    }
}
