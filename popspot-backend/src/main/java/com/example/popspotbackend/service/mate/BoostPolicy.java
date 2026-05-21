package com.example.popspotbackend.service.mate;

/**
 * 동행 게시판 상단 부스트 정책. 사용자 스탬프 누적량으로 등급을 결정하고, 등급별 월 한도를
 * 돌려준다.
 *
 * <p>프론트엔드의 {@code src/lib/rank.ts} 와 같은 임계값을 쓴다. 한쪽만 바꾸면 사용자가 보는 등급과 서버가 차감하는 한도가 어긋날 수 있으므로,
 * 임계값 변경 시 양쪽 모두 동시에 갱신할 것.
 */
public final class BoostPolicy {

    /* 등급 임계값 — 프론트 rank.ts 와 동일. */
    public static final int BEGINNER_MIN = 3;
    public static final int HUNTER_MIN = 6;
    public static final int MASTER_MIN = 12;

    /* 등급별 월 부스트 한도. */
    private static final int LIMIT_NONE = 0;
    private static final int LIMIT_BEGINNER = 1;
    private static final int LIMIT_HUNTER = 3;
    private static final int LIMIT_MASTER = 5;

    private BoostPolicy() {
        // util 클래스
    }

    public enum Rank {
        NONE,
        BEGINNER,
        HUNTER,
        MASTER
    }

    /** 스탬프 누적량으로 등급을 결정. */
    public static Rank rankOf(int stampCount) {
        if (stampCount >= MASTER_MIN) return Rank.MASTER;
        if (stampCount >= HUNTER_MIN) return Rank.HUNTER;
        if (stampCount >= BEGINNER_MIN) return Rank.BEGINNER;
        return Rank.NONE;
    }

    /** 해당 등급의 월 부스트 한도. */
    public static int monthlyLimit(Rank rank) {
        return switch (rank) {
            case MASTER -> LIMIT_MASTER;
            case HUNTER -> LIMIT_HUNTER;
            case BEGINNER -> LIMIT_BEGINNER;
            case NONE -> LIMIT_NONE;
        };
    }

    /** 사용자의 현재 월 한도 — rankOf + monthlyLimit 합성. */
    public static int monthlyLimitFor(int stampCount) {
        return monthlyLimit(rankOf(stampCount));
    }
}
