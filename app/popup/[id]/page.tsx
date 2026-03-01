"use client";

// [코드 해석] React의 생명주기와 상태 관리를 위한 훅들을 불러옵니다.
import { useEffect, useRef, useState } from "react";
// [코드 해석] Next.js의 앱 라우터에서 URL 파라미터를 읽고 페이지를 이동시키는 훅을 불러옵니다.
import { useParams, useRouter } from "next/navigation";
// [코드 해석] UI 디자인에 사용할 Lucide 아이콘들을 불러옵니다.
import { 
  ArrowLeft, MapPin, Calendar, Clock, Share2, Heart, CheckCircle, Ticket, 
  Sun, Moon, ExternalLink, Info, AlertCircle 
} from "lucide-react";
// [코드 해석] 타이포그래피 애니메이션을 구현하기 위해 Framer Motion 모듈을 불러옵니다.
import { motion, Variants } from "framer-motion";
// [코드 해석] 다크/라이트 모드 전환을 위한 next-themes 훅을 불러옵니다.
import { useTheme } from "next-themes"; 

// [코드 해석] 분리된 하위 컴포넌트(지도, 채팅, 디지털 티켓)를 불러옵니다.
import DetailMap from "../../../src/components/Map/DetailMap"; 
import ChatRoom from "../../../src/components/ChatRoom";
import DigitalTicket from "../../../src/components/DigitalTicket"; 
// [코드 해석] 서버와 통신하기 위한 커스텀 API fetch 함수를 불러옵니다.
import { apiFetch } from "../../../src/lib/api";

// [로직 해석] TypeScript 환경에서 window 객체 안에 kakao 객체가 존재함을 전역으로 알리고 에러를 방지합니다.
declare global {
  interface Window {
    kakao: any;
  }
}

// [코드 해석] 카카오 로드뷰 컴포넌트가 부모로부터 받을 위도, 경도, 장소명 타입을 정의합니다.
interface KakaoRoadviewProps {
  lat: number;
  lng: number;
  name: string;
}

// [로직 해석] 카카오맵 API를 활용하여 지정된 좌표의 로드뷰(거리뷰)를 렌더링하는 전용 컴포넌트입니다.
export function KakaoRoadview({ lat, lng, name }: KakaoRoadviewProps) {
  // [코드 해석] 로드뷰를 담을 실제 HTML div 요소를 조작하기 위해 useRef를 생성합니다.
  const containerRef = useRef<HTMLDivElement>(null);
  // [코드 해석] 로드뷰 정보를 불러오지 못했을 때의 에러 상태를 관리합니다.
  const [isError, setIsError] = useState(false);

  // [로직 해석] 컴포넌트가 렌더링되거나 좌표(lat, lng)가 바뀔 때마다 카카오 로드뷰를 초기화하는 이펙트입니다.
  useEffect(() => {
    // [코드 해석] 서버사이드 렌더링(SSR) 중이거나 카카오맵 스크립트가 로드되지 않았다면 실행을 중단합니다.
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) return;

    // [코드 해석] 참조해둔 DOM 요소가 실제로 존재하는지 확인합니다.
    const container = containerRef.current;
    if (!container) return;

    // [로직 해석] 카카오맵 API가 완전히 로드된 후 내부 콜백 함수를 실행하도록 보장합니다.
    window.kakao.maps.load(() => {
      // [코드 해석] 넘겨받은 위도, 경도로 카카오맵 좌표 객체를 생성합니다.
      const position = new window.kakao.maps.LatLng(lat, lng);
      // [코드 해석] DOM 컨테이너에 실제 로드뷰 객체를 생성하여 연결합니다.
      const rv = new window.kakao.maps.Roadview(container);
      // [코드 해석] 로드뷰 데이터(파노라마 ID)를 검색하기 위한 클라이언트 객체를 생성합니다.
      const rvClient = new window.kakao.maps.RoadviewClient();

      // [로직 해석] 지정된 좌표를 중심으로 반경 50미터 이내에서 가장 가까운 로드뷰 파노라마 ID를 검색합니다.
      rvClient.getNearestPanoId(position, 50, (panoId: number | null) => {
        // [코드 해석] 검색된 파노라마 ID가 존재한다면 로드뷰를 해당 위치로 설정합니다.
        if (panoId) {
          rv.setPanoId(panoId, position);
          
          // [로직 해석] 로드뷰 화면 위에 둥둥 떠다닐 커스텀 오버레이 마커의 HTML 문자열을 구성합니다.
          const content = `
            <div style="padding: 6px 10px; background: #ffeb33; border-radius: 12px; border: 2px solid #000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 6px; transform: translateY(-40px); font-size: 12px; white-space: nowrap;">
              <div style="width: 8px; height: 8px; background: red; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
              <span style="color: #000; font-weight: 900;">${name}</span>
            </div>
            <style>
              @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
            </style>
          `;

          // [코드 해석] 구성한 HTML을 바탕으로 카카오 커스텀 오버레이 객체를 생성하고 로드뷰에 부착합니다.
          new window.kakao.maps.CustomOverlay({
            position: position,
            content: content,
            map: rv 
          });
        } else {
          // [코드 해석] 해당 좌표 주변에 로드뷰 데이터가 없다면 에러 상태를 true로 변경합니다.
          setIsError(true);
        }
      });
    });
  }, [lat, lng, name]);

  // [로직 해석] 에러 상태가 true일 경우, 로드뷰 대신 에러 안내 UI를 렌더링하여 화면 붕괴를 막습니다.
  if (isError) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
        <AlertCircle size={32} className="mb-2 text-red-500 opacity-80" />
        <p className="text-sm font-bold">로드뷰를 표시할 수 없습니다.</p>
      </div>
    );
  }

  // [코드 해석] 정상적으로 로드뷰 데이터를 찾았다면 준비된 컨테이너 div를 화면에 그려줍니다.
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// [코드 해석] 팝업스토어 상세 정보 API 응답 데이터의 타입을 안전하게 관리하기 위해 인터페이스를 정의합니다.
interface PopupDetail {
  id: number; name: string; content: string; address: string; category: string;
  status?: string; openDate?: string; closeDate?: string; openTime?: string; closeTime?: string;
  latitude?: string; longitude?: string;
}

// [로직 해석] 상세 페이지의 전체 레이아웃과 데이터 흐름을 담당하는 메인 컴포넌트입니다.
export default function PopupDetail() {
  // [코드 해석] URL에서 동적 라우팅 파라미터(예: /popups/86 의 86)를 추출합니다.
  const params = useParams();
  // [코드 해석] 다른 페이지로 이동하거나 뒤로가기 기능을 수행하기 위해 라우터 객체를 가져옵니다.
  const router = useRouter();
  // [코드 해석] 현재 테마 상태와 테마를 변경하는 함수를 가져옵니다.
  const { theme, setTheme } = useTheme(); 
  
  // [코드 해석] 서버에서 받아온 팝업스토어 상세 데이터를 보관하는 상태입니다.
  const [popup, setPopup] = useState<PopupDetail | null>(null);
  // [코드 해석] 데이터를 불러오는 동안 화면에 로딩 인디케이터를 띄우기 위한 상태입니다.
  const [loading, setLoading] = useState(true);
  // [코드 해석] 유저가 이 팝업스토어에 방문 스탬프를 찍었는지 여부를 관리하는 상태입니다.
  const [isStamped, setIsStamped] = useState(false); 
  // [코드 해석] 유저가 이 팝업스토어를 찜(위시리스트)했는지 여부를 관리하는 상태입니다.
  const [isLiked, setIsLiked] = useState(false); 
  // [코드 해석] 로그인 인증 여부를 검사하는 중인지 확인하여 화면 깜빡임을 방지하는 상태입니다.
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  // [코드 해석] 로컬스토리지에서 가져온 유저 정보를 담아두는 상태입니다.
  const [user, setUser] = useState<any>(null);

  // [코드 해석] 테스트 목적이나 유저 데이터가 없을 때를 대비한 기본 유저 ID 상수입니다.
  const TEST_USER_ID = "test_user";

  // [로직 해석] 텍스트 안에 포함된 http/https 링크를 찾아 실제 클릭 가능한 a 태그로 변환해주는 유틸리티 함수입니다.
  const renderContentWithLinks = (text: string) => {
    // [코드 해석] 전달받은 텍스트가 비어있다면 빈 문자열을 반환하여 에러를 막습니다.
    if (!text) return "";
    // [코드 해석] 웹 URL 형식을 잡아내는 정규표현식 객체입니다.
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // [코드 해석] 정규식을 기준으로 원본 텍스트를 링크 부분과 일반 텍스트 부분으로 쪼갭니다.
    const parts = text.split(urlRegex);
    
    // [로직 해석] 쪼개진 텍스트 조각들을 순회하면서 링크인 경우와 아닌 경우를 다르게 렌더링합니다.
    return parts.map((part, index) => {
      // [코드 해석] 현재 조각이 URL 정규식과 일치한다면 a 태그로 감싸서 반환합니다.
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-indigo-500 hover:text-indigo-400 underline break-all inline-flex items-center gap-1"
          >
            {part} <ExternalLink size={12} className="md:w-3.5 md:h-3.5"/>
          </a>
        );
      }
      // [코드 해석] 일반 텍스트라면 별도 처리 없이 원본 텍스트를 그대로 반환합니다.
      return part;
    });
  };

  // [로직 해석] 컴포넌트가 처음 화면에 나타날 때 로컬스토리지를 검사하여 로그인 여부를 확인합니다.
  useEffect(() => {
    // [코드 해석] 브라우저 저장소에서 'user'라는 키로 저장된 데이터를 꺼내옵니다.
    const storedUser = localStorage.getItem("user");
    // [로직 해석] 저장된 정보가 없다면 경고창을 띄우고 강제로 로그인 페이지로 이동시킵니다.
    if (!storedUser) {
        alert("로그인이 필요합니다.");
        router.replace("/login"); 
    } else {
        // [코드 해석] 정보가 있다면 JSON 문자열을 자바스크립트 객체로 변환하여 user 상태에 저장합니다.
        setUser(JSON.parse(storedUser));
        // [코드 해석] 인증 확인 절차가 끝났음을 알리기 위해 상태를 false로 변경합니다.
        setIsCheckingAuth(false); 
    }
  }, [router]);

  // [로직 해석] 인증 검사가 끝나면 파라미터로 받은 팝업스토어 ID를 이용해 백엔드에서 상세 데이터를 가져옵니다.
  useEffect(() => {
    // [코드 해석] 아직 인증 검사 중이라면 API 호출을 잠시 보류합니다.
    if (isCheckingAuth) return;

    // [코드 해석] apiFetch를 사용하여 백엔드의 상세 조회 엔드포인트로 GET 요청을 보냅니다.
    apiFetch(`/api/popups/${params.id}`)
      // [코드 해석] 응답이 정상(ok)이면 JSON 데이터를 뽑아내고, 아니면 에러를 발생시킵니다.
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(response => {
        // [코드 해석] 백엔드 응답 구조에 따라 데이터 객체를 추출합니다.
        const data = response.data || response; 
        // [로직 해석] 추출한 데이터를 PopupDetail 인터페이스 구조에 맞게 매핑하여 상태를 업데이트합니다.
        setPopup({
            id: data.popupId || data.id, 
            name: data.name,
            content: data.content,
            address: data.location || data.address, 
            category: data.category,
            status: data.status || "운영중",
            openDate: data.startDate || data.openDate,
            closeDate: data.endDate || data.closeDate,
            openTime: data.openTime,
            closeTime: data.closeTime,
            latitude: data.latitude,
            longitude: data.longitude
        });
        // [코드 해석] 데이터를 모두 받아왔으므로 로딩 상태를 false로 풀어 화면을 렌더링하게 합니다.
        setLoading(false);
        // [로직 해석] 데이터를 성공적으로 받아온 직후, 유저의 스탬프 여부와 찜 여부를 확인하는 함수를 연달아 호출합니다.
        checkIfStamped(data.popupId || data.id);
        checkWishlistStatus(data.popupId || data.id);
      })
      // [코드 해석] API 통신 중 에러가 발생해도 로딩 상태를 풀어 무한 로딩에 빠지지 않게 합니다.
      .catch(() => setLoading(false));
  }, [params.id, isCheckingAuth]);

  // [로직 해석] 유저가 해당 팝업스토어에 방문하여 오늘 날짜로 찍어둔 스탬프가 있는지 확인하는 비동기 함수입니다.
  const checkIfStamped = async (popupId: number) => {
      // [코드 해석] 상태에 유저 ID가 있으면 쓰고, 없으면 기본 테스트 ID를 사용합니다.
      const userIdToCheck = user?.userId || TEST_USER_ID;
      try {
          // [코드 해석] 백엔드에 내 스탬프 목록을 요청합니다.
          const res = await apiFetch(`/api/stamps/my?userId=${userIdToCheck}`);
          if (res.ok) {
              // [코드 해석] 정상적으로 목록을 가져왔다면 JSON으로 변환합니다.
              const myStamps = await res.json();
              // [코드 해석] 시스템의 현재 날짜를 yyyy-mm-dd 문자열 포맷으로 추출합니다.
              const todayString = new Date().toISOString().split('T')[0];
              // [로직 해석] 배열의 요소 중, 현재 보고 있는 팝업스토어 ID와 일치하면서 날짜가 오늘인 데이터가 하나라도 있는지 검사합니다.
              const hasStampToday = myStamps.some((s: any) => {
                  const dbDate = s.stampDate?.split('T')[0]; 
                  return s.popupStore.popupId === popupId && dbDate === todayString;
              });
              // [코드 해석] 검사 결과를 isStamped 상태에 반영하여 UI 버튼을 활성/비활성화합니다.
              setIsStamped(hasStampToday);
          }
      } catch (e) { console.error(e); } // [코드 해석] 에러 발생 시 콘솔에만 출력하고 앱을 중단시키지 않습니다.
  };

  // [로직 해석] 유저의 위시리스트 목록을 가져와 현재 보고 있는 팝업스토어가 찜 되어있는지 확인하는 비동기 함수입니다.
  const checkWishlistStatus = async (popupId: number) => {
    // [코드 해석] 검색에 사용할 유저 ID를 세팅합니다.
    const userIdToCheck = user?.userId || TEST_USER_ID;
    try {
        // [코드 해석] 백엔드에 해당 유저의 전체 위시리스트 목록을 요청합니다.
        const res = await apiFetch(`/api/wishlist/${userIdToCheck}`);
        if (res.ok) {
            // [코드 해석] 정상 응답 시 데이터를 파싱합니다.
            const list = await res.json();
            // [로직 해석] 배열을 순회하며 현재 팝업스토어 ID와 동일한 항목이 있다면 isLiked 상태를 true로 만듭니다.
            setIsLiked(list.some((item: any) => item.popupId === popupId));
        }
    } catch (e) { console.error(e); }
  };

  // 🔥 [수정 1: 임의 수정 원상 복구] 동현님의 원본 코드대로 주소창 쿼리 파라미터를 통해 스탬프 POST 요청을 보냅니다.
  const handleStamp = async () => {
    // [코드 해석] 팝업스토어 데이터가 로드되지 않았다면 함수를 종료합니다.
    if (!popup) return;
    try {
        // [로직 해석] 백엔드 API 규격에 맞게 userId와 popupId를 URL 끝에 파라미터로 붙여서 POST를 요청합니다.
        const res = await apiFetch(`/api/stamps?userId=${user?.userId}&popupId=${popup.id}`, { 
            method: "POST"
        });
        // [코드 해석] 통신이 성공했다면 스탬프 상태를 true로 바꾸고 성공 알림을 띄웁니다.
        if (res.ok) {
            setIsStamped(true);
            alert("🎉 스탬프 완료!");
        } else {
            alert("이미 스탬프를 찍었거나 서버 오류입니다.");
        }
    } catch (e) { alert("오류 발생"); }
  };

  // 🔥 [수정 2: 임의 수정 원상 복구] 백엔드의 토글 로직을 존중하여, 동현님의 원본 코드대로 무조건 POST 요청만 보냅니다.
  const handleToggleLike = async () => {
    // [코드 해석] 유저나 팝업 정보가 없으면 로직을 중단합니다.
    if (!popup || !user) return;
    
    // [코드 해석] API 통신이 실패했을 때를 대비해 이전 찜 상태를 변수에 저장해둡니다.
    const prevStatus = isLiked;
    // [로직 해석] 서버 응답을 기다리지 않고 먼저 UI 하트 색상을 바꿔주는 낙관적 업데이트(Optimistic UI) 패턴입니다.
    setIsLiked(!isLiked); 
    
    try {
        // [코드 해석] 동현님 원본 코드 그대로 Path Variable 형태의 URL로 POST 요청을 보냅니다.
        const res = await apiFetch(`/api/wishlist/${user.userId}/${popup.id}`, { 
            method: "POST"
        });
        
        // [코드 해석] 서버에서 에러 코드(4xx, 5xx)가 돌아오면 의도적으로 예외를 발생시킵니다.
        if (!res.ok) throw new Error();
    } catch (e) {
        // [로직 해석] API 호출에 실패했다면 미리 바꿔두었던 UI 상태를 이전 상태로 강제 복구합니다.
        setIsLiked(prevStatus); 
        alert("찜하기 처리에 실패했습니다.");
    }
  };

  // [로직 해석] 인증 절차가 안 끝났거나 데이터 로딩 중이면 뼈대 화면(LOADING)을 보여줍니다.
  if (isCheckingAuth || loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black text-sm md:text-base">LOADING...</div>;
  // [코드 해석] 팝업 데이터가 끝내 없으면 아무것도 렌더링하지 않아 에러를 피합니다.
  if (!popup) return null;

  // [코드 해석] 지도와 로드뷰에 사용할 위경도 문자열 데이터를 소수점 숫자(float) 형태로 변환합니다. 값이 없으면 건대입구 좌표를 기본값으로 씁니다.
  const lat = parseFloat(popup.latitude || "37.5445");
  const lng = parseFloat(popup.longitude || "127.0560");

  // [코드 해석] 프레이머 모션을 이용해 배경 글자가 X축으로 -1000px 이동하며 무한 반복되도록 애니메이션 속성을 정의합니다.
  const marqueeVariants: Variants = {
    animate: { x: [0, -1000], transition: { x: { repeat: Infinity, repeatType: "loop" as const, duration: 20, ease: "linear" } } },
  };

  // [로직 해석] 실제 사용자 화면에 렌더링되는 전체 HTML(JSX) 구조의 시작점입니다.
  return (
    // [코드 해석] 뷰포트 전체 높이를 잡고 내용을 넘어설 경우 스크롤되도록 세팅된 메인 컨테이너입니다.
    <main className="min-h-screen bg-[#050505] text-white relative pb-20 overflow-x-hidden overflow-y-auto"> 
      
      {/* 🟢 히어로 섹션: z-index를 낮게 잡아 뒤쪽 배경 역할을 하게 함 */}
      <div className="relative h-[50vh] md:h-[60vh] w-full overflow-hidden flex flex-col items-center justify-center z-0">
        
        {/* [코드 해석] 애니메이션 글자가 흘러가는 배경 레이어입니다. 마우스 이벤트가 무시되도록 설정되어 있습니다. */}
        <div className="absolute inset-0 flex flex-col justify-center opacity-10 select-none pointer-events-none overflow-hidden">
            {/* [로직 해석] 동일한 문구를 3번 반복 렌더링하여 화면에 빈틈없이 타이포그래피가 채워지게 합니다. */}
            {[...Array(3)].map((_, i) => (
                <motion.div key={i} variants={marqueeVariants} animate="animate" className="whitespace-nowrap text-[12vh] md:text-[15vh] font-black text-white leading-none uppercase">
                    {popup.name} &nbsp; {popup.category} &nbsp;
                </motion.div>
            ))}
        </div>

        {/* [코드 해석] 화면 최상단 좌우에 위치하는 뒤로가기 버튼과 테마(다크/라이트) 변경 버튼 영역입니다. */}
        <div className="absolute top-0 left-0 w-full p-4 md:p-6 flex justify-between z-[50]">
            {/* [코드 해석] 클릭 시 라우터 객체를 통해 이전 페이지 이력으로 돌아갑니다. */}
            <button onClick={() => router.back()} className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all">
                <ArrowLeft size={20} className="md:w-6 md:h-6" />
            </button>
            {/* [코드 해석] 현재 테마 상태에 따라 해(Sun) 또는 달(Moon) 아이콘을 교차하여 보여주고 테마를 토글합니다. */}
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2.5 md:p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                {theme === 'dark' ? <Sun size={20} className="md:w-6 md:h-6" /> : <Moon size={20} className="md:w-6 md:h-6" />}
            </button>
        </div>

        {/* [로직 해석] Hero 중앙에 실제 팝업 정보를 카드 형태로 보여주는 핵심 UI 컴포넌트(DigitalTicket)를 삽입합니다. */}
        <div className="relative z-10 w-full flex justify-center px-4 mt-6 md:mt-10">
            <DigitalTicket 
                name={popup.name}
                date={`${popup.openDate} ~ ${popup.closeDate}`}
                address={popup.address}
                category={popup.category}
                userName={user?.nickname}
                status={popup.status}
                lat={lat} lng={lng}
          />
        </div>
        
        {/* [코드 해석] Hero 섹션과 하단 상세 컨텐츠가 자연스럽게 이어지도록 밑부분에 투명한 그라데이션 박스를 덮습니다. */}
        <div className="absolute bottom-0 left-0 w-full h-24 md:h-32 bg-gradient-to-t from-[#050505] to-transparent z-20"></div>
      </div>

      {/* 🟢 상세 정보 컨텐츠: 히어로 섹션과 살짝 겹치게(-mt-10) 끌어올려서 시각적 깊이감을 줍니다. */}
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 md:space-y-10 relative z-30 -mt-6 md:-mt-10">
        
        {/* [로직 해석] 사용자가 가장 빈번하게 누르는 액션 버튼들(스탬프, 공유, 찜)을 묶어둔 컨테이너입니다. */}
        <div className="flex flex-row md:flex-row gap-2 md:gap-3 relative z-[40]">
            {/* [로직 해석] 스탬프 상태에 따라 버튼의 색상, 텍스트, 비활성화 여부(disabled)가 실시간으로 변합니다. */}
            <button 
                onClick={handleStamp}
                disabled={isStamped}
                className={`flex-[2] md:flex-[3] py-3 md:py-4 rounded-xl md:rounded-2xl font-black flex items-center justify-center gap-1.5 md:gap-2 transition-all border text-xs md:text-base ${
                    isStamped 
                    ? "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed" 
                    : "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 border-transparent hover:bg-indigo-500"
                }`}
            >
                {/* [코드 해석] 스탬프 유무에 따라 좌측 아이콘이 체크 마크 혹은 티켓 모양으로 바뀝니다. */}
                {isStamped ? <CheckCircle size={16} className="md:w-5 md:h-5"/> : <Ticket size={16} className="md:w-5 md:h-5"/>}
                {isStamped ? "인증됨" : "스탬프 찍기"}
            </button>
            {/* [코드 해석] 아직 기능이 붙지 않은 순수 UI 공유 버튼입니다. */}
            <button className="flex-1 p-3 md:p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl md:rounded-2xl text-white hover:bg-white/10 transition-colors flex items-center justify-center">
                <Share2 size={16} className="md:w-5 md:h-5" />
            </button>
            {/* [로직 해석] 찜하기 상태에 따라 배경색과 하트 색상이 빨갛게 채워지거나(fill-current) 투명하게 토글됩니다. */}
            <button 
                onClick={handleToggleLike}
                className={`flex-1 p-3 md:p-4 border rounded-xl md:rounded-2xl transition-colors flex items-center justify-center backdrop-blur-md ${
                    isLiked 
                    ? "bg-red-500/10 border-red-500 text-red-500" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
            >
                <Heart size={16} className={`md:w-5 md:h-5 ${isLiked ? "fill-current" : ""}`} />
            </button>
        </div>

        {/* [코드 해석] 팝업스토어의 날짜와 오픈/마감 시간을 명시적으로 보여주는 정보 카드 섹션입니다. */}
        <div className="bg-[#111] border border-white/10 rounded-2xl md:rounded-3xl p-5 md:p-6 space-y-3 md:space-y-4 shadow-2xl relative z-30">
            {/* [코드 해석] 운영 기간(Period)을 표시하는 좌우 분할 레이아웃입니다. */}
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Calendar size={16} className="md:w-5 md:h-5"/>
                </div>
                <div>
                    <p className="text-[9px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">Period</p>
                    <p className="font-bold text-white/90 text-xs md:text-base">{popup.openDate} ~ {popup.closeDate}</p>
                </div>
            </div>
            {/* [코드 해석] 구역을 나누기 위한 얇은 가로선(디바이더)입니다. */}
            <div className="w-full h-px bg-white/5"/>
            {/* [코드 해석] 오픈 시간(Open Time)을 표시하는 좌우 분할 레이아웃입니다. 데이터가 없으면 기본값(11:00-20:00)을 씁니다. */}
            <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Clock size={16} className="md:w-5 md:h-5"/>
                </div>
                <div>
                    <p className="text-[9px] md:text-[10px] text-white/40 font-bold uppercase tracking-widest">Open Time</p>
                    <p className="font-bold text-white/90 text-xs md:text-base">{popup.openTime || "11:00"} - {popup.closeTime || "20:00"}</p>
                </div>
            </div>
        </div>

        {/* [로직 해석] 관리자가 백엔드에 입력해둔 긴 상세 설명 글이 렌더링되는 영역입니다. */}
        <div className="space-y-3 md:space-y-4 relative z-30">
            {/* [코드 해석] About This Spot 이라는 섹션 제목입니다. */}
            <h3 className="text-lg md:text-xl font-black text-indigo-400 italic flex items-center gap-1.5 md:gap-2 uppercase tracking-tighter">
                <Info size={16} className="md:w-5 md:h-5"/> About This Spot
            </h3>
            {/* [로직 해석] whitespace-pre-line 클래스를 통해 글의 엔터(줄바꿈)를 그대로 살려주고, 링크 변환 함수를 거친 내용을 출력합니다. */}
            <div className="bg-[#111] p-5 md:p-7 rounded-2xl md:rounded-3xl border border-white/10 text-white/80 leading-relaxed font-medium whitespace-pre-line shadow-inner text-xs md:text-base">
                {renderContentWithLinks(popup.content)}
            </div>
        </div>

        {/* [로직 해석] 사용자가 팝업스토어 위치를 찾을 수 있도록 카카오 지도를 보여주는 영역입니다. */}
        <div className="w-full h-[250px] md:h-[350px] rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 relative z-30 shadow-2xl bg-[#111]">
            {/* [코드 해석] DetailMap 자식 컴포넌트에 파싱된 위경도를 넘겨주어 지도를 로드합니다. */}
            <DetailMap latitude={lat} longitude={lng} />
            {/* [코드 해석] 지도 하단 중앙에 플로팅 형태로 실제 도로명 주소 텍스트를 띄웁니다. */}
            <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl px-4 py-2 md:px-5 md:py-2.5 rounded-full border border-white/20 text-[10px] md:text-xs flex items-center gap-1.5 md:gap-2 shadow-2xl z-40 whitespace-nowrap text-white font-bold w-[90%] md:w-auto overflow-hidden">
                <MapPin size={12} className="md:w-3.5 md:h-3.5 text-indigo-500 animate-bounce shrink-0"/> 
                <span className="truncate">{popup.address}</span>
            </div>
        </div>

        {/* [로직 해석] 팝업스토어별로 독립된 소켓 통신을 기반으로 유저 간 실시간 채팅을 지원하는 모듈입니다. */}
        <div className="pt-6 md:pt-10 relative z-30">
             {/* [코드 해석] 실시간 느낌을 주기 위해 제목 옆에 빨간 점이 깜빡이는(animate-ping) 디자인을 넣었습니다. */}
             <h3 className="text-lg md:text-xl font-black text-indigo-400 italic flex items-center gap-1.5 md:gap-2 uppercase tracking-tighter mb-4 md:mb-6">
                Live Visitor Talk <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-red-500 animate-ping"></span>
             </h3>
             {/* [코드 해석] 팝업 고유 ID를 채팅방 방번호로 쓰고, 유저의 닉네임을 넘겨주어 채팅 인스턴스를 생성합니다. */}
             <ChatRoom roomId={popup.id} nickname={user?.nickname || "익명"} />
        </div>

      </div>
    </main>
  );
}