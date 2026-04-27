package com.example.popspotbackend.controller;

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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequiredArgsConstructor
public class PlanningController {

    private final SimpMessagingTemplate messagingTemplate;
    private final StringRedisTemplate redisTemplate;

    private static final String ROOM_KEY_PREFIX = "plan:room:";
    public static final String SESSION_KEY_PREFIX = "plan:session:";

    @PostMapping("/api/planning/create")
    public String createRoom() {
        String roomId = UUID.randomUUID().toString().substring(0, 8);
        redisTemplate.opsForValue().set(ROOM_KEY_PREFIX + roomId + ":exist", "true", 3, TimeUnit.HOURS);
        return roomId;
    }

    @GetMapping("/api/planning/{roomId}/state")
    public RoomState getRoomState(@PathVariable String roomId) {
        List<String> markers = redisTemplate.opsForList().range(ROOM_KEY_PREFIX + roomId + ":markers", 0, -1);
        Set<String> users = redisTemplate.opsForSet().members(ROOM_KEY_PREFIX + roomId + ":users");

        // 현재 투표 수 조회 (화면 표시용)
        Map<Object, Object> votes = redisTemplate.opsForHash().entries(ROOM_KEY_PREFIX + roomId + ":votes");

        return new RoomState(markers, users, votes);
    }

    @MessageMapping("/plan/{roomId}/action")
    public void handleAction(@DestinationVariable String roomId, @Payload PlanAction action, SimpMessageHeaderAccessor headerAccessor) {
        String markerKey = ROOM_KEY_PREFIX + roomId + ":markers";
        String userKey = ROOM_KEY_PREFIX + roomId + ":users";

        if ("ADD".equals(action.getType())) {
            redisTemplate.opsForList().rightPush(markerKey, action.getData());
        } else if ("REMOVE".equals(action.getType())) {
            redisTemplate.opsForList().remove(markerKey, 1, action.getData());
        } else if ("CLEAR".equals(action.getType())) {
            redisTemplate.delete(markerKey);
            // redisTemplate.delete(ROOM_KEY_PREFIX + roomId + ":votes"); // (선택) 초기화 시 투표도 리셋하려면 주석 해제
        }
        else if ("JOIN".equals(action.getType())) {
            redisTemplate.opsForSet().add(userKey, action.getData());
            redisTemplate.expire(userKey, 3, TimeUnit.HOURS);

            String sessionId = headerAccessor.getSessionId();
            if (sessionId != null) {
                String sessionValue = roomId + "/" + action.getData();
                redisTemplate.opsForValue().set(SESSION_KEY_PREFIX + sessionId, sessionValue, 3, TimeUnit.HOURS);
            }
        }

        messagingTemplate.convertAndSend("/topic/plan/" + roomId, action);
    }

    // 🔥 [수정됨] 1인 1표(토글) 방식의 투표 핸들러
    @MessageMapping("/plan/{roomId}/vote")
    public void handleVote(@DestinationVariable String roomId, @Payload VoteRequest vote) {
        // 1. 투표 수 저장소 (Hash) -> 화면 표시용 숫자
        String voteCountKey = ROOM_KEY_PREFIX + roomId + ":votes";

        // 2. 투표자 명단 저장소 (Set) -> 중복 방지용
        // 키 예시: plan:room:123:voters:장소ID:LIKE
        String voterLogKey = ROOM_KEY_PREFIX + roomId + ":voters:" + vote.getPlaceId() + ":" + vote.getVoteType();

        String fieldKey = vote.getPlaceId() + ":" + vote.getVoteType();

        // 3. 이미 투표했는지 확인
        Boolean isVoted = redisTemplate.opsForSet().isMember(voterLogKey, vote.getSender());

        Long newCount;
        if (Boolean.TRUE.equals(isVoted)) {
            // ✅ 이미 투표함 -> 취소 처리 (Set에서 제거, Count -1)
            redisTemplate.opsForSet().remove(voterLogKey, vote.getSender());
            newCount = redisTemplate.opsForHash().increment(voteCountKey, fieldKey, -1);
            // 음수가 되지 않도록 방어 로직 (Redis increment는 음수 가능하므로)
            if (newCount < 0) {
                redisTemplate.opsForHash().put(voteCountKey, fieldKey, "0");
                newCount = 0L;
            }
        } else {
            // ✅ 안 했음 -> 투표 처리 (Set에 추가, Count +1)
            redisTemplate.opsForSet().add(voterLogKey, vote.getSender());
            newCount = redisTemplate.opsForHash().increment(voteCountKey, fieldKey, 1);
        }

        // 만료 시간 연장
        redisTemplate.expire(voteCountKey, 3, TimeUnit.HOURS);
        redisTemplate.expire(voterLogKey, 3, TimeUnit.HOURS);

        // 4. 변경된 숫자 방송
        VoteMessage message = new VoteMessage("VOTE", vote.getPlaceId(), vote.getVoteType(), newCount.intValue());
        messagingTemplate.convertAndSend("/topic/plan/" + roomId, message);
    }

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
        private String sender; // 🔥 [추가] 누가 보냈는지 확인용
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