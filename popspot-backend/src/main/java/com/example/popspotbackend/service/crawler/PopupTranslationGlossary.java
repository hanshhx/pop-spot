package com.example.popspotbackend.service.crawler;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 번역 모델이 고유명사를 추측하지 못하게 공식 표기를 잠근다.
 *
 * <p>팝업 이름은 보통 브랜드/IP와 행사 설명이 섞여 있다. 모델에 원문을 그대로 주면 외모지상주의를 {@code Aestheticism}, 짱구를 {@code
 * jang-ku}처럼 뜻풀이하거나 잘못 음역했다. 여기서 확인된 이름을 임시 토큰으로 바꾸고, 모델 응답 뒤에 정확한 영어·일본어 표기를 복원한다.
 */
@Component
public class PopupTranslationGlossary {

    private static final Pattern HANGUL = Pattern.compile("[가-힣]");
    private static final Pattern UNKNOWN_TOKEN = Pattern.compile("ZXQTERM\\d+QXZ");

    private final List<Alias> aliases;

    public PopupTranslationGlossary() {
        List<Alias> values = new ArrayList<>();

        // IP·게임·캐릭터·가수 — 프론트 SEO 랜딩과 같은 공식 표기를 사용한다.
        add(values, true, "StelLive", "ステライブ", "스텔라이브", "스텔 라이브");
        add(values, true, "Overwatch", "オーバーウォッチ", "오버워치", "오버 워치");
        add(values, true, "Pokémon", "ポケモン", "포켓몬");
        add(values, true, "Sanrio", "サンリオ", "산리오");
        add(values, true, "Genshin Impact", "原神", "원신");
        add(values, true, "Toy Story", "トイ・ストーリー", "토이스토리", "토이 스토리", "toy story");
        add(values, true, "Demon Slayer: Kimetsu no Yaiba", "鬼滅の刃", "귀멸의 칼날", "귀멸의칼날", "귀칼");
        add(values, true, "Attack on Titan", "進撃の巨人", "진격의 거인", "진격의거인");
        add(values, true, "Hermès", "エルメス", "에르메스");
        add(values, true, "Nintendo", "任天堂", "닌텐도", "니텐도");
        add(values, true, "Jujutsu Kaisen", "呪術廻戦", "주술회전", "주술 회전");
        add(
                values,
                true,
                "GODDESS OF VICTORY: NIKKE",
                "勝利の女神：NIKKE",
                "승리의 여신 니케",
                "승리의 여신: 니케",
                "니케");
        add(
                values,
                true,
                "HATSUNE MIKU: COLORFUL STAGE!",
                "プロジェクトセカイ カラフルステージ！ feat. 初音ミク",
                "프로젝트 세카이",
                "프세카");
        add(values, true, "Hatsune Miku", "初音ミク", "하츠네 미쿠", "하츠네미쿠");
        add(values, true, "DJMAX", "DJMAX", "디제이맥스", "디맥");
        add(values, true, "Roblox", "ロブロックス", "로블록스");
        add(values, true, "Blue Archive", "ブルーアーカイブ", "블루아카이브", "블루 아카이브");
        add(values, true, "Disney", "ディズニー", "디즈니");
        add(values, true, "KAKAO FRIENDS", "カカオフレンズ", "카카오프렌즈");
        add(values, true, "LINE FRIENDS", "LINE FRIENDS", "라인프렌즈");
        add(values, true, "ONE PIECE Mugiwara Store", "ONE PIECE 麦わらストア", "무기와라 스토어", "무기와라스토어");
        add(values, true, "ONE PIECE", "ONE PIECE", "원피스");
        add(values, true, "Mugiwara", "麦わら", "무기와라", "무기 와라");
        add(values, true, "Zombie High School", "ゾンビ高校", "좀비고등학교", "좀비고");
        add(values, true, "Kim Hamzzi", "キムヘムチ", "김햄찌", "김 햄찌");
        add(values, true, "Oasis", "オアシス", "오아시스");
        add(values, true, "Teamfight Tactics", "チームファイト タクティクス", "롤토체스", "롤체");
        add(values, true, "Arknights", "アークナイツ", "명일방주", "명방");
        add(values, true, "T1", "T1", "티원", "T1");
        add(values, true, "MapleStory", "メイプルストーリー", "메이플스토리", "메이플 스토리");
        add(values, true, "Honkai: Star Rail", "崩壊：スターレイル", "붕괴 스타레일", "스타레일", "스타 레일");
        add(values, true, "Umamusume: Pretty Derby", "ウマ娘 プリティーダービー", "우마무스메", "우마 무스메");
        add(values, true, "Wuthering Waves", "鳴潮", "명조");
        add(values, true, "Chiikawa", "ちいかわ", "치이카와", "치이 카와");
        add(values, true, "Naruto", "NARUTO -ナルト-", "나루토");
        add(values, true, "JoJo's Bizarre Adventure", "ジョジョの奇妙な冒険", "조조의 기묘한 모험", "죠죠");
        add(values, true, "Delicious in Dungeon", "ダンジョン飯", "던전밥", "던전 밥");
        add(values, true, "Yumeiro Patissiere", "夢色パティシエール", "꿈빛 파티시엘", "꿈빛파티시엘");
        add(values, true, "NMIXX", "NMIXX", "엔믹스");
        add(values, true, "Yorushika", "ヨルシカ", "요루시카", "요루 시카");
        add(values, true, "SEGA", "セガ", "세가");
        add(
                values,
                true,
                "Omniscient Reader's Viewpoint",
                "全知的な読者の視点から",
                "전지적 독자 시점",
                "전지적 독자",
                "전독시");
        add(values, true, "Lookism", "外見至上主義", "외모지상주의", "외지주");
        add(values, true, "Hearts2Hearts", "Hearts2Hearts", "하츠투하츠", "하투하");
        add(values, true, "ALIEN STAGE", "ALIEN STAGE", "에일리언 스테이지", "에이스테");
        add(values, true, "CUTIE STREET", "CUTIE STREET", "큐티 스트리트", "큐스토");
        add(
                values,
                true,
                "Even If I Fall Into a Ghost Story, I Still Have to Go to Work",
                "怪談に落ちても出勤しなければならないんだな",
                "괴담에 떨어져도 출근",
                "괴담출근");
        add(values, true, "MINIVE", "MINIVE", "미니브");
        add(values, true, "ANGYENGMANDU", "メガネ餃子", "안경만두");
        add(values, true, "GANADI", "GANADI", "가나디");
        add(values, true, "LaTale", "ラテール", "라테일");
        add(
                values,
                true,
                "Street Restaurant Fighter",
                "ストリート・レストラン・ファイター",
                "스트릿 레스토랑 파이터",
                "스트릿레스토랑파이터");
        add(values, true, "Gintama", "銀魂", "은혼", "긴타마");
        add(values, true, "Hell's Kitchen", "ヘルズ・キッチン", "헬스키친");
        add(values, true, "Digimon", "デジモン", "디지몬");
        add(values, true, "Spider-Man", "スパイダーマン", "스파이더맨");
        add(values, true, "IVE", "IVE", "아이브");
        add(values, true, "fromis_9", "fromis_9", "프로미스나인");
        add(values, true, "YOASOBI", "YOASOBI", "요아소비");
        add(values, true, "Project I", "プロジェクトアイ", "프로젝트아이", "프로젝트 아이");
        add(values, true, "Offside", "オフサイド", "오프사이드");
        add(values, true, "Lost Ark", "ロストアーク", "로스트아크", "로스트 아크");
        add(
                values,
                true,
                "Crayon Shin-chan",
                "クレヨンしんちゃん",
                "짱구는못말려",
                "짱구는 못말려",
                "크레용 신짱",
                "크레용신짱",
                "짱구");
        add(values, true, "Cookie Run", "クッキーラン", "쿠키런");
        add(values, true, "Shin Ramyun", "辛ラーメン", "신라면", "辛라면");
        add(values, true, "Arknights: Endfield", "アークナイツ：エンドフィールド", "엔드필드", "엔드 필드");
        add(values, true, "CASETiFY", "CASETiFY", "케이스티파이", "케이스 티파이");
        add(values, true, "Tom and Jerry", "トムとジェリー", "톰과 제리", "톰과제리", "톰앤제리", "톰 앤 제리");
        add(values, true, "HYBE BRIDZ", "HYBE BRIDZ", "하이브 브릿즈", "브릿즈");
        add(values, true, "MUSINSA", "ムシンサ", "무신사");
        add(values, true, "Blue Bottle Coffee", "ブルーボトルコーヒー", "블루보틀", "블루 보틀");
        add(values, true, "Manchester City", "マンチェスター・シティ", "맨체스터 시티", "맨시티");
        add(values, true, "K League", "Kリーグ", "K리그");
        add(values, true, "PEACEMINUSONE", "PEACEMINUSONE", "피스마이너스원", "PEACEMINUSONE");

        /*
         * 2026-08-06 — 운영 데이터를 훑어 보고 추가한 것들.
         *
         * 지도 984곳 중 일본어 이름이 있는 170곳을 눈으로 확인했더니, 여기 없던 이름이
         * 하나같이 틀려 있었다. 명탐정 코난은 "コナン・ハイウェイへの天国の扉", 마이멜로디
         * 하모니는 "ヒーメナ", 남대문잡채호떡은 아예 중국어("南山拌菜熱米糕")로 나왔다.
         * 남대문을 南山으로 옮긴 것은 지명이 틀린 것이라 관광객을 다른 동네로 보낸다.
         *
         * 별칭을 짧게 잡을수록 위험하다 — 매칭이 단순 부분 문자열이라 "마리오" 를 넣으면
         * 서울에 실재하는 마리오아울렛까지 삼킨다. 그래서 슈퍼마리오는 "슈퍼마리오" 로만 잠근다.
         */
        add(values, true, "Detective Conan", "名探偵コナン", "명탐정 코난", "명탐정코난");
        add(values, true, "Haikyu!!", "ハイキュー!!", "하이큐!!", "하이큐");
        add(values, true, "SPY×FAMILY", "SPY×FAMILY", "스파이패밀리", "스파이 패밀리");
        add(values, true, "Doraemon", "ドラえもん", "도라에몽");
        add(values, true, "Sailor Moon", "美少女戦士セーラームーン", "세일러문", "세일러 문");
        add(values, true, "Anpanman", "アンパンマン", "앙팡맨", "호빵맨");
        add(values, true, "Keroro", "ケロロ軍曹", "케로로");
        add(values, true, "Studio Ghibli", "スタジオジブリ", "스튜디오 지브리", "지브리");
        add(values, true, "My Melody", "マイメロディ", "마이멜로디", "마이 멜로디");
        add(values, true, "Kuromi", "クロミ", "쿠로미");
        add(values, true, "Cinnamoroll", "シナモロール", "시나모롤");
        add(values, true, "Hello Kitty", "ハローキティ", "헬로키티", "헬로 키티");
        add(values, true, "Rilakkuma", "リラックマ", "리락쿠마");
        add(values, true, "Moomin", "ムーミン", "무민");
        add(values, true, "Snoopy", "スヌーピー", "스누피");
        // "마리오" 단독은 넣지 않는다 — 마리오아울렛(서울 실재 쇼핑몰)이 걸린다.
        add(values, true, "Super Mario", "スーパーマリオ", "슈퍼마리오", "슈퍼 마리오");
        add(values, true, "Arc System Works", "アークシステムワークス", "아크시스템웍스", "아크 시스템 웍스");
        add(values, true, "NAVER WEBTOON", "ネイバーウェブトゥーン", "네이버웹툰", "네이버 웹툰");

        // 한국 화장품·생활 브랜드 — 공식 표기가 따로 있는데 음역되고 있었다.
        add(values, true, "LANEIGE", "ラネージュ", "라네즈");
        add(values, true, "Sulwhasoo", "雪花秀", "설화수");
        add(values, true, "TONYMOLY", "トニーモリー", "토니모리");
        add(values, true, "MEDIHEAL", "メディヒール", "메디힐");
        add(values, true, "innisfree", "イニスフリー", "이니스프리");
        add(values, true, "OLIVE YOUNG", "オリーブヤング", "올리브영", "올리브 영");

        /*
         * 2026-08-09 — 커버리지를 막고 있던 이름들.
         *
         * 1047곳 중 번역된 것이 177곳뿐이라 원인을 셌더니, 이름 전체가 버려지는 이유의 상위가
         * 스토어(40회)·서울(29)·카페(21)·전시(16) 같은 <b>일반명사</b>였다. 번역 서비스는 잠근 뒤
         * 한글이 남으면 통째로 포기하므로, 포켓몬을 알아도 "굿즈" 를 모르면 "포켓몬 굿즈 팝업" 이
         * 스킵된다.
         *
         * 일반명사는 옮겨도 틀릴 여지가 없다 — 정확도를 안 깎고 커버리지만 올리는 자리다.
         */
        add(values, false, "Store", "ストア", "스토어");
        add(values, false, "Seoul", "ソウル", "서울");
        add(values, false, "Cafe", "カフェ", "카페");
        add(values, false, "Special Exhibition", "特別展", "특별전");
        add(values, false, "Exhibition", "展示", "전시회", "전시");
        add(values, false, "House", "ハウス", "하우스");
        add(values, false, "Bakery", "ベーカリー", "베이커리");
        add(values, false, "Goods", "グッズ", "굿즈");
        add(values, false, "Flagship", "フラッグシップ", "플래그십");
        add(values, false, "Brand", "ブランド", "브랜드");
        add(values, false, "Summer", "サマー", "썸머", "서머");
        add(values, false, "Stage", "ステージ", "스테이지");
        add(values, false, "Burger", "バーガー", "버거");
        add(values, false, "Sushi", "寿司", "스시");
        add(values, false, "Edition", "エディション", "에디션");
        add(values, false, "Beauty", "ビューティー", "뷰티");
        add(values, false, "Factory", "ファクトリー", "팩토리");
        add(values, false, "Honey", "はちみつ", "벌꿀");
        add(values, false, "Cinema", "シネマ", "시네마");
        add(values, false, "Project", "プロジェクト", "프로젝트");
        add(values, false, "Art", "アート", "아트");
        add(values, false, "Acrylic Stand", "アクリルスタンド", "아크릴 스탠드", "아크릴스탠드");
        add(values, false, "Acrylic", "アクリル", "아크릴");
        add(values, false, "Limited", "限定", "한정");
        add(values, false, "Anniversary", "記念", "기념");
        add(values, false, "Open", "オープン", "오픈");
        add(values, false, "Room", "ルーム", "룸");
        add(values, false, "Edit", "エディット", "에디트");
        add(values, false, "Great", "偉大な", "위대한");
        add(values, false, "Legacy", "遺産", "유산");
        add(values, false, "Kingdom of", "王国の", "왕국의");

        /*
         * 같은 조사에서 나온 고유명사들. 공식 표기가 확실한 것만 넣는다 — 애매한 소상공인 이름은
         * 일부러 뺐다. 여기 잘못 적으면 그게 그대로 화면에 나가고, 빼면 한국어 원문이 나올 뿐이다.
         */
        add(values, true, "Disney", "ディズニー", "디즈니");
        add(values, true, "Winnie the Pooh", "くまのプーさん", "곰돌이 푸", "곰돌이푸");
        add(values, true, "Cookie Run: Kingdom", "クッキーラン：キングダム", "쿠키런: 킹덤", "쿠키런:킹덤");
        add(values, true, "Cookie Run", "クッキーラン", "쿠키런");
        add(values, true, "No Brand", "ノーブランド", "노브랜드");
        add(values, true, "NIKKE: Goddess of Victory", "勝利の女神：NIKKE", "승리의 여신: 니케", "승리의 여신 니케");
        // "더티니핑" 은 앞의 "더" 한 글자가 남아 이름 전체가 버려진다. 별칭을 길게 잡아 통째로 잠근다.
        add(values, true, "Catch! Teenieping", "キャッチ！ティニピン", "더티니핑", "더 티니핑", "티니핑");
        add(values, true, "GUCCI", "グッチ", "구찌");
        add(values, true, "G-DRAGON", "G-DRAGON", "지드래곤");
        add(values, true, "Shinsegae Department Store", "新世界百貨店", "신세계백화점", "신세계 백화점");
        add(values, true, "Spider-Man", "スパイダーマン", "스파이더맨");
        add(values, true, "Honkai: Star Rail", "崩壊：スターレイル", "붕괴:스타레일", "붕괴: 스타레일", "스타레일");
        add(values, true, "Pompompurin", "ポムポムプリン", "폼폼푸린");
        add(values, true, "Outback Steakhouse", "アウトバックステーキハウス", "아웃백");
        add(values, true, "Alien Stage", "エイリアンステージ", "에일리언 스테이지");

        // 행사 이름에 자주 붙는 말. 확인된 고유명사와 조합할 때만 자동 저장한다.
        add(values, false, "Anakt", "アナクト", "아낙트");
        add(values, false, "Arts High School", "芸術高等学校", "예술고등학교");
        add(values, false, "Tteogip Village", "トギプ村", "떡잎마을");
        add(values, false, "Relaxing", "のんびり", "느긋느긋");
        add(values, false, "Lively", "わいわい", "왁자지껄");
        add(values, false, "Chef", "シェフ", "셰프");
        add(values, false, "Relay", "リレー", "릴레이");
        add(values, false, "Grand Festival", "大祭典", "대축제");
        add(values, false, "Summer Camp", "サマーキャンプ", "썸머캠프");
        add(values, false, "Summer", "サマー", "여름");
        add(values, false, "Vacation", "バカンス", "바캉스");
        add(values, false, "Collection", "コレクション", "컬렉션");
        add(values, false, "Collaboration", "コラボレーション", "콜라보레이션", "콜라보");
        add(values, false, "Pop-up Exhibition", "ポップアップ展示", "팝업전시", "팝업 전시");
        add(values, false, "Pop-up Cafe", "ポップアップカフェ", "팝업카페", "팝업 카페");
        add(values, false, "Pop-up Store", "ポップアップストア", "팝업스토어", "팝업 스토어");
        add(values, false, "Pop-up", "ポップアップ", "팝업");

        // 장소·건물 — 같은 한글 이름을 다른 시설로 바꾸는 오역을 막는다.
        add(values, true, "The Hyundai Seoul", "ザ・ヒョンデ・ソウル", "더현대 서울", "더현대서울", "더현대");
        add(values, true, "Hyundai Department Store", "現代百貨店", "현대백화점", "현대 백화점");
        add(values, true, "IPARK Mall Yongsan", "アイパークモール龍山店", "용산 아이파크몰", "용산아이파크몰");
        add(values, true, "IPARK Mall", "アイパークモール", "아이파크몰");
        add(values, true, "Lotte World Mall", "ロッテワールドモール", "롯데월드몰", "롯데월드 몰");
        add(values, true, "Lotte Department Store", "ロッテ百貨店", "롯데백화점");
        add(values, true, "AK PLAZA", "AKプラザ", "AK플라자", "AK 플라자");
        add(values, true, "COEX", "コエックス", "코엑스");
        // 남대문이 "南山"(남산)으로 나온 적이 있다 — 지명 자체가 달라 다른 동네로 안내된다.
        add(values, true, "Namdaemun Market", "南大門市場", "남대문시장", "남대문 시장");
        add(values, true, "Namdaemun", "南大門", "남대문");
        add(values, true, "Dongdaemun", "東大門", "동대문");
        add(values, true, "Starfield", "スターフィールド", "스타필드");
        add(values, false, "Seongsu-dong", "ソンスドン", "성수동");
        add(values, false, "Seongsu", "ソンス", "성수");
        add(values, false, "Myeongdong", "ミョンドン", "명동");
        add(values, false, "Hongdae", "ホンデ", "홍대");
        add(values, false, "Jamsil-dong", "チャムシルドン", "잠실동");
        add(values, false, "Jamsil", "チャムシル", "잠실");
        add(values, false, "Yongsan", "ヨンサン", "용산");
        add(values, false, "Gangnam", "カンナム", "강남");
        add(values, false, "Yeouido", "ヨイド", "여의도");
        add(values, false, "Hannam", "ハンナム", "한남");
        add(values, false, "Seongdong-gu", "城東区", "성동구");
        add(values, false, "Songpa-gu", "松坡区", "송파구");
        add(values, false, "Gangnam-gu", "江南区", "강남구");
        add(values, false, "Jung-gu", "中区", "중구");
        add(values, false, "Seoul", "ソウル", "서울");

        /*
         * 2026-08-09 시험 배치에서 드러난 구멍을 메운다.
         *
         * 지명은 이름 안에 들어 있을 때가 많다("지드래곤 팝업 타임스퀘어 영등포"). location 칸만 잠그고
         * name 을 음역으로 열어 둔 탓에, 위에 없는 동네가 전부 모델의 추측으로 넘어갔다. 결과가 나빴다.
         *
         *   영등포 → 江東区   서울 반대편이다. 이대로면 관광객이 헛걸음한다.
         *   서촌   → seocheon 로마자가 그대로 샜다.
         *   시흥   → シヘウン  읽기가 틀렸다(시헤운).
         *
         * 한남동은 더 고약했다. "한남"만 잡히고 남은 "동"을 모델이 방위로 읽어 ハンナム東 이 됐다.
         * 그래서 아래는 "동" 이 붙은 형태를 같이 넣는다 — 성수동·잠실동이 이미 그렇게 돼 있었다.
         *
         * 표기 규칙은 위와 같다. 동네는 가타카나(일본 여행 매체 관례), 구·시는 한자.
         */
        add(values, false, "Hannam-dong", "ハンナムドン", "한남동");
        add(values, false, "Yeongdeungpo", "ヨンドンポ", "영등포");
        add(values, false, "Seochon", "ソチョン", "서촌");
        add(values, false, "Bukchon", "プクチョン", "북촌");
        add(values, false, "Sinchon", "シンチョン", "신촌");
        add(values, false, "Apgujeong", "アックジョン", "압구정");
        add(values, false, "Cheongdam", "チョンダム", "청담");
        add(values, false, "Itaewon", "イテウォン", "이태원");
        add(values, false, "Yeonnam-dong", "ヨンナムドン", "연남동");
        add(values, false, "Yeonnam", "ヨンナム", "연남");
        add(values, false, "Hapjeong", "ハプチョン", "합정");
        add(values, false, "Mangwon", "マンウォン", "망원");
        add(values, false, "Jongno", "チョンノ", "종로");
        add(values, false, "Euljiro", "ウルチロ", "을지로");
        add(values, false, "Ttukseom", "トゥクソム", "뚝섬");
        add(values, false, "Munrae", "ムンレ", "문래");
        add(values, false, "Konkuk University", "コンデ", "건대");
        add(values, false, "Wangsimni", "ワンシムニ", "왕십리");
        add(values, false, "Samseong-dong", "サムソンドン", "삼성동");
        add(values, false, "Garosu-gil", "カロスキル", "가로수길");
        add(values, false, "Seoul Forest", "ソウルの森", "서울숲");
        // 일본 매체가 한자를 그대로 쓰는 곳들.
        add(values, false, "Gwanghwamun", "光化門", "광화문");
        add(values, false, "Insa-dong", "仁寺洞", "인사동");
        add(values, false, "Dosan Park", "島山公園", "도산공원");
        add(values, false, "Yeongdeungpo-gu", "永登浦区", "영등포구");
        add(values, false, "Mapo-gu", "麻浦区", "마포구");
        add(values, false, "Yongsan-gu", "龍山区", "용산구");
        add(values, false, "Seocho-gu", "瑞草区", "서초구");
        add(values, false, "Jongno-gu", "鍾路区", "종로구");
        // 수도권·지방. 팝업이 서울 밖에서 열릴 때 이름에 지역이 붙는다.
        add(values, false, "Pangyo", "パンギョ", "판교");
        add(values, false, "Siheung", "シフン", "시흥");
        add(values, false, "Hanam", "ハナム", "하남");
        add(values, false, "Suwon", "水原", "수원");
        add(values, false, "Incheon", "仁川", "인천");
        add(values, false, "Busan", "釜山", "부산");
        add(values, false, "Haeundae", "海雲台", "해운대");
        add(values, false, "Daegu", "大邱", "대구");
        add(values, false, "Ulsan", "蔚山", "울산");
        add(values, false, "Daejeon", "大田", "대전");
        add(values, false, "Gwangju", "光州", "광주");
        add(values, false, "Jeju", "済州", "제주");
        add(values, false, "Gyeonggi-do", "京畿道", "경기도");

        /*
         * 장소 이름은 지명 하나만 잠가서는 부족하다. "지드래곤 팝업 타임스퀘어 영등포" 처럼 건물 이름이 같이
         * 붙는데, 그중 하나라도 모르면 이름 전체가 버려지거나(커버리지 손실) 모델이 추측한다(오역).
         *
         * 아래는 시험 배치에서 실제로 막고 있던 것들이다.
         */
        add(values, true, "Times Square", "タイムズスクエア", "타임스퀘어", "타임 스퀘어");
        add(values, true, "Galleria", "ギャラリア", "갤러리아");
        add(values, true, "Lotte World", "ロッテワールド", "롯데월드");
        add(values, false, "Mokdong", "モクドン", "목동");
        // 띄어 쓴 형태만 잠근다. 맨 "아울렛" 을 넣었더니 마리오아울렛(영등포의 실제 상가)을
        // "마리오" + 아울렛으로 쪼갰다 — 상가 이름이 사라져 다른 곳으로 안내된다.
        add(values, false, "Premium Outlet", "プレミアムアウトレット", "프리미엄 아울렛", "프리미엄 아웃렛");
        add(values, false, "showroom", "ショールーム", "쇼룸");

        /*
         * 운영 이름 963건을 훑어 "막고 있는 낱말" 을 세어 넣는다(2026-08-10).
         *
         * 안전 모드 — 모르는 한글이 하나라도 남으면 통째로 포기 — 로 두면 오타가 0이 되는 대신 209건
         * (21.7%)만 번역된다. 나머지를 여는 길은 둘뿐이다. 모델이 추측하게 두거나(오타 27%), 여기를
         * 채우거나. 아래는 후자다.
         *
         * 한 글자짜리는 넣지 않는다. 상위에 '더'(15) '점'(14) '의'(9) 가 있지만, 매칭이 단순 부분
         * 문자열이라 다른 낱말 안을 파고든다 — 맨 "아울렛" 이 마리오아울렛을 쪼갠 것과 같은 사고다.
         */
        add(values, false, "anniversary", "周年", "주년");
        add(values, false, "lounge", "ラウンジ", "라운지");
        add(values, false, "day", "デー", "데이");
        add(values, false, "flagship store", "本店", "본점");
        add(values, false, "first", "ファースト", "퍼스트");
        add(values, false, "coffee", "コーヒー", "커피");
        // 지드래곤 "팬" 팝업이 パン(빵)으로 나왔다.
        add(values, false, "fan", "ファン", "팬");
        add(values, false, "official", "公式", "공식");
        add(values, false, "kids", "キッズ", "키즈");
        add(values, false, "experience", "体験型", "체험형");
        add(values, false, "cosmetics", "化粧品", "화장품");
        add(values, false, "square", "スクエア", "스퀘어");
        add(values, false, "gallery", "ギャラリー", "갤러리");
        add(values, false, "cheesecake", "チーズケーキ", "치즈케이크");
        add(values, false, "Asia", "アジア", "아시아");
        add(values, false, "hotel", "ホテル", "호텔");
        add(values, false, "festa", "フェスタ", "페스타");
        add(values, false, "salt bread", "塩パン", "소금빵");
        add(values, false, "amazing", "アメイジング", "어메이징");
        add(values, false, "memoir", "回顧録", "회고록");
        add(values, false, "liquid", "リキッド", "리퀴드");
        add(values, false, "cruise", "遊覧", "유람");
        add(values, false, "world", "世界", "세계");
        add(values, false, "grandmother's", "おばあちゃんの", "할머니의");

        // 자주 나오는 브랜드. 모델이 틀리게 옮긴 것을 확인한 것만 넣는다.
        add(values, true, "LOEWE", "ロエベ", "로에베");
        add(values, true, "Bioré", "ビオレ", "비오레");
        add(values, true, "Aesop", "イソップ", "이솝");
        add(values, true, "New Balance", "ニューバランス", "뉴발란스");
        add(values, true, "Knotted", "ノッテッド", "노티드");
        add(values, true, "TAMBURINS", "タンバリンズ", "탬버린즈");
        add(values, true, "Mardi Mercredi", "マルディメクルディ", "마르디 메크르디");
        add(values, true, "SPAO", "SPAO", "스파오");
        add(values, true, "Cass", "カス", "카스");
        add(values, true, "Mallang Festa", "マランフェスタ", "말랑페스타");
        add(values, true, "Mario Outlet", "マリオアウトレット", "마리오아울렛");
        add(values, true, "Amorepacific Foundation", "アモレパシフィック財団", "아모레퍼시픽재단");
        add(values, true, "Hyundai", "現代", "현대");
        add(values, true, "Shinsegae", "新世界", "신세계");
        add(values, true, "The Summer Hikaru Died", "ヒカルが死んだ夏", "히카루가 죽은 여름");
        add(values, true, "Hazbin Hotel", "ハズビンホテル", "해즈빈 호텔");
        add(values, true, "Ray-Ban", "レイバン", "레이벤", "레이밴");
        add(values, true, "Sportage", "スポーテージ", "스포티지");
        add(values, true, "wharrytzn", "ワリットイズン", "와릿이즌");
        add(values, false, "department store", "百貨店", "백화점");

        values.sort(Comparator.comparingInt((Alias alias) -> alias.source().length()).reversed());
        aliases = List.copyOf(values);
    }

    public ProtectedText protect(String source) {
        if (source == null || source.isBlank()) {
            return new ProtectedText(source == null ? "" : source, List.of(), false, false);
        }

        String masked = source;
        List<Token> tokens = new ArrayList<>();
        boolean properNameFound = false;
        for (Alias alias : aliases) {
            Pattern sourcePattern =
                    Pattern.compile(
                            Pattern.quote(alias.source()),
                            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            if (!sourcePattern.matcher(masked).find()) continue;

            String token = "ZXQTERM" + tokens.size() + "QXZ";
            masked = sourcePattern.matcher(masked).replaceAll(token);
            tokens.add(new Token(token, alias.english(), alias.japanese()));
            properNameFound = properNameFound || alias.properName();
        }
        return new ProtectedText(
                masked, List.copyOf(tokens), properNameFound, HANGUL.matcher(source).find());
    }

    private static void add(
            List<Alias> values,
            boolean properName,
            String english,
            String japanese,
            String... sources) {
        for (String source : sources) {
            values.add(new Alias(source, english, japanese, properName));
        }
    }

    private record Alias(String source, String english, String japanese, boolean properName) {}

    private record Token(String marker, String english, String japanese) {}

    public record ProtectedText(
            String masked, List<Token> tokens, boolean properNameFound, boolean sourceHadHangul) {

        /** 잠근 뒤에도 한글이 남으면 아직 확인하지 못한 고유어가 있다는 뜻이다. */
        public boolean hasUnprotectedHangul() {
            return HANGUL.matcher(masked).find();
        }

        public String restoreEnglish(String translated) {
            return restore(translated, true);
        }

        public String restoreJapanese(String translated) {
            return restore(translated, false);
        }

        private String restore(String translated, boolean english) {
            if (translated == null || translated.isBlank()) return null;
            String restored = translated.trim();
            for (Token token : tokens) {
                if (!restored.contains(token.marker())) return null;
                restored =
                        restored.replace(
                                token.marker(), english ? token.english() : token.japanese());
            }
            if (UNKNOWN_TOKEN.matcher(restored.toUpperCase(Locale.ROOT)).find()) return null;
            return restored.replaceAll("\\s+", " ").trim();
        }
    }
}
