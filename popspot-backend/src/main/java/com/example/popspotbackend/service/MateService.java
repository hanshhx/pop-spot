package com.example.popspotbackend.service;

import com.example.popspotbackend.dto.MateDto;
import com.example.popspotbackend.entity.MateChatMessage;
import com.example.popspotbackend.entity.MatePost;
import com.example.popspotbackend.entity.User;
import com.example.popspotbackend.exception.ResourceNotFoundException;
import com.example.popspotbackend.repository.MateChatMessageRepository;
import com.example.popspotbackend.repository.MatePostRepository;
import com.example.popspotbackend.repository.UserRepository;
import com.example.popspotbackend.service.mate.BoostPolicy;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 동행 모집 게시판 도메인 서비스.
 *
 * <p>{@link com.example.popspotbackend.controller.MateController} 의 비즈니스 로직(부스트 한도 검증 · 정원 검사 · 자동
 * 마감 · 멤버 admit)을 모아서 라우팅과 분리. 트랜잭션 경계도 이 클래스에서만 정의한다.
 *
 * <p>v2.12 부터 확성기 아이템 소비 모델을 폐지하고, 등급(스탬프 누적량)별 월 한도로 상단 부스트를 제공한다. {@code MatePost.isMegaphone}
 * 컬럼은 의미만 "상단 부스트 적용 여부" 로 재해석해 그대로 재사용.
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
     * @throws BoostQuotaExceededException 부스트 사용 요청인데 이번 달 한도를 이미 다 썼을 때
     */
    @Transactional
    public MatePost createPost(MateDto dto) {
        if (dto.getUserId() == null) {
            throw new IllegalArgumentException("요청 본문에 userId가 누락되었습니다.");
        }

        User user = findUserOrThrow(dto.getUserId());
        boolean boostApplied = tryConsumeBoost(user, dto.isUseBoost());

        MatePost post = buildMatePost(dto, user, boostApplied);
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

    /**
     * v2.18.1 — 게시글 신고. 누적 신고 수가 임계값 ({@link #REPORT_AUTO_HIDE_THRESHOLD}) 도달하면 자동으로 isHidden=true
     * 처리해 사용자 화면에서 제외.
     *
     * <p>본인 글 신고는 무의미하므로 차단. 신고 사유는 자유 텍스트라 단순 기록 (현재는 카운터만 증가시키고 사유를 별도 저장하지 않음 — 운영 부담 줄이기 위한
     * 트레이드오프. 추후 ReportLog 테이블 추가 가능).
     */
    @Transactional
    public int reportPost(Long postId, String reporterUserId) {
        MatePost post = findPostOrThrow(postId);
        if (post.getAuthor().getUserId().equals(reporterUserId)) {
            throw new IllegalArgumentException("본인 게시글은 신고할 수 없습니다.");
        }
        int next = post.getReportCount() + 1;
        post.setReportCount(next);
        if (next >= REPORT_AUTO_HIDE_THRESHOLD && !post.isHidden()) {
            post.setHidden(true);
        }
        matePostRepository.save(post);
        return next;
    }

    private static final int REPORT_AUTO_HIDE_THRESHOLD = 3;

    /**
     * 사용자의 현재 등급 + 월 부스트 한도 / 잔여 횟수.
     *
     * <p>글쓰기 모달에서 "이번 달 N회 남음" 표시용. 호출 시점에 boost_period 가 이번 달과 다르면 즉시 리셋하고 저장한다.
     */
    @Transactional
    public BoostStatus getBoostStatus(String userId) {
        User user = findUserOrThrow(userId);
        resetBoostIfNewPeriod(user);
        userRepository.save(user);

        BoostPolicy.Rank rank = BoostPolicy.rankOf(user.getStampCount());
        int limit = BoostPolicy.monthlyLimit(rank);
        int used = user.getBoostUsedCount();
        int remaining = Math.max(limit - used, 0);
        return new BoostStatus(rank.name(), limit, used, remaining);
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
     * 부스트 소비 시도.
     *
     * @return 부스트 적용 여부
     * @throws BoostQuotaExceededException 사용 요청인데 이번 달 한도 초과 (또는 NONE 등급)
     */
    private boolean tryConsumeBoost(User user, boolean requested) {
        if (!requested) return false;

        resetBoostIfNewPeriod(user);

        int limit = BoostPolicy.monthlyLimitFor(user.getStampCount());
        if (user.getBoostUsedCount() >= limit) {
            throw new BoostQuotaExceededException(limit, user.getBoostUsedCount());
        }
        user.setBoostUsedCount(user.getBoostUsedCount() + 1);
        userRepository.save(user);
        return true;
    }

    /** boost_period 가 현재 달과 다르면 사용량 0 으로 리셋. */
    private void resetBoostIfNewPeriod(User user) {
        String currentPeriod = YearMonth.now().toString();
        if (!currentPeriod.equals(user.getBoostPeriod())) {
            user.setBoostUsedCount(0);
            user.setBoostPeriod(currentPeriod);
        }
    }

    private MatePost buildMatePost(MateDto dto, User user, boolean isBoosted) {
        return MatePost.builder()
                .title(dto.getTitle())
                .content(dto.getContent())
                .targetPopup(dto.getTargetPopup())
                .maxPeople(dto.getMaxPeople())
                .currentPeople(1)
                .author(user)
                .status(STATUS_RECRUITING)
                .isMegaphone(isBoosted)
                .build();
    }

    private void admitNewMember(MatePost post, String userId) {
        post.addJoinedUser(userId);
        post.increaseCurrentPeople();
        if (post.getCurrentPeople() == post.getMaxPeople()) {
            post.setStatus(STATUS_CLOSED);
        }
    }

    /* ============================== 결과 / 도메인 예외 ============================== */

    public enum JoinResult {
        ALREADY_JOINED,
        FULL,
        JOIN_SUCCESS
    }

    /** 등급별 부스트 한도 + 잔여 횟수 응답. */
    public record BoostStatus(String rank, int monthlyLimit, int used, int remaining) {}

    /** 이번 달 부스트 한도 초과. 컨트롤러가 400 으로 변환. */
    public static class BoostQuotaExceededException extends RuntimeException {
        public BoostQuotaExceededException(int limit, int used) {
            super("이번 달 부스트 한도를 모두 사용했습니다. (한도: " + limit + ", 사용: " + used + ")");
        }
    }

    /** 본인 게시글이 아닌데 삭제 시도. 컨트롤러가 403 으로 변환. */
    public static class AccessDeniedToPostException extends RuntimeException {
        public AccessDeniedToPostException() {
            super("본인이 작성한 글만 삭제할 수 있습니다.");
        }
    }
}
