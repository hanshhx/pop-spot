package com.example.popspotbackend.dto;

/**
 * 걸려 있는 IP 차단 한 줄.
 *
 * @param ip 차단된 주소. <b>가리지 않는다</b> — 관리자가 자기가 건 것을 풀려면 온전한 값이 필요하고, 애초에 관리자가 직접 적어 넣은 값이다. (D-1
 *     현황판은 "낯선 곳인가" 만 답하면 되므로 가린다)
 * @param reason 왜 걸었는지. 몇 시간 뒤의 자신이 읽는다
 * @param blockedBy 건 사람
 * @param blockedAt 건 시각
 * @param remainingSeconds 남은 시간. <b>이 값이 0 이 되면 저절로 풀린다</b> — 화면은 "언제까지" 가 아니라 "얼마나 남았는지" 를 보여 줘야
 *     임시라는 것이 드러난다
 */
public record IpBlockDto(
        String ip, String reason, String blockedBy, String blockedAt, long remainingSeconds) {}
