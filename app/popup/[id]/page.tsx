"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, MapPin, Calendar, Clock, Share2, Heart, CheckCircle, Ticket, 
  Sun, Moon, ExternalLink, Info, AlertCircle 
} from "lucide-react";
import { motion, Variants } from "framer-motion";
import { useTheme } from "next-themes"; 

import DetailMap from "../../../src/components/Map/DetailMap"; 
import ChatRoom from "../../../src/components/ChatRoom";
import DigitalTicket from "../../../src/components/DigitalTicket"; 
import { apiFetch } from "../../../src/lib/api";

// ✅ [로직 해석] 카카오 맵 SDK의 타입을 전역으로 선언하여 TypeScript 에러를 방지합니다.
declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoRoadviewProps {
  lat: number;
  lng: number;
  name: string;
}

// ✅ [로직 해석] 로드뷰 전용 컴포넌트입니다. 상세 페이지 내에서 별도로 활용 가능하도록 분리된 구조입니다.
export function KakaoRoadview({ lat, lng, name }: KakaoRoadviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // [로직 해석] 브라우저 환경이 아니거나 카카오 객체가 없으면 실행을 중단합니다.
    if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) return;

    const container = containerRef.current;
    if (!container) return;

    window.kakao.maps.load(() => {
      const position = new window.kakao.maps.LatLng(lat, lng);
      const rv = new window.kakao.maps.Roadview(container);
      const rvClient = new window.kakao.maps.RoadviewClient();

      // [로직 해석] 좌표 기준 반경 50m 내 로드뷰 panoId를 조회하여 로드뷰를 띄웁니다.
      rvClient.getNearestPanoId(position, 50, (panoId: number | null) => {
        if (panoId) {
          rv.setPanoId(panoId, position);
          // [로직 해석] 로드뷰 위에 나타날 커스텀 오버레이 HTML 마크업입니다.
          const content = `
            <div style="padding: 10px 16px; background: #ffeb33; border-radius: 16px; border: 3px solid #000; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 8px; transform: translateY(-60px);">
              <div style="width: 10px; height: 10px; background: red; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
              <span style="color: #000; font-weight: 900; font-size: 15px; white-space: nowrap;">${name}</span>
            </div>
            <style>
              @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
            </style>
          `;

          new window.kakao.maps.CustomOverlay({
            position: position,
            content: content,
            map: rv 
          });
        } else {
          setIsError(true);
        }
      });
    });
  }, [lat, lng, name]);

  if (isError) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
        <AlertCircle size={48} className="mb-4 text-red-500 opacity-80" />
        <p className="text-lg font-bold">로드뷰를 표시할 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

interface PopupDetail {
  id: number; name: string; content: string; address: string; category: string;
  status?: string; openDate?: string; closeDate?: string; openTime?: string; closeTime?: string;
  latitude?: string; longitude?: string;
}

export default function PopupDetail() {
  const params = useParams();
  const router = useRouter();
  const { theme, setTheme } = useTheme(); 
  
  const [popup, setPopup] = useState<PopupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStamped, setIsStamped] = useState(false); 
  const [isLiked, setIsLiked] = useState(false); 
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  const TEST_USER_ID = "test_user";

  // ✅ [로직 해석] 텍스트 내 https로 시작하는 문자열을 정규식으로 찾아 클릭 가능한 <a> 태그로 치환합니다.
  const renderContentWithLinks = (text: string) => {
    if (!text) return "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-indigo-500 hover:text-indigo-400 underline break-all inline-flex items-center gap-1"
          >
            {part} <ExternalLink size={14} />
          </a>
        );
      }
      return part;
    });
  };

  // ✅ [로직 해석] 컴포넌트 마운트 시 로컬스토리지에서 유저 정보를 확인하고 없으면 로그인 페이지로 튕깁니다.
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
        alert("로그인이 필요합니다.");
        router.replace("/login"); 
    } else {
        setUser(JSON.parse(storedUser));
        setIsCheckingAuth(false); 
    }
  }, [router]);

  // ✅ [로직 해석] API를 통해 특정 팝업스토어의 상세 정보를 가져와 상태(popup)에 저장합니다.
  useEffect(() => {
    if (isCheckingAuth) return;

    apiFetch(`/api/popups/${params.id}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(response => {
        const data = response.data || response; 
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
        setLoading(false);
        checkIfStamped(data.popupId || data.id);
        checkWishlistStatus(data.popupId || data.id);
      })
      .catch(() => setLoading(false));
  }, [params.id, isCheckingAuth]);

  // ✅ [로직 해석] 유저가 해당 팝업에 대해 오늘 이미 스탬프를 찍었는지 서버에서 확인합니다.
  const checkIfStamped = async (popupId: number) => {
      const userIdToCheck = user?.userId || TEST_USER_ID;
      try {
          const res = await apiFetch(`/api/stamps/my?userId=${userIdToCheck}`);
          if (res.ok) {
              const myStamps = await res.json();
              const todayString = new Date().toISOString().split('T')[0];
              const hasStampToday = myStamps.some((s: any) => {
                  const dbDate = s.stampDate?.split('T')[0]; 
                  return s.popupStore.popupId === popupId && dbDate === todayString;
              });
              setIsStamped(hasStampToday);
          }
      } catch (e) { console.error(e); }
  };

  // ✅ [로직 해석] 위시리스트 목록을 가져와 현재 팝업이 포함되어 있는지 여부를 판단합니다.
  const checkWishlistStatus = async (popupId: number) => {
    const userIdToCheck = user?.userId || TEST_USER_ID;
    try {
        const res = await apiFetch(`/api/wishlist/${userIdToCheck}`);
        if (res.ok) {
            const list = await res.json();
            setIsLiked(list.some((item: any) => item.popupId === popupId));
        }
    } catch (e) { console.error(e); }
  };

  // ✅ [로직 해석] 스탬프 찍기 API를 호출하고 성공 시 UI 상태를 갱신합니다.
  const handleStamp = async () => {
    if (!popup) return;
    try {
        const res = await apiFetch(`/api/stamps?userId=${user?.userId}&popupId=${popup.id}`, { method: "POST" });
        if (res.ok) {
            setIsStamped(true);
            alert("🎉 스탬프 완료!");
        }
    } catch (e) { alert("오류 발생"); }
  };

  // ✅ [로직 해석] 찜하기 버튼 클릭 시 서버 통신 전 UI를 먼저 바꾸는 '낙관적 업데이트'를 수행합니다.
  const handleToggleLike = async () => {
    if (!popup || !user) return;
    const prevStatus = isLiked;
    setIsLiked(!isLiked); 
    try {
        const res = await apiFetch(`/api/wishlist/${user.userId}/${popup.id}`, { method: "POST" });
        if (!res.ok) throw new Error();
    } catch (e) {
        setIsLiked(prevStatus); // [로직 해석] 실패 시 원래 상태로 복구합니다.
    }
  };

  if (isCheckingAuth || loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black">LOADING...</div>;
  if (!popup) return null;

  const lat = parseFloat(popup.latitude || "37.5445");
  const lng = parseFloat(popup.longitude || "127.0560");

  const marqueeVariants: Variants = {
    animate: { x: [0, -1000], transition: { x: { repeat: Infinity, repeatType: "loop" as const, duration: 20, ease: "linear" } } },
  };

  // ✅ [구조 분석] 모달과 상세 정보의 겹침 방지를 위해 레이아웃을 전면 보정합니다.
  return (
    // [로직 해석] 전체 화면을 감싸고 overflow-y-auto를 통해 컨텐츠가 길어져도 겹치지 않고 스크롤되게 합니다.
    <main className="min-h-screen bg-[#050505] text-white relative pb-20 overflow-x-hidden overflow-y-auto"> 
      
      {/* 🟢 히어로 섹션: z-index를 낮게 잡아 뒤쪽 배경 역할을 하게 함 (수정된 구조) */}
      <div className="relative h-[60vh] w-full overflow-hidden flex flex-col items-center justify-center z-0">
        
        {/* [로직 해석] 타이포그래피 애니메이션 레이어입니다. */}
        <div className="absolute inset-0 flex flex-col justify-center opacity-10 select-none pointer-events-none overflow-hidden">
            {[...Array(3)].map((_, i) => (
                <motion.div key={i} variants={marqueeVariants} animate="animate" className="whitespace-nowrap text-[15vh] font-black text-white leading-none uppercase">
                    {popup.name} &nbsp; {popup.category} &nbsp;
                </motion.div>
            ))}
        </div>

        {/* [로직 해석] 네비게이션 버튼을 z-index 50으로 두어 가장 위에 위치시킵니다. */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between z-[50]">
            <button onClick={() => router.back()} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all">
                <ArrowLeft size={24} />
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
            </button>
        </div>

        {/* [로직 해석] 디지털 티켓 컴포넌트입니다. */}
        <div className="relative z-10 w-full flex justify-center px-4 mt-10">
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
        
        {/* [로직 해석] 히어로 하단에 그라데이션을 주어 본문과의 경계를 부드럽게 합니다. */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent z-20"></div>
      </div>

      {/* 🟢 상세 정보 컨텐츠: z-index를 높여 히어로 섹션 위로 자연스럽게 배치 (수정된 구조) */}
      <div className="p-6 max-w-3xl mx-auto space-y-10 relative z-30 -mt-10">
        
        {/* [로직 해석] 인증, 공유, 찜하기 버튼 그룹입니다. z-index 40으로 설정하여 티켓 그림자와 겹치지 않게 합니다. */}
        <div className="flex gap-3 relative z-[40]">
            <button 
                onClick={handleStamp}
                disabled={isStamped}
                className={`flex-[3] py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all border ${
                    isStamped 
                    ? "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed" 
                    : "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 border-transparent hover:bg-indigo-500"
                }`}
            >
                {isStamped ? <CheckCircle size={20}/> : <Ticket size={20}/>}
                {isStamped ? "스탬프 인증됨" : "방문 인증 스탬프"}
            </button>
            <button className="flex-1 p-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-colors flex items-center justify-center">
                <Share2 size={20} />
            </button>
            <button 
                onClick={handleToggleLike}
                className={`flex-1 p-4 border rounded-2xl transition-colors flex items-center justify-center backdrop-blur-md ${
                    isLiked 
                    ? "bg-red-500/10 border-red-500 text-red-500" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                }`}
            >
                <Heart size={20} className={isLiked ? "fill-current" : ""} />
            </button>
        </div>

        {/* [로직 해석] 운영 정보 카드입니다. */}
        <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative z-30">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Calendar size={20}/>
                </div>
                <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Period</p>
                    <p className="font-bold text-white/90">{popup.openDate} ~ {popup.closeDate}</p>
                </div>
            </div>
            <div className="w-full h-px bg-white/5"/>
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                    <Clock size={20}/>
                </div>
                <div>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Open Time</p>
                    <p className="font-bold text-white/90">{popup.openTime || "11:00"} - {popup.closeTime || "20:00"}</p>
                </div>
            </div>
        </div>

        {/* [로직 해석] 팝업스토어 상세 설명 영역입니다. */}
        <div className="space-y-4 relative z-30">
            <h3 className="text-xl font-black text-indigo-400 italic flex items-center gap-2 uppercase tracking-tighter">
                <Info size={20}/> About This Spot
            </h3>
            <div className="bg-[#111] p-7 rounded-3xl border border-white/10 text-white/80 leading-relaxed font-medium whitespace-pre-line shadow-inner">
                {renderContentWithLinks(popup.content)}
            </div>
        </div>

        {/* [로직 해석] 카카오 지도가 렌더링되는 영역입니다. */}
        <div className="w-full h-[350px] rounded-3xl overflow-hidden border border-white/10 relative z-30 shadow-2xl bg-[#111]">
            <DetailMap latitude={lat} longitude={lng} />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20 text-xs flex items-center gap-2 shadow-2xl z-40 whitespace-nowrap text-white font-bold">
                <MapPin size={14} className="text-indigo-500 animate-bounce"/> {popup.address}
            </div>
        </div>

        {/* [로직 해석] 실시간 채팅 기능인 ChatRoom 컴포넌트입니다. */}
        <div className="pt-10 relative z-30">
             <h3 className="text-xl font-black text-indigo-400 italic flex items-center gap-2 uppercase tracking-tighter mb-6">
                Live Visitor Talk <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
             </h3>
             <ChatRoom roomId={popup.id} nickname={user?.nickname || "익명"} />
        </div>

      </div>
    </main>
  );
}