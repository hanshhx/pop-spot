package com.example.popspotbackend.dto;

import java.util.List;

/**
 * D-1 — 감사 로그로 만든 최소 보안 현황판.
 *
 * <p><b>무엇을 답하려는 것인가.</b> 관리자가 한 명인 서비스에서 물어야 할 것은 넷이다.
 *
 * <ol>
 *   <li>실패가 갑자기 늘었나 — 공격 시도이거나 무언가 고장난 것이다
 *   <li>내가 모르는 곳(IP)에서 관리자 작업이 있었나
 *   <li>되돌릴 수 없는 일(삭제)이 언제 있었나
 *   <li>회원 개인정보를 언제 꺼냈나
 * </ol>
 *
 * <p><b>알림이 아니라 현황판이다.</b> 임계값을 정해 자동으로 경보를 울리려면 "평소" 가 무엇인지 알아야 하는데, 아직 그 기준선이 없다. 먼저 보이게 만들고, 평소
 * 모양이 쌓인 뒤에 경보를 얹는 편이 순서가 맞다 — 기준 없이 울리는 경보는 곧 무시된다.
 *
 * @param days 집계 구간
 * @param total 기간 안의 관리자 작업 수
 * @param failed 그중 실패
 * @param failRate 실패율(%)
 * @param byTarget 대상 종류별 건수
 * @param newIps 직전 같은 길이의 구간에는 없던 IP — 처음 보는 접속지
 * @param knownIpCount 직전 구간에도 있었던 IP 수
 * @param unknownOrigin 접속지를 <b>알 수 없는</b> 작업 수 — 위 2번의 사각지대 크기다. Vercel 을 거치지 않는 경로(업로드·사진 백필·중복
 *     정리·로그 스트림)는 접속자 IP 를 증명할 수 없어 아무것도 남기지 않는다. 이 값을 안 보여 주면 그 작업들은 현황판에서 <b>없었던 일</b>처럼 보인다
 * @param destructive 삭제 작업 최근 목록
 * @param memberDataAccess 회원 개인정보를 만진 최근 목록
 */
public record SecurityOverviewDto(
        int days,
        long total,
        long failed,
        double failRate,
        List<TargetCount> byTarget,
        List<String> newIps,
        int knownIpCount,
        long unknownOrigin,
        List<Entry> destructive,
        List<Entry> memberDataAccess) {

    public record TargetCount(String target, long count) {}

    /**
     * 한 줄.
     *
     * @param ip <b>가려서 넣는다.</b> 현황판은 "낯선 곳인가" 만 알면 되고, 온전한 주소는 감사 로그 원본에 있다 — 요약 화면까지 평문으로 복제할 이유가
     *     없다
     */
    public record Entry(String at, String actor, String action, String target, String ip) {}

    /** 실패율은 여기서 한 번만 계산한다. 화면마다 나누면 0 으로 나누는 자리가 화면 수만큼 생긴다. */
    public static double rate(long failed, long total) {
        if (total <= 0) return 0;
        return Math.round((failed * 1000.0 / total)) / 10.0;
    }
}
