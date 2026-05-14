package com.example.popspotbackend.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 일정 협업 룸 (실시간 마커 + 1인 1표 토글 투표).
 *
 * <p>Redis 키 구조: {@code plan:room:{roomId}:markers} (List), {@code :users} (Set), {@code :votes}
 * (Hash 카운트), {@code :voters:{placeId}:{voteType}} (Set 중복방지), {@code plan:session:{sessionId}}
 * (WebSocket session → roomId/sender). 모든 키 TTL 3시간.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class PlanningController {

    private static final String ROOM_KEY_PREFIX = "plan:room:";
    public static final String SESSION_KEY_PREFIX = "plan:session:";

    private static final long ROOM_TTL_HOURS = 3;
    private static final int ROOM_ID_LENGTH = 8;

    private static final String ACTION_ADD = "ADD";
    private static final String ACTION_REMOVE = "REMOVE";
    private static final String ACTION_CLEAR = "CLEAR";
    private static final String ACTION_JOIN = "JOIN";
    private static final String TOPIC_PLAN_PREFIX = "/topic/plan/";

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    @PostMapping("/api/planning/create")
    public String createRoom() {
        String roomId = UUID.randomUUID().toString().substring(0, ROOM_ID_LENGTH);
        redisTemplate
                .opsForValue()
                .set(ROOM_KEY_PREFIX + roomId + ":exist", "true", ROOM_TTL_HOURS, TimeUnit.HOURS);
        return roomId;
    }

    @GetMapping("/api/planning/{roomId}/state")
    public RoomState getRoomState(@PathVariable String roomId) {
        List<String> markers =
                redisTemplate.opsForList().range(ROOM_KEY_PREFIX + roomId + ":markers", 0, -1);
        Set<String> users = redisTemplate.opsForSet().members(ROOM_KEY_PREFIX + roomId + ":users");
        Map<Object, Object> votes =
                redisTemplate.opsForHash().entries(ROOM_KEY_PREFIX + roomId + ":votes");
        return new RoomState(markers, users, votes);
    }

    @MessageMapping("/plan/{roomId}/action")
    public void handleAction(
            @DestinationVariable String roomId,
            @Payload PlanAction action,
            SimpMessageHeaderAccessor headerAccessor) {
        switch (action.getType()) {
            case ACTION_ADD -> appendMarker(roomId, action.getData());
            case ACTION_REMOVE -> removeMarker(roomId, action.getData());
            case ACTION_CLEAR -> clearMarkers(roomId);
            case ACTION_JOIN -> registerJoin(
                    roomId, action.getData(), headerAccessor.getSessionId());
            default -> log.debug("[Planning] 알 수 없는 액션 type={}", action.getType());
        }
        messagingTemplate.convertAndSend(TOPIC_PLAN_PREFIX + roomId, action);
    }

    /** 1인 1표 토글 투표. 이미 누른 사람이 다시 누르면 취소된다. */
    @MessageMapping("/plan/{roomId}/vote")
    public void handleVote(@DestinationVariable String roomId, @Payload VoteRequest vote) {
        String voteCountKey = ROOM_KEY_PREFIX + roomId + ":votes";
        String voterLogKey =
                ROOM_KEY_PREFIX
                        + roomId
                        + ":voters:"
                        + vote.getPlaceId()
                        + ":"
                        + vote.getVoteType();
        String fieldKey = vote.getPlaceId() + ":" + vote.getVoteType();

        Long newCount =
                hasUserVoted(voterLogKey, vote.getSender())
                        ? cancelVote(voterLogKey, voteCountKey, fieldKey, vote.getSender())
                        : castVote(voterLogKey, voteCountKey, fieldKey, vote.getSender());

        extendTtl(voteCountKey, voterLogKey);
        messagingTemplate.convertAndSend(
                TOPIC_PLAN_PREFIX + roomId,
                new VoteMessage(
                        "VOTE", vote.getPlaceId(), vote.getVoteType(), newCount.intValue()));
    }

    /* ============================== 액션 처리 ============================== */

    private void appendMarker(String roomId, String data) {
        redisTemplate.opsForList().rightPush(ROOM_KEY_PREFIX + roomId + ":markers", data);
    }

    private void removeMarker(String roomId, String data) {
        redisTemplate.opsForList().remove(ROOM_KEY_PREFIX + roomId + ":markers", 1, data);
    }

    private void clearMarkers(String roomId) {
        redisTemplate.delete(ROOM_KEY_PREFIX + roomId + ":markers");
    }

    private void registerJoin(String roomId, String sender, String sessionId) {
        String userKey = ROOM_KEY_PREFIX + roomId + ":users";
        redisTemplate.opsForSet().add(userKey, sender);
        redisTemplate.expire(userKey, ROOM_TTL_HOURS, TimeUnit.HOURS);

        if (sessionId != null) {
            redisTemplate
                    .opsForValue()
                    .set(
                            SESSION_KEY_PREFIX + sessionId,
                            roomId + "/" + sender,
                            ROOM_TTL_HOURS,
                            TimeUnit.HOURS);
        }
    }

    /* ============================== 투표 처리 ============================== */

    private boolean hasUserVoted(String voterLogKey, String sender) {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(voterLogKey, sender));
    }

    private Long castVote(String voterLogKey, String voteCountKey, String fieldKey, String sender) {
        redisTemplate.opsForSet().add(voterLogKey, sender);
        return redisTemplate.opsForHash().increment(voteCountKey, fieldKey, 1);
    }

    /** Redis increment 는 음수도 허용하므로 0 미만으로 떨어지지 않도록 방어. */
    private Long cancelVote(
            String voterLogKey, String voteCountKey, String fieldKey, String sender) {
        redisTemplate.opsForSet().remove(voterLogKey, sender);
        Long newCount = redisTemplate.opsForHash().increment(voteCountKey, fieldKey, -1);
        if (newCount < 0) {
            redisTemplate.opsForHash().put(voteCountKey, fieldKey, "0");
            return 0L;
        }
        return newCount;
    }

    private void extendTtl(String voteCountKey, String voterLogKey) {
        redisTemplate.expire(voteCountKey, ROOM_TTL_HOURS, TimeUnit.HOURS);
        redisTemplate.expire(voterLogKey, ROOM_TTL_HOURS, TimeUnit.HOURS);
    }

    /* ============================== 메시지 DTO ============================== */

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class PlanAction {
        private String type;
        private String data;
        private String sender;
    }

    @Data
    @AllArgsConstructor
    static class RoomState {
        private List<String> markers;
        private Set<String> users;
        private Map<Object, Object> votes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoteRequest {
        private String placeId;
        private String voteType;
        private String sender;
    }

    @Data
    @AllArgsConstructor
    public static class VoteMessage {
        private String type;
        private String placeId;
        private String voteType;
        private int count;
    }
}
