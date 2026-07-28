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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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

        // 파일은 DB 커밋이 성공한 뒤에만 지운다. @Transactional 메서드의 마지막 줄도 아직 커밋 전이므로
        // 여기서 바로 삭제하면, 이후 커밋 실패로 DB만 롤백되고 파일은 복구되지 않는 어긋난 상태가 된다.
        scheduleFileCleanupAfterCommit(List.copyOf(new LinkedHashSet<>(filesToDelete)));
        return userId;
    }

    void scheduleFileCleanupAfterCommit(List<String> files) {
        if (files.isEmpty()) return;

        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            cleanupFiles(files);
                        }
                    });
            return;
        }

        // 프록시 밖에서 직접 호출하는 단위 테스트 등 트랜잭션이 없는 경우의 안전한 폴백.
        // 운영 deleteAccount 호출은 위 afterCommit 경로를 탄다.
        cleanupFiles(files);
    }

    private void cleanupFiles(List<String> files) {
        int removed = fileCleaner.deleteAll(files);
        log.info("[AccountDeletion] 업로드 파일 정리 — 대상 {}건 중 {}건 삭제", files.size(), removed);
    }
}
