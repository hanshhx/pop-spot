package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 동행 모집 게시판 도메인 서비스.
 *
 * <p>{@link com.example.popspotbackend.controller.MateController} 의 비즈니스 로직(확성기 소비 · 정원 검사 · 자동 마감
 * · 멤버 admit)을 모아서 라우팅과 분리. 트랜잭션 경계도 이 클래스에서만 정의한다.
 */
@Service
@RequiredArgsConstructor
public class MateService {

    private static final String STATUS_RECRUITING = "RECRUITING";
    private static final String STATUS_CLOSED = "CLOSED";

    private final MatePostRepository matePostRepository;
    private final UserRepository userRepository;
    private final MateChatMessageRepository mateChatMessageRepository;

    public List<MatePost> findAllPostsOrdered() {
        return matePostRepository.findAllByOrderByIsMegaphoneDescCreatedAtDesc();
    }

    public List<MateChatMessage> findChatMessages(Long postId) {
        return mateChatMessageRepository.findByMatePostIdOrderBySendTimeAsc(postId);
    }

    /**
     * STOMP 채널에서 받은 메시지를 게시글에 묶어 저장.
     *
     * @return 영속화된 채팅 메시지 (브로드캐스트 용도)
     */
    @Transactional
    public MateChatMessage persistChatMessage(Long postId, MateChatMessage message) {
        MatePost post = findPostOrThrow(postId);
        message.setMatePost(post);
        message.setSendTime(java.time.LocalDateTime.now());
        return mateChatMessageRepository.save(message);
    }

    /**
     * 새 동행 게시글을 만든다.
     *
     * @return 작성된 게시글
     * @throws InsufficientMegaphoneException 확성기 사용 요청인데 보유량이 부족할 때
     */
    @Transactional
    public MatePost createPost(MateDto dto) {
        if (dto.getUserId() == null) {
            throw new IllegalArgumentException("요청 본문에 userId가 누락되었습니다.");
        }

        User user = findUserOrThrow(dto.getUserId());
        boolean megaphoneApplied = tryConsumeMegaphone(user, dto.isUseMegaphone());

        MatePost post = buildMatePost(dto, user, megaphoneApplied);
        return matePostRepository.save(post);
    }

    /**
     * 동행 게시글 참여.
     *
     * @return 처리 결과 ({@link JoinResult#ALREADY_JOINED}, {@link JoinResult#FULL}, {@link
     *     JoinResult#JOIN_SUCCESS})
     */
    @Transactional
    public JoinResult joinMate(Long postId, String userId) {
        MatePost post = findPostOrThrow(postId);

        if (post.hasJoined(userId)) {
            return JoinResult.ALREADY_JOINED;
        }
        if (post.getCurrentPeople() >= post.getMaxPeople()) {
            return JoinResult.FULL;
        }

        admitNewMember(post, userId);
        matePostRepository.save(post);
        return JoinResult.JOIN_SUCCESS;
    }

    /**
     * 본인이 작성한 게시글만 삭제 가능.
     *
     * @throws AccessDeniedToPostException 작성자 아님
     */
    @Transactional
    public void deletePost(Long postId, String userId) {
        MatePost post = findPostOrThrow(postId);
        if (!post.getAuthor().getUserId().equals(userId)) {
            throw new AccessDeniedToPostException();
        }
        matePostRepository.delete(post);
    }

    /* ============================== 내부 헬퍼 ============================== */

    private User findUserOrThrow(String userId) {
        return userRepository
                .findById(userId)
                .orElseThrow(() -> ResourceNotFoundException.user(userId));
    }

    private MatePost findPostOrThrow(Long postId) {
        return matePostRepository
                .findById(postId)
                .orElseThrow(() -> ResourceNotFoundException.matePost(postId));
    }

    /**
     * 확성기 소비 시도.
     *
     * @return 확성기 사용 여부
     * @throws InsufficientMegaphoneException 사용 요청인데 보유량 부족
     */
    private boolean tryConsumeMegaphone(User user, boolean requested) {
        if (!requested) return false;
        if (user.getMegaphoneCount() <= 0) throw new InsufficientMegaphoneException();
        user.addMegaphone(-1);
        userRepository.save(user);
        return true;
    }

    private MatePost buildMatePost(MateDto dto, User user, boolean isMegaphone) {
        return MatePost.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .targetPopup(dto.getTargetPopup())
                .maxPeople(dto.getMaxPeople())
                .currentPeople(1)
                .author(user)
                .status(STATUS_RECRUITING)
                .isMegaphone(isMegaphone)
                .build();
    }

    private void admitNewMember(MatePost post, String userId) {
        post.addJoinedUser(userId);
        post.increaseCurrentPeople();
        if (post.getCurrentPeople() == post.getMaxPeople()) {
            post.setStatus(STATUS_CLOSED);
        }
    }

    /* ============================== 결과 enum / 도메인 예외 ============================== */

    public enum JoinResult {
        ALREADY_JOINED,
        FULL,
        JOIN_SUCCESS
    }

    /** 확성기 보유량이 부족할 때. 컨트롤러가 400 으로 변환. */
    public static class InsufficientMegaphoneException extends RuntimeException {
        public InsufficientMegaphoneException() {
            super("확성기 아이템이 부족합니다.");
        }
    }

    /** 본인 게시글이 아닌데 삭제 시도. 컨트롤러가 403 으로 변환. */
    public static class AccessDeniedToPostException extends RuntimeException {
        public AccessDeniedToPostException() {
            super("본인이 작성한 글만 삭제할 수 있습니다.");
        }
    }
}
