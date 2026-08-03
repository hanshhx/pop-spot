package com.example.popspotbackend.config;

/**
 * <b>응답</b>으로 내보내는 개인정보를 가린다.
 *
 * <p>{@link LogSafe} 와 목적이 다르다. LogSafe 는 로그용이라 "장애를 분석할 수 있을 만큼" 만 남기면 되지만, 여기는 화면에 뜨고 사람이 보고 판단하는
 * 값이라 <b>가린 채로도 일이 되어야</b> 한다. 그래서 규칙이 조금 더 관대하다.
 *
 * <p>이 저장소에는 이메일 마스킹이 네 벌 있었다 — {@code LogSafe}, {@code AuthController}, {@code AuthService},
 * {@code EmailService}. 별표 개수마저 달라서 아이디찾기 화면과 관리자 화면이 같은 주소를 다르게 가렸다. 응답용은 이 클래스 하나로 모은다.
 *
 * <p><b>마스킹이 만능이 아니라는 점을 분명히 해 둔다.</b> {@code GET /api/v1/auth/check-email} 이 로그인 없이 "이 이메일이 가입돼
 * 있는가" 에 참/거짓을 답한다(회원가입 중복 확인용). 가려진 주소의 후보를 만들어 그 API 에 물어보면 원문을 확인할 수 있다. 분당 20회 제한이 걸려 있어 비용은
 * 들지만 불가능하지는 않다. 즉 마스킹은 <b>한 번의 조회로 전 회원 명부가 통째로 새는 것</b>을 막는 장치이지, 특정인 한 명을 노린 확인까지 막지는 못한다. 그 구멍을
 * 닫으려면 회원가입 흐름 자체를 "소유를 증명한 뒤에 알려 준다" 로 바꿔야 하고, 그건 제품 결정이라 별건이다.
 */
public final class PiiMask {

    private PiiMask() {}

    /** 4글자 이상이면 앞 2글자를 남긴다. */
    private static final int LONG_LOCAL_MIN = 4;

    /** 3글자면 앞 1글자만. 2글자 이하는 하나도 남기지 않는다. */
    private static final int MEDIUM_LOCAL_MIN = 3;

    private static final String STARS = "****";

    /**
     * {@code hong@naver.com} → {@code ho****@naver.com}.
     *
     * <p><b>도메인은 남긴다.</b> 가입경로(네이버·구글·카카오)를 구분하는 단서이고, "네이버로 가입했는데 구글로 로그인이 안 돼요" 같은 문의를 판별하는 데
     * 쓰인다. 도메인만으로는 개인이 식별되지 않는다.
     *
     * <p>앞부분을 몇 글자 남길지는 길이에 따라 다르다. 짧은 주소에서 고정 개수를 남기면 <b>아무것도 안 가려진다</b> — {@code a@b.c} 에서 1글자를
     * 남기면 원문 그대로이고, {@code 홍@naver.com} 은 이름 한 자가 통째로 남는다. 그래서 2글자 이하는 하나도 남기지 않는다. 짧은 주소는 어차피 뒤에
     * 나올 도메인만으로 후보가 좁혀지므로, 여기서 더 흘릴 이유가 없다.
     */
    public static String email(String email) {
        if (email == null || email.isBlank()) return null;

        int at = email.indexOf('@');
        // '@' 가 없거나 맨 앞이면 이메일 모양이 아니다. 통째로 가린다.
        if (at <= 0) return STARS;

        String local = email.substring(0, at);
        String domain = email.substring(at);

        int keep;
        if (local.length() >= LONG_LOCAL_MIN) keep = 2;
        else if (local.length() == MEDIUM_LOCAL_MIN) keep = 1;
        else keep = 0;

        return local.substring(0, keep) + STARS + domain;
    }

    /**
     * 내부 식별자(UUID)의 앞부분만. {@code 3f1a2b4c-...} → {@code 3f1a2b4c}
     *
     * <p>같은 사람인지 알아보는 데는 이걸로 충분하고, 전체는 화면의 툴팁이나 해제 호출에서만 쓴다.
     */
    public static String idHead(String id) {
        if (id == null || id.isBlank()) return null;
        return id.length() <= 8 ? id : id.substring(0, 8);
    }
}
