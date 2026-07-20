package com.example.popspotbackend.service.crawler;

import com.example.popspotbackend.entity.PopupStore;
import com.example.popspotbackend.repository.PopupStoreRepository;
import com.example.popspotbackend.service.SearchService;
import com.example.popspotbackend.service.geocoding.Coordinates;
import com.example.popspotbackend.service.geocoding.GeocodingService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
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

    @Value("${popspot.crawler.confidence-threshold:0.8}")
    private double confidenceThreshold;

    /** 자동게시 목표치 — 이 수에 도달하면 LLM 호출/시간 절약을 위해 조기 종료. 0 이면 제한 없음. */
    @Value("${popspot.crawler.max-auto-published:0}")
    private int maxAutoPublished;

    /** 전체 크롤 1회 실행. 처리 통계를 맵으로 반환. */
    public Map<String, Integer> runOnce() {
        if (areAllCrawlersUnconfigured()) {
            log.warn("[PopupCrawlOrchestrator] Naver/Kakao 둘 다 미설정 → 실행 스킵");
            return Map.of("skipped", 1);
        }

        CrawlStatistics stats = new CrawlStatistics();
        Map<String, List<PopupCrawlSource>> snippetsByKeyword = collectSnippetsByKeyword(stats);
        processNormalizationAndSave(snippetsByKeyword, stats);

        Map<String, Integer> result = stats.toMap();
        log.info("[PopupCrawlOrchestrator] 통계 = {}", result);
        return result;
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
        Map<String, List<PopupCrawlSource>> grouped = new HashMap<>();

        // 키워드 목록은 append-only 로 자라서 확장 블록이 기존 항목과 겹치기 쉽다(실제로 51개 중복 발생).
        // 중복 키워드는 같은 검색을 두 번 돌려 API 쿼터·실행시간만 축내므로 순서를 유지한 채 dedup 한다.
        for (String keyword : new LinkedHashSet<>(SEARCH_KEYWORDS)) {
            List<PopupCrawlSource> snippets = fetchSnippetsForKeyword(keyword);
            stats.totalSnippets += snippets.size();
            grouped.computeIfAbsent("kw:" + keyword, k -> new ArrayList<>()).addAll(snippets);
            sleepQuietly(NAVER_KAKAO_API_INTERVAL_MS);
        }
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

        for (Map.Entry<String, List<PopupCrawlSource>> entry : grouped.entrySet()) {
            if (shouldStopEarly(stats)) break;

            List<PopupCrawlSource> snippets = entry.getValue();
            if (snippets.isEmpty()) continue;

            if (!isFirstCall) sleepQuietly(GROQ_RPM_THROTTLE_MS);
            isFirstCall = false;

            // v2.33 — 한 키워드 묶음에서 서로 다른 팝업을 여러 개 추출(LLM 호출은 키워드당 1회 유지).
            List<NormalizedPopup> candidates = normalizer.normalizeAll(snippets);
            stats.llmCalls++;

            for (NormalizedPopup candidate : candidates) {
                if (shouldStopEarly(stats)) break;
                stats.normalized++;
                handleNormalizedResult(candidate, snippets, stats);
            }
        }
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

        if (markDuplicateAsSeen(externalId)) {
            stats.duplicates++;
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

    private boolean markDuplicateAsSeen(String externalId) {
        Optional<PopupStore> existing = popupStoreRepository.findByExternalId(externalId);
        if (existing.isEmpty()) return false;

        PopupStore popup = existing.get();
        popup.setLastSeenAt(LocalDateTime.now());
        popupStoreRepository.save(popup);
        return true;
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
                        .externalId(externalId)
                        .confidenceScore(
                                BigDecimal.valueOf(result.getConfidence())
                                        .setScale(2, RoundingMode.HALF_UP))
                        .crawledAt(LocalDateTime.now())
                        .lastSeenAt(LocalDateTime.now())
                        .reviewStatus(REVIEW_STATUS_AUTO_PUBLISHED)
                        .build();

        PopupStore saved = popupStoreRepository.save(newPopup);

        // v2.13 — 신규 자동게시 row 는 즉시 Algolia 인덱스에 push (다음 수집 주기까지 검색에서
        // 누락되던 문제 해소). 인덱싱 가드는 SearchService.addPopup 안에서 다시 한 번 검증.
        try {
            searchService.addPopup(saved);
        } catch (Exception e) {
            log.warn(
                    "[PopupCrawlOrchestrator] Algolia 동기화 실패 id={} err={}",
                    saved.getId(),
                    e.toString());
        }
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

        Map<String, Integer> toMap() {
            Map<String, Integer> map = new LinkedHashMap<>();
            map.put("totalSnippets", totalSnippets);
            map.put("llmCalls", llmCalls);
            map.put("normalized", normalized);
            map.put("autoPublished", autoPublished);
            map.put("pendingReview", pendingReview);
            map.put("duplicates", duplicates);
            map.put("rejected", rejected);
            return map;
        }
    }
}
