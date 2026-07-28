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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 개인정보 처리방침에 맞춰 계정 식별정보와 사용자 생성 데이터를 한 트랜잭션에서 정리한다. */
@Slf4j
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
    private final UploadedFileCleaner fileCleaner;

    @Transactional
    public String deleteAccount(String userId) {
        User user =
                userRepository
                        .findById(userId)
                        .orElseThrow(() -> ResourceNotFoundException.user(userId));
        String nickname = user.getNickname();

        // v2.47 — 지울 업로드 파일 경로를 <b>행을 지우기 전에</b> 모은다. 먼저 지우면 어떤 파일이 이
        // 사람 것이었는지 알 수 없어 디스크에 주인 없는 이미지가 남는다. /uploads/** 는 공개 경로라
        // 주소를 아는 사람은 탈퇴 후에도 계속 볼 수 있다.
        List<String> filesToDelete = new ArrayList<>();
        if (user.getPicture() != null) filesToDelete.add(user.getPicture());

        spotifyAuthRepository.deleteByUserId(userId);
        wishlistRepository.deleteByUser_UserId(userId);
        stampRepository.deleteByUserId(userId);
        myCourseRepository.deleteByUserId(userId);
        musicHistoryRepository.deleteByUserId(userId);
        feedbackRepository.deleteByUserId(userId);
        popupWaitReportRepository.deleteByReporterKey("u:" + userId);
        if (nickname != null && !nickname.isBlank()) {
            filesToDelete.addAll(mateChatMessageRepository.findFileUrlsBySender(nickname));
            mateChatMessageRepository.deleteBySender(nickname);
            chatRepository.deleteBySender(nickname);
        }

        List<MatePost> authored = matePostRepository.findByAuthor_UserId(userId);
        List<Long> authoredIds =
                authored.stream().map(MatePost::getId).filter(java.util.Objects::nonNull).toList();
        if (!authoredIds.isEmpty()) {
            // 내가 연 방은 통째로 사라지므로 그 방의 첨부도 함께 지운다(다른 사람이 올린 것 포함).
            filesToDelete.addAll(mateChatMessageRepository.findFileUrlsByMatePostIds(authoredIds));
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

        // 파일 삭제는 마지막에. 실패해도 탈퇴 자체는 이미 끝났고(cleaner 가 예외를 삼킨다), 반대로
        // 앞에서 지웠다가 뒤에서 트랜잭션이 되돌아가면 파일만 사라진 어긋난 상태가 된다.
        int removed = fileCleaner.deleteAll(filesToDelete);
        if (!filesToDelete.isEmpty()) {
            log.info("[AccountDeletion] 업로드 파일 정리 — 대상 {}건 중 {}건 삭제", filesToDelete.size(), removed);
        }
        return userId;
    }
}
