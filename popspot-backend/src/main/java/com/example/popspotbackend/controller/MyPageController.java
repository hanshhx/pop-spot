package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MyPageDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 마이페이지 요약 정보. 프리미엄 만료 lazy-expire 와 활동량 카운트(채팅 + 게시글)를 함께 처리한다.
 *
 * <p>스탬프/찜 개수는 N+1 회피를 위해 {@code countBy...} 쿼리를 사용한다 (예전 {@code findAll().size()} 대체).
 */
@Slf4j
@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
public class MyPageController {

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final WishlistRepository wishlistRepository;
    private final ChatRepository chatRepository;
    private final MatePostRepository matePostRepository;

    @GetMapping("/{userId}")
    public ResponseEntity<MyPageDto> getMyPageInfo(@PathVariable String userId) {
        User user = findUserOrThrow(userId);
        expirePremiumIfNeeded(user);

        int stampCount = stampRepository.countByUserId(userId);
        int likeCount = wishlistRepository.countByUser_UserId(userId);
        int reviewCount = countMyActivity(user);

        return ResponseEntity.ok(
                MyPageDto.builder()
                        .nickname(user.getNickname())
                        .isPremium(user.isPremium())
                        .premiumExpiryDate(user.getPremiumExpiryDate())
                        .megaphoneCount(user.getMegaphoneCount())
                        .stampCount(stampCount)
                        .likeCount(likeCount)
                        .reviewCount(reviewCount)
                        .build());
    }

    private User findUserOrThrow(String userId) {
        return userRepository.findById(userId).orElseThrow(() -> new RuntimeException("유저 없음"));
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
