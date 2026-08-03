package com.example.popspotbackend.dto;

import com.example.popspotbackend.entity.MatePost;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

/**
 * 관리자 동행 게시글 목록 응답.
 *
 * <p>전에는 {@link MatePost} 엔티티를 그대로 반환해서, 화면이 제목·내용·작성자 닉네임만 그리는데도 응답에는 다음이 함께 실려 나갔다.
 *
 * <ul>
 *   <li>{@code reportedBy} — <b>신고자 명단</b>(회원 UUID). 중복 신고를 막으려는 내부 상태다. 신고 API 조차 호출자에게 누적 횟수만
 *       돌려주는데, 관리자 목록에서는 누가 신고했는지가 통째로 나갔다. <b>신고자 익명성은 신고 기능이 작동하기 위한 전제</b>다.
 *   <li>{@code joinedUsers} — <b>참가자 명단</b>(회원 UUID). "누가 누구와 어느 팝업에 함께 가기로 했는가" 는 사회적 관계 데이터다.
 *       관리자가 이 화면에서 하는 일은 강제 삭제 하나뿐이고, 그 판단에 참가자 명단은 쓰이지 않는다. 인원수는 {@code currentPeople} 로 이미 나간다.
 *   <li>{@code author} — {@link com.example.popspotbackend.entity.User} 통째. 가입경로 · 가입일 · 결제 만료일 ·
 *       활동 카운터가 전부 따라 나왔다. <b>같은 데이터의 공개 API 는 이미 필드를 추려서 내보낸다</b> — 공개 경로에서 막아 둔 것이 관리자 경로에서만 열려
 *       있었다.
 * </ul>
 *
 * <p>화면이 안 그린다고 안 나가는 것이 아니다. 응답에 실린 값은 브라우저까지 도착해 개발자도구·프록시 로그·캐시에 남는다.
 *
 * <p>{@code reportCount} 와 {@code isHidden} 은 <b>남긴다.</b> 강제 삭제 여부를 판단하는 근거이고 개인정보가 아니다. 지금 화면이 그리지
 * 않을 뿐, 그려야 할 값이다.
 */
public record AdminMatePostDto(
        Long id,
        String title,
        String content,
        Author author,
        String targetPopup,
        String status,
        int currentPeople,
        int maxPeople,
        int reportCount,
        LocalDateTime createdAt,
        @JsonProperty("isMegaphone") boolean isMegaphone,
        @JsonProperty("isHidden") boolean isHidden) {

    /** 작성자 — 닉네임 하나. 관리 화면이 읽는 유일한 값이다. */
    public record Author(String nickname) {}

    public static AdminMatePostDto from(MatePost p) {
        return new AdminMatePostDto(
                p.getId(),
                p.getTitle(),
                p.getContent(),
                new Author(p.getAuthor() == null ? null : p.getAuthor().getNickname()),
                p.getTargetPopup(),
                p.getStatus(),
                p.getCurrentPeople(),
                p.getMaxPeople(),
                p.getReportCount(),
                p.getCreatedAt(),
                p.isMegaphone(),
                p.isHidden());
    }
}
