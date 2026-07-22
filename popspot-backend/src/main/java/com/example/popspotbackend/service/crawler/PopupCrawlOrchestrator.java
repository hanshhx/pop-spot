package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.CrawlSourceLedger;
import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.PopupPhotoService;
import com.example.popspotbackend.service.SearchService;
import com.example.popspotbackend.service.ai.CrawlerLlm;
import com.example.popspotbackend.service.ai.LlmQuotaExhaustedException;
import com.example.popspotbackend.service.ai.LlmUsageTracker;
import com.example.popspotbackend.service.geocoding.Coordinates;
import com.example.popspotbackend.service.geocoding.GeocodingService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 자동수집 파이프라인 — 검색 API → LLM 정규화 → 신뢰도 검증 → DB 저장.
 *
 * <p>키워드는 "서울 + 카테고리/지역/브랜드" 조합으로 다각도 수집한다. Naver(블로그+뉴스) + Kakao(웹+블로그) 4개 채널의 snippet 을 키워드별로 묶어
 * LLM 에게 한 번씩 정규화 요청 — v2.33 부터 한 번의 호출로 묶음 안의 서로 다른 팝업을 모두 추출한다(수집량 병목 해소). 신뢰도 임계값 이상이면 자동게시
 * (AUTO_PUBLISHED), 미만이면 즉시 폐기 (검수 큐 미사용 — 품질 우선 정책).
 *
 * <p>크롤 1회가 1~2분 걸리므로 {@code @Transactional} 미사용 — 단일 거대 트랜잭션으로 묶으면 DB 커넥션 점유 시간이 길어진다. 각 save()
 * 호출이 Spring Data JPA 의 자동 트랜잭션 단위로 처리된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PopupCrawlOrchestrator {

    private static final long NAVER_KAKAO_API_INTERVAL_MS = 800L;

    /** 키워드당 검색 채널 수 — {@code fetchSnippetsForKeyword} 가 네이버 2(블로그·뉴스) + 카카오 2(웹·블로그)를 호출한다. */
    private static final int NAVER_CHANNELS_PER_KEYWORD = 2;

    private static final int KAKAO_CHANNELS_PER_KEYWORD = 2;
    private static final long GROQ_RPM_THROTTLE_MS = 2200L; // Groq 30 RPM = 2초 간격
    private static final long KAKAO_GEOCODING_INTERVAL_MS = 300L;

    private static final String SOURCE_TYPE_CRAWLED = "CRAWLED";
    private static final String REVIEW_STATUS_AUTO_PUBLISHED = "AUTO_PUBLISHED";
    private static final String DEFAULT_CATEGORY = "ETC";

    private static final Set<String> ALLOWED_CATEGORIES =
            Set.of("FASHION", "FOOD", "CULTURE", "CHARACTER", "BEAUTY", "TECH", "ETC");

    /**
     * 서울 한정 다각도 검색 키워드. 구체적인 브랜드/지역명을 섞어 정확도 ↑. v2.13 부터 80+ 개로 확장 — 정확도 임계값은 그대로 유지하면서 다양성을 늘려
     * 자동게시 통과 row 수를 끌어올림.
     */
    private static final List<String> SEARCH_KEYWORDS =
            List.of(
                    // 일반
                    "서울 팝업스토어",
                    "서울 팝업 일정",
                    "서울 신상 팝업",
                    "서울 팝업 추천",
                    "서울 팝업스토어 오픈",
                    // 지역 (구 단위)
                    "성수동 팝업스토어",
                    "성수 팝업 카페",
                    "강남 팝업스토어",
                    "압구정 팝업",
                    "청담동 팝업",
                    "가로수길 팝업",
                    "홍대 팝업스토어",
                    "합정 팝업",
                    "연남동 팝업",
                    "이태원 팝업스토어",
                    "한남동 팝업",
                    "명동 팝업스토어",
                    "삼청동 팝업",
                    "잠실 팝업스토어",
                    "여의도 팝업스토어",
                    "신촌 팝업스토어",
                    // 백화점/대형 시설
                    "더현대 팝업스토어",
                    "더현대 서울 팝업",
                    "롯데월드몰 팝업스토어",
                    "코엑스 팝업스토어",
                    "신세계 팝업스토어",
                    "갤러리아 팝업",
                    "용산 아이파크몰 팝업",
                    "스타필드 팝업",
                    "현대백화점 팝업",
                    "롯데백화점 팝업",
                    "타임스퀘어 팝업",
                    // K-패션 브랜드
                    "젠틀몬스터 팝업",
                    "탬버린즈 팝업",
                    "마뗑킴 팝업스토어",
                    "스튜디오톰보이 팝업",
                    "무신사스탠다드 팝업",
                    "디스이즈네버댓 팝업",
                    "아디다스 팝업스토어",
                    "나이키 팝업스토어 서울",
                    "널디 팝업",
                    "키르시 팝업",
                    "마르디메크르디 팝업",
                    // 캐릭터/IP
                    "포켓몬 팝업스토어 서울",
                    "산리오 팝업스토어",
                    "디즈니 팝업스토어 서울",
                    "카카오프렌즈 팝업",
                    "라인프렌즈 팝업",
                    "헬로키티 팝업",
                    "짱구 팝업",
                    "원피스 팝업",
                    "지브리 팝업스토어",
                    "마블 팝업스토어 서울",
                    "산리오 캐릭터즈 팝업",
                    "위베어베어스 팝업",
                    // 애니메이션 / 게임 IP
                    "원신 팝업 서울",
                    "젠레스존제로 팝업",
                    "니지산지 팝업",
                    "주술회전 팝업",
                    // K-뷰티
                    "올리브영 팝업스토어",
                    "이니스프리 팝업",
                    "라네즈 팝업",
                    "닥터자르트 팝업",
                    "에뛰드 팝업",
                    "어뮤즈 팝업",
                    // F&B / 디저트
                    "스타벅스 팝업 서울",
                    "투썸 팝업",
                    "노티드 팝업",
                    "노티드도넛 팝업",
                    "런던베이글뮤지엄 팝업",
                    "도산공원 디저트 팝업",
                    "프릳츠 팝업",
                    "블루보틀 팝업 서울",
                    // K-pop / 엔터
                    "BTS 팝업스토어",
                    "뉴진스 팝업",
                    "아이브 팝업",
                    "에스파 팝업",
                    "스트레이키즈 팝업",
                    "세븐틴 팝업",
                    "라이즈 팝업",
                    "투바투 팝업",
                    // 럭셔리 / 콜라보
                    "디올 팝업 서울",
                    "샤넬 팝업 서울",
                    "루이비통 팝업스토어 서울",
                    "프라다 팝업",
                    "버버리 팝업스토어 서울",
                    // 카테고리
                    "패션 팝업스토어 서울",
                    "뷰티 팝업스토어 서울",
                    "캐릭터 팝업스토어 서울",
                    "콜라보 팝업 서울",
                    "전시 팝업스토어 서울",
                    // === 확장: 자주 찾는 키워드 ===
                    // 지역 (추가)
                    "서울숲 팝업",
                    "을지로 팝업",
                    "익선동 팝업",
                    "서촌 팝업",
                    "신사동 팝업",
                    "건대 팝업",
                    "강남역 팝업",
                    "고속터미널 팝업",
                    "뚝섬 팝업",
                    // 백화점/몰 (추가)
                    "롯데월드타워 팝업",
                    "스타필드 하남 팝업",
                    "파르나스몰 팝업",
                    "IFC몰 팝업 서울",
                    "현대프리미엄아울렛 팝업",
                    // K-패션 (추가)
                    "아더에러 팝업",
                    "마리떼프랑소와저버 팝업",
                    "커버낫 팝업",
                    "이미스 팝업",
                    "뉴발란스 팝업스토어",
                    "살로몬 팝업",
                    "어그 팝업",
                    "메종키츠네 팝업",
                    "우영미 팝업",
                    "락피쉬 팝업",
                    "스톤아일랜드 팝업",
                    // K-뷰티 (추가)
                    "클리오 팝업",
                    "롬앤 팝업",
                    "조말론 팝업 서울",
                    "논픽션 팝업",
                    "이솝 팝업 서울",
                    "헤라 팝업",
                    "설화수 팝업",
                    "정샘물 팝업",
                    "페리페라 팝업",
                    // 캐릭터/IP (추가)
                    "티니핑 팝업",
                    "잔망루피 팝업",
                    "벨리곰 팝업",
                    "쿠로미 팝업",
                    "시나모롤 팝업",
                    "마이멜로디 팝업",
                    "미피 팝업",
                    "스누피 팝업",
                    "무민 팝업",
                    "곰돌이푸 팝업",
                    "슬램덩크 팝업",
                    "명탐정코난 팝업",
                    "스파이패밀리 팝업",
                    "귀멸의칼날 팝업",
                    "망그러진곰 팝업",
                    // 애니메이션/게임 IP (추가)
                    "블루아카이브 팝업",
                    "명일방주 팝업",
                    "붕괴스타레일 팝업",
                    "메이플스토리 팝업",
                    "로블록스 팝업",
                    "리그오브레전드 팝업",
                    // F&B/디저트 (추가)
                    "배스킨라빈스 팝업",
                    "공차 팝업",
                    "메가커피 팝업",
                    "카멜커피 팝업",
                    "나이스웨더 팝업",
                    "다운타우너 팝업",
                    "성수연방 팝업",
                    "노티드월드 팝업",
                    // K-pop/엔터 (추가)
                    "르세라핌 팝업",
                    "아일릿 팝업",
                    "엔하이픈 팝업",
                    "있지 팝업",
                    "데이식스 팝업",
                    "제로베이스원 팝업",
                    "베이비몬스터 팝업",
                    "플레이브 팝업",
                    "블랙핑크 팝업",
                    "트와이스 팝업",
                    "엑소 팝업",
                    "NCT 팝업",
                    // 럭셔리/콜라보 (추가)
                    "구찌 팝업 서울",
                    "에르메스 팝업",
                    "발렌시아가 팝업",
                    "몽클레어 팝업",
                    "셀린느 팝업",
                    "생로랑 팝업",
                    // 일반/카테고리 (추가)
                    "서울 신상 팝업 오픈",
                    "이번주 팝업 서울",
                    "주말 팝업 서울",
                    "굿즈 팝업 서울",
                    "체험형 팝업 서울",
                    "전시회 팝업 서울",
                    "웹툰 팝업 서울",
                    "게임 팝업스토어 서울",
                    "리빙 팝업 서울",
                    // 검색 트렌드 IP (브랜드 랜딩페이지용 — 실제 수집돼야 랜딩이 thin 안 됨)
                    "스텔라이브 팝업",
                    "오버워치 팝업스토어",
                    "니케 팝업스토어",
                    "프로젝트 세카이 팝업",
                    "프세카 팝업",
                    "T1 팝업스토어",
                    "디맥 팝업",
                    "하츠네 미쿠 팝업",
                    "던전밥 팝업",
                    "오아시스 팝업",
                    "디지몬 팝업 서울",
                    // 2026-07-15 트렌드 신규 — 좀비고는 "팝업 스토어" 다음가는 검색량(35)으로 급상승.
                    "좀비고 팝업",
                    "좀비고 팝업스토어",
                    "좀비고등학교 팝업",
                    "김햄찌 팝업",
                    "롤체 팝업",
                    "롤토체스 팝업",
                    "옵치 팝업",
                    "AK플라자 팝업",
                    // ===== 2026-07 대폭 확장 — 수집 커버리지를 넓혀 놓치던 팝업을 끌어올린다 =====
                    // 키워드 1개당 LLM 1회(2.2s) 라 500개여도 회당 ~18분. 크론이라 부담 없음.
                    // 동네 단위 (구 단위보다 실제 검색·게시글 표현에 가깝다)
                    "서울숲 팝업",
                    "연무장길 팝업",
                    "뚝섬 팝업",
                    "왕십리 팝업",
                    "건대 팝업",
                    "성북 팝업",
                    "대학로 팝업",
                    "혜화 팝업",
                    "신촌 팝업",
                    "이대 팝업",
                    "목동 팝업",
                    "문래 팝업",
                    "영등포 팝업",
                    "여의도 팝업스토어",
                    "노원 팝업",
                    "수유 팝업",
                    "사당 팝업",
                    "신림 팝업",
                    "서초 팝업",
                    "반포 팝업",
                    "논현 팝업",
                    "역삼 팝업",
                    "선릉 팝업",
                    "대치 팝업",
                    "잠원 팝업",
                    "방배 팝업",
                    "마곡 팝업",
                    "상암 팝업",
                    "은평 팝업",
                    "석촌 팝업",
                    "송파 팝업",
                    "위례 팝업",
                    "익선동 팝업",
                    "을지로 팝업",
                    "종로 팝업",
                    "광화문 팝업",
                    "인사동 팝업",
                    "경리단길 팝업",
                    "삼각지 팝업",
                    "망원 팝업",
                    "상수 팝업",
                    // 백화점 / 몰 / 팝업 전용 공간
                    "더현대 서울 팝업",
                    "여의도 더현대 팝업",
                    "신세계 강남 팝업",
                    "신세계 본점 팝업",
                    "롯데백화점 잠실 팝업",
                    "롯데 명동 팝업",
                    "현대백화점 판교 팝업",
                    "현대 무역센터 팝업",
                    "갤러리아 팝업",
                    "타임스퀘어 팝업",
                    "IFC몰 팝업",
                    "코엑스몰 팝업",
                    "스타필드 코엑스 팝업",
                    "스타필드 하남 팝업",
                    "스타필드 고양 팝업",
                    "롯데월드몰 팝업",
                    "롯데월드 팝업",
                    "용산 아이파크몰 팝업스토어",
                    "홍대 AK& 팝업",
                    "성수 에스팩토리 팝업",
                    "성수 코사이어티 팝업",
                    "언더스탠드에비뉴 팝업",
                    "더현대 팝업스토어",
                    // 캐릭터 (산리오·카카오·라인 외 인기 IP)
                    "짱구 팝업",
                    "짱구는 못말려 팝업",
                    "케로로 팝업",
                    "도라에몽 팝업",
                    "스누피 팝업",
                    "무민 팝업",
                    "미피 팝업",
                    "리락쿠마 팝업",
                    "쿠로미 팝업",
                    "마이멜로디 팝업",
                    "시나모롤 팝업",
                    "폼폼푸린 팝업",
                    "헬로키티 팝업",
                    "어피치 팝업",
                    "라이언 팝업",
                    "춘식이 팝업",
                    "최고심 팝업",
                    "잔망루피 팝업",
                    "루피 팝업",
                    "뽀로로 팝업",
                    "몰랑 팝업",
                    "망그러진 곰 팝업",
                    "곰돌이 푸 팝업",
                    "미키마우스 팝업",
                    "미니언즈 팝업",
                    "토토로 팝업",
                    "지브리 팝업",
                    // 애니 / 만화
                    "원피스 팝업스토어",
                    "나루토 팝업",
                    "하이큐 팝업",
                    "블루록 팝업",
                    "체인소맨 팝업",
                    "스파이 패밀리 팝업",
                    "진격의 거인 팝업",
                    "에반게리온 팝업",
                    "건담 팝업",
                    "슬램덩크 팝업",
                    "도쿄 리벤저스 팝업",
                    "귀멸의 칼날 팝업스토어",
                    "주술회전 팝업스토어",
                    // 게임
                    "마리오 팝업",
                    "젤다 팝업",
                    "커비 팝업",
                    "동물의 숲 팝업",
                    "스플래툰 팝업",
                    "젠레스 존 제로 팝업",
                    "붕괴 스타레일 팝업",
                    "우마무스메 팝업",
                    "페이트 그랜드 오더 팝업",
                    "메이플스토리 팝업",
                    "던전앤파이터 팝업",
                    "로스트아크 팝업",
                    "발로란트 팝업",
                    "리그 오브 레전드 팝업",
                    "롤 팝업스토어",
                    "배틀그라운드 팝업",
                    "마인크래프트 팝업",
                    "쿠키런 팝업",
                    "브롤스타즈 팝업",
                    "카트라이더 팝업",
                    "블루아카이브 팝업스토어",
                    "원신 팝업스토어",
                    // K-pop
                    "뉴진스 팝업",
                    "아이브 팝업",
                    "르세라핌 팝업",
                    "에스파 팝업",
                    "블랙핑크 팝업",
                    "방탄소년단 팝업",
                    "BTS 팝업스토어",
                    "세븐틴 팝업",
                    "스트레이키즈 팝업",
                    "투모로우바이투게더 팝업",
                    "엔하이픈 팝업",
                    "NCT 팝업",
                    "라이즈 팝업",
                    "보이넥스트도어 팝업",
                    "제로베이스원 팝업",
                    "있지 팝업",
                    "트와이스 팝업",
                    "레드벨벳 팝업",
                    "아이유 팝업",
                    "지드래곤 팝업",
                    "케이팝 팝업스토어 서울",
                    "아이돌 팝업스토어",
                    // 패션 / 뷰티 브랜드
                    "나이키 팝업",
                    "아디다스 팝업",
                    "뉴발란스 팝업",
                    "컨버스 팝업",
                    "반스 팝업",
                    "아식스 팝업",
                    "살로몬 팝업",
                    "룰루레몬 팝업",
                    "노스페이스 팝업",
                    "아크테릭스 팝업",
                    "무신사 팝업",
                    "마뗑킴 팝업",
                    "마르디 메크르디 팝업",
                    "아더에러 팝업",
                    "젠틀몬스터 팝업",
                    "탬버린즈 팝업",
                    "논픽션 팝업",
                    "이솝 팝업",
                    "조말론 팝업",
                    "샤넬 팝업",
                    "디올 팝업",
                    "구찌 팝업",
                    "프라다 팝업",
                    "루이비통 팝업",
                    "발렌시아가 팝업",
                    "미우미우 팝업",
                    "셀린느 팝업",
                    "로에베 팝업",
                    "자크뮈스 팝업",
                    "아미 팝업",
                    "메종키츠네 팝업",
                    "캘빈클라인 팝업",
                    "러쉬 팝업",
                    "이니스프리 팝업",
                    "올리브영 팝업",
                    "다이소 팝업",
                    "무인양품 팝업",
                    "이케아 팝업",
                    "애플 팝업",
                    "다이슨 팝업",
                    // F&B
                    "스타벅스 팝업",
                    "블루보틀 팝업",
                    "노티드 팝업",
                    "런던베이글 팝업",
                    "카멜커피 팝업",
                    "배스킨라빈스 팝업",
                    "크리스피크림 팝업",
                    "디저트 팝업 서울",
                    "베이커리 팝업 서울",
                    "주류 팝업 서울",
                    // 시점 / 패턴 (새로 뜨는 팝업을 빨리 잡는다)
                    "오늘 오픈 팝업",
                    "이번주 팝업스토어",
                    "주말 팝업스토어 서울",
                    "서울 팝업 일정",
                    "신규 오픈 팝업스토어",
                    "오픈 예정 팝업",
                    "서울 팝업 캘린더",
                    "이번달 팝업스토어",
                    "여름 팝업스토어",
                    "한정판 굿즈 팝업",
                    "콜라보 팝업스토어",
                    "브랜드 팝업스토어 서울",
                    "체험형 팝업스토어 서울",
                    "포토존 팝업스토어",
                    // v2.34 — 프론트 BRANDS 랜딩이 있는데 크롤 키워드가 없어 '영구 0곳' 이던 IP 보강.
                    // 랜딩만 만들고 수집을 안 하면 thin-content noindex 로 남아 SEO 가 회수되지 않는다.
                    "전독시 팝업",
                    "전지적 독자 시점 팝업",
                    "외모지상주의 팝업",
                    "외지주 팝업",
                    "하츠투하츠 팝업",
                    "에일리언 스테이지 팝업",
                    "큐티 스트리트 팝업",
                    "괴담출근 팝업",
                    "미니브 팝업",
                    "안경만두 팝업",
                    "가나디 팝업",
                    "라테일 팝업",
                    "스트릿 레스토랑 파이터 팝업",
                    "은혼 팝업",
                    "헬스키친 팝업",
                    "스파이더맨 팝업",
                    "프로미스나인 팝업",
                    "요아소비 팝업",
                    "프로젝트아이 팝업",
                    "오프사이드 팝업",
                    "토이스토리 팝업",
                    "명조 팝업",
                    "치이카와 팝업",
                    "죠죠 팝업",
                    "꿈빛 파티시엘 팝업",
                    "엔믹스 팝업",
                    "요루시카 팝업",
                    "세가 팝업");

    private final NaverPopupCrawler naverCrawler;
    private final KakaoPopupCrawler kakaoCrawler;
    private final PopupNormalizationService normalizer;
    private final PopupStoreRepository popupStoreRepository;
    private final GeocodingService geocodingService;
    private final SearchService searchService;
    private final PopupPhotoService popupPhotoService;
    private final LlmUsageTracker usageTracker;
    private final CrawlSourceLedgerService ledgerService;
    private final CrawlCursorService cursorService;
    private final SearchApiBudgetTracker searchApiBudget;
    private final CrawlerLlm crawlerLlm;

    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    /** 자동게시 목표치 — 이 수에 도달하면 LLM 호출/시간 절약을 위해 조기 종료. 0 이면 제한 없음. */
    @Value("${popspot.crawler.max-auto-published:0}")
    private int maxAutoPublished;

    /**
     * 한 회차에 다룰 키워드 수. 커서 위치부터 이만큼만 검색·처리하고 커서를 전진시킨다.
     *
     * <p>무료 티어의 분당 토큰(TPM 8000)이 한 호출로 거의 소진돼 회차당 실제 LLM 성공 호출은 십수 회가 한계다. 전체 키워드(≈390)를 한 회차에 다 돌면
     * 앞부분에서 rate limit 으로 멈추고 뒤는 버려진다. 감당 가능한 만큼만 잘라 여러 회차에 나눠 순회한다. 하루 2회차 기준 이 값 × 2 만큼 매일 전진한다.
     */
    @Value("${popspot.crawler.max-keywords-per-run:20}")
    private int maxKeywordsPerRun;

    /** 날짜 결손 원문을 회차마다 재시도 큐에 넣는 최대 수와 동일 원문 재시도 간격. */
    @Value("${popspot.crawler.date-backfill-limit:25}")
    private int dateBackfillLimit;

    @Value("${popspot.crawler.date-backfill-cooldown-days:7}")
    private int dateBackfillCooldownDays;

    /** 전체 크롤 1회 실행. 처리 통계를 맵으로 반환. */
    public Map<String, Integer> runOnce() {
        if (areAllCrawlersUnconfigured()) {
            log.warn("[PopupCrawlOrchestrator] Naver/Kakao 둘 다 미설정 → 실행 스킵");
            return Map.of("skipped", 1);
        }
        // 정규화가 어차피 막혀 있으면 검색 API 쿼터를 쓸 이유가 없다. 수집을 완주한 뒤 첫 키워드에서
        // 멈추면 키워드 × 4채널(≈1,600회) 호출과 슬립 5~10분을 통째로 버리게 된다.
        if (usageTracker.isDailyQuotaExhausted(LlmUsageTracker.Role.CRAWLER)
                && !crawlerLlm.hasAvailableLocal()) {
            log.warn("[PopupCrawlOrchestrator] QUOTA_EXHAUSTED 상태 — 수집 자체를 스킵");
            return Map.of("skippedQuota", 1);
        }

        CrawlStatistics stats = new CrawlStatistics();
        stats.dateSourcesQueued = queueMissingDateSources();
        Map<String, List<PopupCrawlSource>> snippetsByKeyword = collectSnippetsByKeyword(stats);
        processNormalizationAndSave(snippetsByKeyword, stats);

        Map<String, Integer> result = stats.toMap();
        log.info("[PopupCrawlOrchestrator] 통계 = {}", result);
        return result;
    }

    /**
     * 기존 날짜 결손 행의 원문을 제한적으로 RETRYABLE 처리한다. 다음 검색 결과에 그 URL이 나타날 때만 LLM을 다시 타므로 전체 ledger 초기화보다
     * 안전하다.
     */
    private int queueMissingDateSources() {
        int limit = Math.max(1, dateBackfillLimit);
        List<String> sourceUrls =
                popupStoreRepository.findCrawledMissingDates().stream()
                        .map(PopupStore::getSourceUrl)
                        .toList();
        int queued =
                ledgerService.requeueDateBackfill(
                        sourceUrls,
                        LocalDateTime.now().minusDays(Math.max(1, dateBackfillCooldownDays)),
                        limit);
        if (queued > 0) {
            log.info("[Date-Backfill] 날짜 결손 원문 {}건 재처리 큐 등록", queued);
        }
        return queued;
    }

    /** 좌표 누락된 자동수집 row 를 일괄 backfill. admin 이 1회 호출. */
    public int geocodeMissing() {
        List<PopupStore> targets = popupStoreRepository.findCrawledMissingCoordinates();
        if (targets.isEmpty()) {
            log.info("[Geocode-Backfill] 대상 없음");
            return 0;
        }

        log.info("[Geocode-Backfill] 시작 — 대상 {}개", targets.size());
        int filledCount = 0;
        for (PopupStore popup : targets) {
            if (fillCoordinates(popup)) filledCount++;
            sleepQuietly(KAKAO_GEOCODING_INTERVAL_MS);
        }
        log.info("[Geocode-Backfill] 완료 — {}/{}개 좌표 채움", filledCount, targets.size());
        return filledCount;
    }

    /* =========================== 수집 단계 =========================== */

    private boolean areAllCrawlersUnconfigured() {
        return !naverCrawler.isConfigured() && !kakaoCrawler.isConfigured();
    }

    private Map<String, List<PopupCrawlSource>> collectSnippetsByKeyword(CrawlStatistics stats) {
        // 키워드 목록은 append-only 로 자라서 확장 블록이 기존 항목과 겹치기 쉽다(실제로 51개 중복 발생).
        // 중복 키워드는 같은 검색을 두 번 돌려 API 쿼터·실행시간만 축내므로 순서를 유지한 채 dedup 한다.
        List<String> keywords = new ArrayList<>(new LinkedHashSet<>(SEARCH_KEYWORDS));
        int total = keywords.size();
        int cursor = cursorService.currentCursor(total);
        int batchSize = Math.min(Math.max(maxKeywordsPerRun, 1), total);

        // LinkedHashMap — 커서로 정한 처리 순서를 보존한다. 중단이 생기면 "어디까지 처리했는지" 가
        // 순서에 의존하므로 유지해야 한다.
        Map<String, List<PopupCrawlSource>> grouped = new LinkedHashMap<>();
        int covered = 0;
        for (int i = 0; i < batchSize; i++) {
            // 검색 API 일일 예산(기본 한도의 50%)을 넘기기 전에 멈춘다. 로컬 LLM 으로 크롤이 무제한이 되면
            // 검색이 새 병목이라, 한도 초과로 크롤 자체가 막히는 것을 막는다.
            if (!searchApiBudget.withinBudget(
                    NAVER_CHANNELS_PER_KEYWORD, KAKAO_CHANNELS_PER_KEYWORD)) {
                log.warn(
                        "[PopupCrawlOrchestrator] 검색 API 예산 도달 — 이번 회차 조기 종료."
                                + " 네이버 {}/{}, 카카오 {}/{}",
                        searchApiBudget.naverUsed(),
                        searchApiBudget.naverCap(),
                        searchApiBudget.kakaoUsed(),
                        searchApiBudget.kakaoCap());
                stats.searchBudgetExhausted = 1;
                break;
            }
            String keyword = keywords.get(Math.floorMod(cursor + i, total));
            List<PopupCrawlSource> snippets = fetchSnippetsForKeyword(keyword);
            // 키워드당 네이버 2채널(블로그·뉴스) + 카카오 2채널(웹·블로그).
            searchApiBudget.record(NAVER_CHANNELS_PER_KEYWORD, KAKAO_CHANNELS_PER_KEYWORD);
            stats.totalSnippets += snippets.size();
            grouped.computeIfAbsent("kw:" + keyword, k -> new ArrayList<>()).addAll(snippets);
            sleepQuietly(NAVER_KAKAO_API_INTERVAL_MS);
            covered++;
        }

        // 실제 검색한 키워드 수만큼 커서를 전진시킨다(독립 트랜잭션). 예산 초과로 중간에 멈추면 covered <
        // batchSize 라, 남은 구간은 다음 회차가 이어받는다. LLM 처리가 rate limit 으로 뒤이어 죽어도
        // 커서는 이미 커밋돼 있다.
        cursorService.advance(covered, total);
        stats.keywordsTotal = total;
        stats.keywordsCovered = covered;
        stats.keywordCursorStart = cursor;
        return grouped;
    }

    private List<PopupCrawlSource> fetchSnippetsForKeyword(String keyword) {
        // v2.33 — 4개 채널을 라운드로빈으로 교차 배치. 앞 N개(정규화 상한)만 LLM 에 들어가므로 순차 concat 하면
        // 네이버 블로그에만 편향된다. 교차 배치로 4개 소스가 골고루 섞이고 sourceIndex 매핑 순서도 고정된다.
        return interleave(
                List.of(
                        naverCrawler.searchBlog(keyword),
                        naverCrawler.searchNews(keyword),
                        kakaoCrawler.searchWeb(keyword),
                        kakaoCrawler.searchBlog(keyword)));
    }

    /** 여러 소스 목록을 라운드로빈으로 교차 병합. [a0, b0, c0, d0, a1, b1, ...] */
    private List<PopupCrawlSource> interleave(List<List<PopupCrawlSource>> lists) {
        List<PopupCrawlSource> merged = new ArrayList<>();
        int maxSize = lists.stream().mapToInt(List::size).max().orElse(0);
        for (int i = 0; i < maxSize; i++) {
            for (List<PopupCrawlSource> list : lists) {
                if (i < list.size()) merged.add(list.get(i));
            }
        }
        return merged;
    }

    /* =========================== 정규화 + 저장 단계 =========================== */

    private void processNormalizationAndSave(
            Map<String, List<PopupCrawlSource>> grouped, CrawlStatistics stats) {
        boolean isFirstCall = true;
        int processedKeywords = 0;
        // 회차 전체에서 이미 넘기기로 한 URL. 키워드 A·B 결과에 같은 글이 있으면 한 번만 보낸다.
        Set<String> seenInThisRun = new HashSet<>();

        for (Map.Entry<String, List<PopupCrawlSource>> entry : grouped.entrySet()) {
            if (shouldStopEarly(stats)) break;

            List<PopupCrawlSource> rawSnippets = entry.getValue();
            if (rawSnippets.isEmpty()) continue;

            // LLM 에 넘기기 전에 "이미 본 글" 을 걸러낸다. 이 단계가 무료 운영의 핵심 —
            // 같은 블로그 글을 매 회차 다시 해석하면 새 글을 보기도 전에 토큰 예산이 바닥난다.
            CrawlSourceLedgerService.FilterResult filtered =
                    ledgerService.filterFresh(rawSnippets, seenInThisRun);
            stats.skippedKnown += filtered.alreadyProcessed();
            stats.skippedDuplicate += filtered.duplicateInRun();

            // "오늘도 검색에 나왔다" 는 사실은 새 글 포함 여부와 무관하게 남긴다. 이걸 아래 isEmpty
            // 분기 안에만 두면, 새 글이 하나라도 섞인 배치에서는 아는 글의 관측 시각이 멈춰
            // 90일 뒤 정리 대상이 되고 결국 다시 LLM 을 타게 된다.
            ledgerService.touchSeen(ledgerService.hashesOf(rawSnippets));

            if (filtered.isEmpty()) continue;

            // 프롬프트에 실제로 들어갈 목록만 들고 간다. 키워드당 스니펫은 4채널 × 30 = 최대 120건인데
            // LLM 은 앞 40개만 본다. 잘려 나간 것까지 PROCESSED 로 기록하면 읽지도 않은 글이 영영
            // 후보에서 사라진다. 남겨 두면 다음 회차에 자연히 앞으로 올라온다.
            List<PopupCrawlSource> snippets = normalizer.limitFor(filtered.fresh());

            if (!isFirstCall) sleepQuietly(GROQ_RPM_THROTTLE_MS);
            isFirstCall = false;

            // v2.33 — 한 키워드 묶음에서 서로 다른 팝업을 여러 개 추출(LLM 호출은 키워드당 1회 유지).
            PopupNormalizationService.NormalizationBatch normalization;
            try {
                normalization = normalizer.normalizeBatch(snippets);
            } catch (LlmQuotaExhaustedException e) {
                // 일일 한도는 그날 회복되지 않는다. 남은 키워드를 계속 돌리면 429 만 더 맞고 끝난다.
                stats.quotaExhausted = 1;
                log.error(
                        "[PopupCrawlOrchestrator] QUOTA_EXHAUSTED — 크롤 중단({})."
                                + " 이번 회차 처리 키워드 {}개(구간 {}~ / 전체 {}개), 성공 LLM 호출 {}회."
                                + " 커서는 이미 전진했으므로 다음 회차는 다음 구간부터 시작한다.",
                        e.getMessage(),
                        processedKeywords,
                        stats.keywordCursorStart,
                        stats.keywordsTotal,
                        stats.llmCalls);
                break;
            } catch (PopupNormalizationService.LlmCallFailedException e) {
                // 이 키워드만 실패. 성공 카운터를 올리지 않는 것이 핵심 — 예전엔 실패도 llmCalls 로 세어
                // "호출은 됐는데 결과가 없다" 처럼 보였다.
                // 다음 회차에 다시 시도하도록 RETRYABLE 로 남긴다(처리했다고 표시하면 영영 못 본다).
                ledgerService.markProcessed(
                        snippets, CrawlSourceLedger.STATUS_RETRYABLE, e.modelName());
                processedKeywords++;
                continue;
            }
            stats.llmCalls++;
            processedKeywords++;

            // 후보를 전부 저장한 뒤에 대장을 확정한다. 자동게시 상한(maxAutoPublished)에 걸려 중간에
            // 멈추면 남은 후보는 저장되지 않는데, 원문을 먼저 PROCESSED 로 찍어 두면 그 후보들은
            // 다음 회차에도 다시 읽히지 않아 영영 사라진다.
            boolean allCandidatesHandled = true;
            for (NormalizedPopup candidate : normalization.popups()) {
                if (shouldStopEarly(stats)) {
                    allCandidatesHandled = false;
                    break;
                }
                stats.normalized++;
                handleNormalizedResult(candidate, snippets, stats);
            }

            // 끝까지 처리했으면 PROCESSED. 결과가 비어도 PROCESSED 다 — "이 글에는 팝업이 없다" 도
            // 유효한 결론이고 같은 글을 다시 해석할 이유가 없다.
            // 중간에 멈췄으면 RETRYABLE 로 남겨 다음 회차가 이어받게 한다.
            ledgerService.markProcessed(
                    snippets,
                    allCandidatesHandled
                            ? CrawlSourceLedger.STATUS_PROCESSED
                            : CrawlSourceLedger.STATUS_RETRYABLE,
                    normalization.modelName());

            if (!allCandidatesHandled) break;
        }
        usageTracker.logSummary(LlmUsageTracker.Role.CRAWLER);
        log.info(
                "[PopupCrawlOrchestrator] 선중복제거 — 기존 처리분 {}건, 회차 내 중복 {}건 스킵 (LLM 호출 {}회)",
                stats.skippedKnown,
                stats.skippedDuplicate,
                stats.llmCalls);
        ledgerService.pruneStale();
    }

    private boolean shouldStopEarly(CrawlStatistics stats) {
        if (maxAutoPublished <= 0 || stats.autoPublished < maxAutoPublished) return false;
        log.info(
                "[PopupCrawlOrchestrator] 자동게시 목표 {}개 달성 → 조기 종료 (LLM 호출 {}회)",
                maxAutoPublished,
                stats.llmCalls);
        return true;
    }

    private void handleNormalizedResult(
            NormalizedPopup result, List<PopupCrawlSource> snippets, CrawlStatistics stats) {
        if (isInvalidResult(result)) {
            stats.rejected++;
            log.debug("[PopupCrawlOrchestrator] 정규화 거부: {}", result.getError());
            return;
        }
        if (result.getConfidence() < confidenceThreshold) {
            stats.rejected++;
            log.debug(
                    "[PopupCrawlOrchestrator] 신뢰도 미달 폐기: {} (confidence={}, threshold={})",
                    result.getName(),
                    result.getConfidence(),
                    confidenceThreshold);
            return;
        }

        String externalId =
                computeExternalId(result.getName(), result.getLocation(), result.getStartDate());

        if (markDuplicateAsSeen(externalId, result)) {
            stats.duplicates++;
            return;
        }

        // 날짜 점진 보강: 이 결과가 유효 startDate 를 담았는데(= 위 external_id 조회를 빗나간 케이스), 같은 이름·위치의
        // 기존 null-date row 가 있으면 새 row 를 만들지 말고 그 row 의 빈 날짜만 채운다. external_id 가 startDate 를
        // 포함해, 예전엔 이 경우가 중복 row 를 만들고 dedup 이 dated row 를 숨겨 날짜를 유실시켰다. 추측은 없다 —
        // result 의 날짜는 STRICT 파싱 + 역전검증을 통과한 값이다.
        if (result.getStartDate() != null && backfillMissingDates(result, externalId)) {
            stats.datesBackfilled++;
            return;
        }

        saveNewPopup(result, pickPrimarySource(snippets, result.getSourceIndex()), externalId);
        stats.autoPublished++;
    }

    /** sourceIndex(1-based) 로 근거 snippet 을 고르고, null 이거나 범위를 벗어나면 첫 snippet 으로 대체. */
    private PopupCrawlSource pickPrimarySource(
            List<PopupCrawlSource> snippets, Integer sourceIndex) {
        if (sourceIndex != null && sourceIndex >= 1 && sourceIndex <= snippets.size()) {
            return snippets.get(sourceIndex - 1);
        }
        return snippets.get(0);
    }

    private boolean isInvalidResult(NormalizedPopup result) {
        return result.getError() != null
                || result.getConfidence() == null
                || result.getName() == null
                || result.getName().isBlank();
    }

    private boolean markDuplicateAsSeen(String externalId, NormalizedPopup result) {
        Optional<PopupStore> existing = popupStoreRepository.findByExternalId(externalId);
        if (existing.isEmpty()) return false;

        PopupStore popup = existing.get();
        popup.setLastSeenAt(LocalDateTime.now());

        // startDate 는 external_id 의 일부라 이미 일치한다. 다만 endDate 가 비어 있던 기존 row 는, 이번 재크롤이
        // 유효 endDate 를 담았으면 그 빈칸만 채운다(추측 아님 — STRICT 통과값). 기존 값은 절대 덮지 않는다.
        // 새 endDate 가 기존 startDate 보다 앞서 역전이 되면 채우지 않는다 — 어느 쪽이 틀렸는지 알 수 없으니
        // row 를 훼손하지 않고 그대로 둔다.
        boolean enriched = false;
        if (isBlank(popup.getEndDate())
                && result.getEndDate() != null
                && !isInverted(popup.getStartDate(), result.getEndDate())) {
            popup.setEndDate(result.getEndDate());
            enriched = true;
        }

        popupStoreRepository.save(popup);
        if (enriched) {
            reindexQuietly(popup);
            log.info(
                    "[DateBackfill] 기존 row endDate 보강 id={} endDate={}",
                    popup.getId(),
                    result.getEndDate());
        }
        return true;
    }

    /**
     * 같은 이름·위치의 기존 null-date row 를 찾아 빈 날짜만 채운다. 채웠으면 true(신규 삽입 스킵).
     *
     * <p>external_id 를 새 날짜 반영값으로 재설정해, 다음 재크롤이 {@link #markDuplicateAsSeen} 경로로 정상 매치되게 한다. unique
     * 충돌은 없다 — 호출부에서 이미 findByExternalId(newExternalId) 가 비어 있음을 확인한 분기다.
     *
     * <p>새 startDate 가 기존 row 의 endDate 보다 뒤라 역전이 되면 in-place 갱신을 포기한다(false 반환). 어느 값이 틀렸는지 알 수 없어
     * 기존 row 를 훼손하는 대신, 호출부가 일반 경로로 자기정합적인(자체 start/end 는 정규화 단계 역전검증을 통과함) 새 row 를 만들게 둔다.
     */
    private boolean backfillMissingDates(NormalizedPopup result, String newExternalId) {
        List<PopupStore> targets =
                popupStoreRepository.findCrawledMissingStartDate(
                        normalizePart(result.getName()), normalizePart(result.getLocation()));
        if (targets.isEmpty()) return false;

        PopupStore existing = targets.get(0);
        String newStart = result.getStartDate();
        String finalEnd =
                isBlank(existing.getEndDate()) ? result.getEndDate() : existing.getEndDate();
        if (isInverted(newStart, finalEnd)) {
            log.warn(
                    "[DateBackfill] 역전 감지 — 백필 건너뜀 id={} newStart={} end={}",
                    existing.getId(),
                    newStart,
                    finalEnd);
            return false;
        }

        existing.setStartDate(newStart);
        if (isBlank(existing.getEndDate()) && result.getEndDate() != null) {
            existing.setEndDate(result.getEndDate());
        }
        existing.setExternalId(newExternalId);
        existing.setLastSeenAt(LocalDateTime.now());

        PopupStore saved = popupStoreRepository.save(existing);
        reindexQuietly(saved);
        log.info(
                "[DateBackfill] 기존 row 날짜 채움 id={} {} ~ {}",
                saved.getId(),
                saved.getStartDate(),
                saved.getEndDate());
        return true;
    }

    /** 검색 인덱스 갱신 — 실패해도 크롤 흐름을 막지 않는다(다음 주기 동기화가 다시 시도). */
    private void reindexQuietly(PopupStore popup) {
        try {
            searchService.addPopup(popup);
        } catch (Exception e) {
            log.warn(
                    "[PopupCrawlOrchestrator] Algolia 동기화 실패 id={} err={}",
                    popup.getId(),
                    e.toString());
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * start 가 end 보다 뒤인가(역전). 둘 다 값이 있을 때만 판정한다 — 하나라도 비면 역전이 아니다. startDate/endDate 는
     * ISO(YYYY-MM-DD) 문자열이라 사전식 비교가 곧 시간순 비교다.
     */
    private boolean isInverted(String start, String end) {
        return !isBlank(start) && !isBlank(end) && start.compareTo(end) > 0;
    }

    private void saveNewPopup(
            NormalizedPopup result, PopupCrawlSource primarySource, String externalId) {
        Optional<Coordinates> coordinates =
                geocodingService.geocode(result.getName(), result.getLocation());

        PopupStore newPopup =
                PopupStore.builder()
                        .name(result.getName())
                        .location(result.getLocation())
                        .category(safeCategory(result.getCategory()))
                        .description(result.getDescription())
                        .content(result.getContent())
                        .startDate(result.getStartDate())
                        .endDate(result.getEndDate())
                        .viewCount(0)
                        .latitude(coordinates.map(Coordinates::latitude).orElse(null))
                        .longitude(coordinates.map(Coordinates::longitude).orElse(null))
                        .sourceType(SOURCE_TYPE_CRAWLED)
                        .sourceUrl(primarySource.getLink())
                        .sourceName(primarySource.getSourceName())
                        .officialUrl(result.getOfficialUrl())
                        .reservationUrl(result.getReservationUrl())
                        .externalId(externalId)
                        .confidenceScore(
                                BigDecimal.valueOf(result.getConfidence())
                                        .setScale(2, RoundingMode.HALF_UP))
                        .crawledAt(LocalDateTime.now())
                        .lastSeenAt(LocalDateTime.now())
                        .reviewStatus(REVIEW_STATUS_AUTO_PUBLISHED)
                        .build();

        PopupStore saved = popupStoreRepository.save(newPopup);

        // 신규 수집분도 저장 직후 고유한 Pexels 연출 이미지를 배정한다. API 장애·키 미설정 시 수집 자체는
        // 성공시키고, 매일 05시 백필이 다시 시도한다.
        try {
            popupPhotoService.assignPhotoIfMissing(saved);
            saved = popupStoreRepository.findById(saved.getId()).orElse(saved);
        } catch (Exception e) {
            log.warn(
                    "[PopupCrawlOrchestrator] 신규 사진 배정 실패 id={} err={}",
                    saved.getId(),
                    e.toString());
        }

        // v2.13 — 신규 자동게시 row 는 즉시 Algolia 인덱스에 push (다음 수집 주기까지 검색에서
        // 누락되던 문제 해소). 인덱싱 가드는 SearchService.addPopup 안에서 다시 한 번 검증.
        reindexQuietly(saved);
    }

    /* =========================== Geocoding backfill =========================== */

    private boolean fillCoordinates(PopupStore popup) {
        Optional<Coordinates> coords =
                geocodingService.geocode(popup.getName(), popup.getLocation());
        if (coords.isEmpty()) return false;

        popup.setLatitude(coords.get().latitude());
        popup.setLongitude(coords.get().longitude());
        popupStoreRepository.save(popup);
        return true;
    }

    /* =========================== 단순 헬퍼 =========================== */

    /** SHA-256(name|location|startDate) — null 안전 한 외부 식별자 생성. */
    private String computeExternalId(String name, String location, String startDate) {
        String raw = normalizePart(name) + "|" + normalizePart(location) + "|" + safeStr(startDate);
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (Exception e) {
            return Integer.toHexString(raw.hashCode());
        }
    }

    private String normalizePart(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private String safeStr(String s) {
        return s == null ? "" : s;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    private String safeCategory(String category) {
        if (category == null) return DEFAULT_CATEGORY;
        String upper = category.toUpperCase();
        return ALLOWED_CATEGORIES.contains(upper) ? upper : DEFAULT_CATEGORY;
    }

    private void sleepQuietly(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    /* =========================== 내부 통계 클래스 =========================== */

    private static class CrawlStatistics {
        int totalSnippets;
        int llmCalls;
        int normalized;
        int autoPublished;
        int pendingReview;
        int duplicates;
        int rejected;

        /**
         * 일일 한도로 중단했는가(0/1).
         *
         * <p>이 필드가 없으면 쿼터 소진이 {@code llmCalls=0, autoPublished=0} 인 "조용한 정상 응답" 과 구별되지 않는다. 스케줄러는
         * 예외를 받지 않으므로 "자동수집 완료" 로 남고, 어드민 수동 실행도 JSON 만으로는 판별할 수 없다. 이 변경의 목적이 바로 그 구분이므로 반환값에
         * 드러낸다.
         */
        int quotaExhausted;

        /** 대장에 이미 있어 LLM 에 안 넘긴 스니펫 수. 선중복제거가 실제로 얼마를 아꼈는지 보여준다. */
        int skippedKnown;

        /** 같은 회차 안에서 중복이라 뺀 스니펫 수(키워드 A·B 결과에 같은 글). */
        int skippedDuplicate;

        /** 이번 회차가 커서 순회에서 다룬 키워드 수 / 전체 키워드 수 / 시작 커서. 진행률 가시성용. */
        int keywordsCovered;

        int keywordsTotal;
        int keywordCursorStart;

        /** 검색 API 일일 예산(기본 50%)에 걸려 조기 종료했는가(0/1). */
        int searchBudgetExhausted;

        /** 신규 삽입 대신 기존 null-date row 의 빈 날짜를 채운 건수(점진 보강). */
        int datesBackfilled;

        /** 기존 날짜 결손 팝업의 원문을 이번 회차 재처리 대상으로 되돌린 수. */
        int dateSourcesQueued;

        Map<String, Integer> toMap() {
            Map<String, Integer> map = new LinkedHashMap<>();
            map.put("totalSnippets", totalSnippets);
            map.put("llmCalls", llmCalls);
            map.put("skippedKnown", skippedKnown);
            map.put("skippedDuplicate", skippedDuplicate);
            map.put("quotaExhausted", quotaExhausted);
            map.put("normalized", normalized);
            map.put("autoPublished", autoPublished);
            map.put("pendingReview", pendingReview);
            map.put("duplicates", duplicates);
            map.put("datesBackfilled", datesBackfilled);
            map.put("dateSourcesQueued", dateSourcesQueued);
            map.put("rejected", rejected);
            map.put("keywordCursorStart", keywordCursorStart);
            map.put("keywordsCovered", keywordsCovered);
            map.put("keywordsTotal", keywordsTotal);
            map.put("searchBudgetExhausted", searchBudgetExhausted);
            return map;
        }
    }
}
