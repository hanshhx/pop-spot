package com.example.popspotbackend.controller;

import com.example.popspotbackend.dto.MyPageDto;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/mypage")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class MyPageController {

    private final UserRepository userRepository;
    private final StampRepository stampRepository;
    private final WishlistRepository wishlistRepository;
    private final ChatRepository chatRepository;
    private final MatePostRepository matePostRepository;

    @GetMapping("/{userId}")
    public ResponseEntity<MyPageDto> getMyPageInfo(@PathVariable String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저 없음"));

        // 유효기간 만료 체크
        if (user.isPremium() && user.getPremiumExpiryDate() != null) {
            if (LocalDateTime.now().isAfter(user.getPremiumExpiryDate())) {
                user.expirePremium();
                userRepository.save(user);
            }
        }

        // 1. 스탬프, 찜 개수
        int stampCount = stampRepository.findAllByUserId(userId).size();
        int likeCount = wishlistRepository.findAllByUser_UserIdOrderByIdDesc(userId).size();

        // 🔥 [디버깅 로그 시작] ------------------------------------------------
        // 2. 활동량 계산 (채팅 + 게시글)
        // (1) 채팅: sender 컬럼이 내 닉네임과 같은지 확인
        int myChatCount = chatRepository.countBySender(user.getNickname());

        // (2) 글: author_id가 내 userId와 같은지 확인
        int myPostCount = matePostRepository.countByAuthor_UserId(userId);

        System.out.println("=========================================");
        System.out.println("🔍 [마이페이지 조회] 유저: " + user.getNickname() + " (" + userId + ")");
        System.out.println("   - 스탬프: " + stampCount);
        System.out.println("   - 찜하기: " + likeCount);
        System.out.println("   - 쓴 채팅(닉네임 기준): " + myChatCount);
        System.out.println("   - 쓴 글(ID 기준): " + myPostCount);
        System.out.println("   => 총 리뷰/톡 카운트: " + (myChatCount + myPostCount));
        System.out.println("=========================================");
        // ------------------------------------------------ [디버깅 로그 끝]

        int reviewCount = myChatCount + myPostCount;

        MyPageDto response = MyPageDto.builder()
                .nickname(user.getNickname())
                .isPremium(user.isPremium())
                .premiumExpiryDate(user.getPremiumExpiryDate())
                .megaphoneCount(user.getMegaphoneCount())
                .stampCount(stampCount)
                .likeCount(likeCount)
                .reviewCount(reviewCount)
                .build();

        return ResponseEntity.ok(response);
    }
}