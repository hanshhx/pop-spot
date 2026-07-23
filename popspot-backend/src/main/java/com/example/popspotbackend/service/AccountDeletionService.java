package com.example.popspotbackend.service;

import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.ChatRepository;
import com.example.popspotbackend.repository.FeedbackRepository;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.MyCourseRepository;
import com.example.popspotbackend.repository.PopupWaitReportRepository;
import com.example.popspotbackend.repository.SpotifyAuthRepository;
import com.example.popspotbackend.repository.StampRepository;
import com.example.popspotbackend.repository.UserMusicHistoryRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.repository.WishlistRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 개인정보 처리방침에 맞춰 계정 식별정보와 사용자 생성 데이터를 한 트랜잭션에서 정리한다. */
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final SpotifyAuthRepository spotifyAuthRepository;
    private final WishlistRepository wishlistRepository;
    private final StampRepository stampRepository;
    private final MyCourseRepository myCourseRepository;
    private final UserMusicHistoryRepository musicHistoryRepository;
    private final FeedbackRepository feedbackRepository;
    private final MatePostRepository matePostRepository;
    private final MateChatMessageRepository mateChatMessageRepository;
    private final ChatRepository chatRepository;
    private final PopupWaitReportRepository popupWaitReportRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public String deleteAccount(String userId) {
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        String nickname = user.getNickname();

        spotifyAuthRepository.deleteByUserId(userId);
        wishlistRepository.deleteByUser_UserId(userId);
        stampRepository.deleteByUserId(userId);
        myCourseRepository.deleteByUserId(userId);
        musicHistoryRepository.deleteByUserId(userId);
        feedbackRepository.deleteByUserId(userId);
        popupWaitReportRepository.deleteByReporterKey("u:" + userId);
        if (nickname != null && !nickname.isBlank()) {
            mateChatMessageRepository.deleteBySender(nickname);
            chatRepository.deleteBySender(nickname);
        }

        List<MatePost> authored = matePostRepository.findByAuthor_UserId(userId);
        List<Long> authoredIds =
                authored.stream().map(MatePost::getId).filter(java.util.Objects::nonNull).toList();
        if (!authoredIds.isEmpty()) {
            mateChatMessageRepository.deleteByMatePost_IdIn(authoredIds);
        }
        matePostRepository.deleteAll(authored);
        List<MatePost> remaining = matePostRepository.findAll();
        remaining.forEach(post -> post.removeUserReferences(userId));
        matePostRepository.saveAll(remaining);

        String suffix = UUID.randomUUID().toString();
        user.setNickname("탈퇴회원-" + suffix.substring(0, 8));
        user.setEmail("deleted-" + suffix + "@popspot.invalid");
        user.setPhoneNumber(null);
        user.setPicture(null);
        user.setProvider("DELETED");
        user.setAccountActive(false);
        user.setTokenVersion(user.getTokenVersion() + 1);
        user.changePassword(passwordEncoder.encode("DELETED-" + UUID.randomUUID()));
        userRepository.save(user);
        return userId;
    }
}
