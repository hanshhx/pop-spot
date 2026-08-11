package com.example.popspotbackend.service.crawler;

/**
 * 그 글이 <b>이 팝업에 대해</b> 무엇인지.
 *
 * <p><b>왜 필요한가.</b> 2026-08-11 에 마감일이 없어 색인에서 빠진 팝업 30건의 원문을 열어 봤다. 셋 중 하나는 그 팝업을 다룬 글이 아니었다.
 *
 * <ul>
 *   <li>"[임신 38주]손발 퉁퉁, 주말부부 끝 백수 시작~!" → <b>서면 포켓몬 팝업</b>
 *   <li>"세대와 시대를 잇다: 그림책 100년의 여행" → <b>로스트아크 모코코 팝업</b>
 *   <li>"여름 야호" → <b>설화수 북촌 특별 전시</b>
 * </ul>
 *
 * <p>기존 게이트로는 이걸 못 걸렀다. 신뢰도 0.8 은 "이 팝업이 실재하는가" 를 재는데, 위 경우 팝업은 <b>실재한다</b> — 글쓴이가 진짜 다녀왔다. 모델은 맞게
 * 판단했고, 우리가 묻지 않은 것이 있었을 뿐이다. <b>이 글이 이 팝업을 다루는 글인가.</b>
 *
 * <p>후기까지 버리지는 않는다. 진행 중인 팝업의 후기는 그 팝업이 실재한다는 증거다. 다만 후기는 기간을 적지 않아 — 다녀온 사람은 "8/3~8/17" 이 아니라
 * "다녀왔어요" 라고 쓴다 — 마감일이 비게 되고, 그래서 색인 자격을 얻지 못한다. 그건 자격 판정이 알아서 거른다.
 */
public enum SourceKind {

    /** 팝업을 알리거나 소개하는 글. 기간·장소가 적혀 있을 가능성이 높다. */
    ANNOUNCEMENT,

    /** 다녀온 후기. 팝업이 주제이긴 하다. */
    REVIEW,

    /** 글의 주제는 딴것이고 이 팝업은 스쳐 지나간다. */
    MENTION,

    /** 모델이 값을 주지 않았거나 알아볼 수 없는 값을 줬다. */
    UNKNOWN;

    /**
     * 이 근거로 팝업을 만들어도 되는가.
     *
     * <p>{@link #MENTION} 만 막는다. 나머지는 통과다 — {@link #UNKNOWN} 도 포함이다.
     *
     * <p>UNKNOWN 을 막지 않는 이유: 이 필드는 새로 넣은 것이라, 모델이 값을 빠뜨리는 일이 얼마나 잦은지 아직 모른다. 모르는 것을 막는 쪽으로 기울이면
     * <b>수집이 통째로 멈출 수 있다.</b> 새 검사는 확실히 나쁜 것만 막고 시작한다.
     */
    public boolean acceptable() {
        return this != MENTION;
    }

    /** 모델이 준 문자열을 읽는다. 못 알아보면 {@link #UNKNOWN}. */
    public static SourceKind parse(String raw) {
        if (raw == null) return UNKNOWN;
        String text = raw.trim().toUpperCase(java.util.Locale.ROOT);
        for (SourceKind kind : values()) {
            if (kind != UNKNOWN && kind.name().equals(text)) return kind;
        }
        return UNKNOWN;
    }
}
