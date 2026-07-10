"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  Share2, Trash2, MapPin, Users, Search, PlusCircle, X, Loader2, UserPlus,
  ThumbsUp, Flame, Footprints, MoveDown, Wand2, Navigation, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import InteractiveMap from "../../src/components/Map/InteractiveMap"; 

import { API_BASE_URL, SOCKET_BASE_URL } from "../../src/lib/api";
import { notify, confirmAction } from "@/lib/notify";

interface MarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  likeCount: number;
  fireCount: number;
}

interface SearchResult {
    id: number;
    name: string;
    location: string;
    latitude: string;
    longitude: string;
}

interface Participant {
    name: string;
    color: string;
}

const getRandomColor = () => {
    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-lime-300", "bg-lime-300", "bg-hot-400"];
    return colors[Math.floor(Math.random() * colors.length)];
};

// API 실패 시 보여줄 직선 경로 생성 로직
const generateMockRoute = (start: MarkerData, end: MarkerData) => {
    const points = [];
    const steps = 10; 
    for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        points.push({
            lat: start.lat + (end.lat - start.lat) * ratio,
            lng: start.lng + (end.lng - start.lng) * ratio
        });
    }
    return points;
};

// OSRM 오픈소스 API를 사용하여 실제 도보 경로 가져오기 로직
const fetchRealRoute = async (start: MarkerData, end: MarkerData) => {
    try {
        const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map((coord: number[]) => ({
                    lat: coord[1], 
                    lng: coord[0]  
                }));
            }
        }
        return generateMockRoute(start, end); 
    } catch (e) {
        console.error("OSRM API Error:", e);
        return generateMockRoute(start, end); 
    }
};

// 거리/시간 계산 로직 (Haversine 공식 적용)
const calculateRouteInfo = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c; 
    const walkingDist = distKm * 1.3; 
    const minutes = Math.round((walkingDist * 1000) / 67); 
    const distStr = walkingDist < 1 ? `${Math.round(walkingDist * 1000)}m` : `${walkingDist.toFixed(1)}km`;
    return { dist: distStr, time: minutes };
};

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [routePaths, setRoutePaths] = useState<{ lat: number; lng: number }[][]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const stompClientRef = useRef<Client | null>(null);
  
  const [myInfo, setMyInfo] = useState({ name: "", color: getRandomColor() });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 총 소요 시간 계산 로직
  const totalTime = markers.reduce((acc, curr, idx) => {
      if (idx === 0) return 0;
      const prev = markers[idx - 1];
      return acc + calculateRouteInfo(prev.lat, prev.lng, curr.lat, curr.lng).time;
  }, 0);

  // 마커 변경 시 경로 데이터 업데이트 효과
  useEffect(() => {
      const updateRoutes = async () => {
          if (markers.length < 2) {
              setRoutePaths([]);
              return;
          }
          const promises = [];
          for (let i = 0; i < markers.length - 1; i++) {
              promises.push(fetchRealRoute(markers[i], markers[i + 1]));
          }
          const results = await Promise.all(promises);
          setRoutePaths(results);
      };
      updateRoutes();
  }, [markers]);

  // 동선 최적화 알고리즘
  const optimizeRoute = async () => {
      if (markers.length < 3) return notify("최적화하려면 장소가 3개 이상 필요합니다!");
      if (!(await confirmAction({ text: "현재 위치를 시작점으로 최적 경로를 계산하시겠습니까?" }))) return;

      let sorted = [markers[0]];
      let remaining = markers.slice(1);

      while (remaining.length > 0) {
          const last = sorted[sorted.length - 1];
          let nearestIdx = 0;
          let minDist = Infinity;

          remaining.forEach((m, i) => {
              const dist = Math.sqrt(Math.pow(last.lat - m.lat, 2) + Math.pow(last.lng - m.lng, 2));
              if (dist < minDist) {
                  minDist = dist;
                  nearestIdx = i;
              }
          });
          sorted.push(remaining[nearestIdx]);
          remaining.splice(nearestIdx, 1);
      }
      setMarkers(sorted);
      notify("⚡ 동선이 최적화되었습니다!");
  };

  const sendVote = (placeId: string, voteType: "LIKE" | "FIRE") => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    const voteMessage = { placeId, voteType, sender: myInfo.name };
    stompClientRef.current.publish({ destination: `/app/plan/${roomId}/vote`, body: JSON.stringify(voteMessage) });
  };

  const addPlaceToMap = (place: SearchResult) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return notify("서버와 연결 중입니다.");
    if (markers.some(m => m.name === place.name)) return notify("이미 추가된 장소입니다.");
    const dataStr = `${place.name}|${place.latitude}|${place.longitude}`;
    stompClientRef.current.publish({ destination: `/app/plan/${roomId}/action`, body: JSON.stringify({ type: "ADD", data: dataStr, sender: myInfo.name }) });
  };

  const removeMarker = (m: MarkerData) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    const dataStr = `${m.name}|${m.lat}|${m.lng}`;
    stompClientRef.current.publish({ destination: `/app/plan/${roomId}/action`, body: JSON.stringify({ type: "REMOVE", data: dataStr, sender: myInfo.name }) });
  };

  const inviteFriend = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    notify("🔗 초대 링크가 복사되었습니다!");
  };

  useEffect(() => {
    if (!roomId) { notify("잘못된 접근입니다."); router.push("/"); return; }
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { notify("로그인이 필요한 서비스입니다."); router.push("/login"); return; }
    const userData = JSON.parse(storedUser);
    const myNickname = userData.nickname || "Unknown";
    setMyInfo(prev => ({ ...prev, name: myNickname }));

    interface PlanningRoomState {
      markers?: string[];
      users?: string[];
      votes?: Record<string, number>;
    }

    fetch(`${API_BASE_URL}/api/planning/${roomId}/state`)
      .then(res => res.json())
      .then((data: PlanningRoomState) => {
        if (data.markers) {
            setMarkers(data.markers.map((str: string) => {
                const [name, lat, lng] = str.split("|");
                const generatedId = name + lat + lng;
                const likeCount = data.votes ? (data.votes[`${generatedId}:LIKE`] || 0) : 0;
                const fireCount = data.votes ? (data.votes[`${generatedId}:FIRE`] || 0) : 0;
                return { id: generatedId, name, lat: parseFloat(lat), lng: parseFloat(lng), likeCount: Number(likeCount), fireCount: Number(fireCount) };
            }));
        }
        if (data.users) {
            setParticipants(data.users.map((str: string) => {
                const [name, color] = str.split("|");
                return { name, color };
            }));
        }
      });

    const socket = new SockJS(`${SOCKET_BASE_URL}/ws-planning`);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        setIsConnected(true);
        const myDataStr = `${myNickname}|${myInfo.color}`;
        client.publish({ destination: `/app/plan/${roomId}/action`, body: JSON.stringify({ type: "JOIN", data: myDataStr, sender: myNickname }) });

        client.subscribe(`/topic/plan/${roomId}`, (message) => {
          const action = JSON.parse(message.body);
          if (action.type === "VOTE") {
             setMarkers(prev => prev.map(m => m.id === action.placeId ? { ...m, likeCount: action.voteType === "LIKE" ? action.count : m.likeCount, fireCount: action.voteType === "FIRE" ? action.count : m.fireCount } : m));
             return; 
          }
          if (action.type === "ADD") {
            const [name, lat, lng] = action.data.split("|");
            setMarkers(prev => [...prev, { id: name + lat + lng, name, lat: parseFloat(lat), lng: parseFloat(lng), likeCount: 0, fireCount: 0 }]);
          } else if (action.type === "REMOVE") {
            const [name, lat, lng] = action.data.split("|");
            setMarkers(prev => prev.filter(m => m.id !== name + lat + lng));
          } else if (action.type === "CLEAR") setMarkers([]);
          else if (action.type === "JOIN") {
             const [name, color] = action.data.split("|");
             setParticipants(prev => prev.some(p => p.name === name) ? prev : [...prev, { name, color }]);
          } else if (action.type === "LEAVE") {
             const [name] = action.data.split("|");
             setParticipants(prev => prev.filter(p => p.name !== name));
          }
        });

        // 코스 탭 "작전지도에서 함께 짜기"로 넘어온 경우: sessionStorage 에 담긴 추천 코스를
        // 기존 ADD 액션으로 리플레이해 방을 시드한다(백엔드 변경 불필요). 1회만 하고 즉시 비운다.
        try {
          const seedRaw = sessionStorage.getItem("planningSeedCourse");
          if (seedRaw) {
            sessionStorage.removeItem("planningSeedCourse");
            const seed: { name: string; lat: number; lng: number }[] = JSON.parse(seedRaw);
            const valid = seed.filter(
              (p) => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng),
            );
            valid.forEach((p) => {
              const dataStr = `${p.name}|${p.lat}|${p.lng}`;
              client.publish({
                destination: `/app/plan/${roomId}/action`,
                body: JSON.stringify({ type: "ADD", data: dataStr, sender: myNickname }),
              });
            });
            if (valid.length > 0) notify("추천 코스를 작전지도로 옮겼어요. 함께 편집해보세요!");
          }
        } catch {
          /* 시드 파싱 실패는 무시 */
        }
      },
      onDisconnect: () => setIsConnected(false),
    });
    client.activate();
    stompClientRef.current = client;
    return () => { if (client) client.deactivate(); };
  }, [roomId, router, myInfo.color]); // myInfo.color 의존성 추가

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/popups/search?keyword=${searchQuery}`);
        if (res.ok) setSearchResults(await res.json());
      } catch (e) {
          console.error("Search error:", e);
      } finally { setIsSearching(false); }
  };

  return (
    // 🚀 모바일에서 위아래로 분리, 데스크탑에서 좌우로 분리되도록 flex-col md:flex-row 적용
    <div className="h-[100dvh] flex flex-col md:flex-row bg-[#111] text-white overflow-hidden">
      
      {/* 🚀 지도 영역 반응형: 모바일은 45vh 높이, PC는 전체 높이 채움 */}
      <div className="flex-1 relative h-[45vh] md:h-full border-b md:border-b-0 md:border-r border-white/10 shrink-0">
        <InteractiveMap 
            mode="PLAN" 
            places={markers.map(m => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng, category: 'PLAN' }))} 
            showPath={true} 
            routePaths={routePaths} 
        />
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 px-2.5 py-1.5 md:px-3 md:py-1.5 bg-black/80 backdrop-blur rounded-full border border-white/10 flex items-center gap-1.5 md:gap-2 shadow-xl">
           <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
           <span className="text-[9px] md:text-[10px] font-bold text-gray-300">{isConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* 🚀 리스트 및 검색 영역: 모바일은 55vh 높이, PC는 400px 폭 고정 */}
      <div className="w-full md:w-[400px] flex flex-col bg-[#1a1a1a] h-[55vh] md:h-full">
        
        {/* 상단 정보 패널 */}
        <div className="p-3 md:p-5 border-b border-white/10 bg-[#1a1a1a]">
            <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className="flex items-start gap-2">
                    <button
                        onClick={() => router.push("/?entered=1")}
                        aria-label="메인으로 돌아가기"
                        className="mt-0.5 inline-flex items-center justify-center size-7 md:size-8 rounded-full bg-white/8 hover:bg-white/15 text-gray-300 hover:text-white transition-colors ring-1 ring-white/10 hover:ring-white/20"
                    >
                        <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" />
                    </button>
                    <div>
                        <h2 className="font-bold text-base md:text-lg flex items-center gap-1.5 md:gap-2 text-lime-300"><Navigation size={16} className="md:w-[18px] md:h-[18px]"/> 작전 회의실</h2>
                        <p className="text-[9px] md:text-[10px] text-gray-500 font-mono mt-0.5 md:mt-1">ROOM ID: {roomId}</p>
                    </div>
                </div>
                <button onClick={inviteFriend} className="px-2.5 py-1.5 md:px-3 md:py-1.5 bg-lime-300 hover:bg-lime-400 text-ink-900 rounded-full text-[10px] md:text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-md">
                    <UserPlus size={12} className="md:w-3.5 md:h-3.5"/> 초대
                </button>
            </div>
            
            {/* 접속자 목록 */}
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                {participants.map((p, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 min-w-[36px] md:min-w-[40px]">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${p.color} border-2 border-[#1a1a1a] flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md`}>
                            {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[9px] md:text-[10px] text-gray-400 truncate max-w-[40px] md:max-w-[50px]">{p.name === myInfo.name ? "나" : p.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* 검색 영역 */}
        <div className="p-3 md:p-4 border-b border-white/5 bg-[#1f1f1f]">
            <form onSubmit={handleSearch} className="relative">
                <input type="text" placeholder="성수동 팝업 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-lg md:rounded-xl py-2.5 md:py-3 pl-9 md:pl-10 pr-4 text-xs md:text-sm text-white focus:outline-none focus:border-lime-300 transition-colors"/>
                <Search size={14} className="md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                {isSearching && <Loader2 size={14} className="md:w-4 md:h-4 absolute right-3 top-1/2 -translate-y-1/2 text-lime-500 animate-spin"/>}
            </form>
            
            {/* 검색 결과 */}
            {searchResults.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-2 md:mt-3 max-h-[120px] md:max-h-[150px] overflow-y-auto custom-scrollbar bg-[#111] rounded-lg md:rounded-xl border border-white/5">
                    {searchResults.map((place) => (
                        <div key={place.id} onClick={() => addPlaceToMap(place)} className="flex justify-between items-center p-2.5 md:p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 group">
                            <div><div className="text-xs md:text-sm font-bold text-gray-200 group-hover:text-lime-300">{place.name}</div><div className="text-[9px] md:text-[10px] text-gray-500 truncate max-w-[150px] md:max-w-[200px] mt-0.5">{place.location}</div></div>
                            <PlusCircle size={14} className="md:w-4 md:h-4 text-gray-500 group-hover:text-lime-500"/>
                        </div>
                    ))}
                </motion.div>
            )}
        </div>

        {/* 요약 바 */}
        <div className="px-3 py-2.5 md:px-4 md:py-3 bg-ink-900/20 border-b border-lime-300/20 flex items-center justify-between">
            <div>
                <div className="flex items-center gap-1.5 md:gap-2 text-lime-400 text-[10px] md:text-xs font-bold"><Footprints size={12} className="md:w-3.5 md:h-3.5"/> 총 이동 시간</div>
                <div className="text-white font-bold text-xs md:text-sm mt-0.5">약 {totalTime}분 <span className="text-[9px] md:text-xs font-normal text-gray-400">소요 예상</span></div>
            </div>
            {markers.length >= 3 && (
                <button onClick={optimizeRoute} className="px-2.5 py-1.5 md:px-3 md:py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold text-yellow-400 flex items-center gap-1 transition-colors">
                    <Wand2 size={10} className="md:w-3 md:h-3"/> 최적화
                </button>
            )}
        </div>

        {/* 마커 리스트 */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-0 custom-scrollbar relative pb-20 md:pb-4">
            <div className="text-[10px] md:text-xs font-bold text-gray-500 mb-3 md:mb-4 px-1 flex items-center gap-1"><MapPin size={10} className="md:w-3 md:h-3"/> 추가된 장소 ({markers.length})</div>
            {markers.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-gray-600 text-[10px] md:text-xs"><p>아직 추가된 장소가 없습니다.<br/>위에서 검색하여 코스를 짜보세요!</p></div>
            ) : (
                <AnimatePresence>
                {markers.map((m, idx) => {
                    let routeInfo = null;
                    if (idx < markers.length - 1) {
                        const nextM = markers[idx + 1];
                        routeInfo = calculateRouteInfo(m.lat, m.lng, nextM.lat, nextM.lng);
                    }
                    return (
                        <div key={m.id} className="relative">
                            <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} 
                                        className="flex flex-col p-3 md:p-4 bg-[#222] rounded-lg md:rounded-xl border border-white/5 group hover:border-lime-300/30 transition-colors z-10 relative">
                                <div className="flex justify-between items-center mb-2.5 md:mb-3">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-lime-300/20 text-lime-300 flex items-center justify-center text-[9px] md:text-[10px] font-bold">{idx + 1}</div>
                                        <div><div className="font-bold text-xs md:text-sm text-gray-200">{m.name}</div><div className="text-[8px] md:text-[10px] text-gray-500 mt-0.5">lat: {m.lat.toFixed(4)}</div></div>
                                    </div>
                                    <button onClick={() => removeMarker(m)} className="p-1.5 md:p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-md md:rounded-lg transition-all"><Trash2 size={12} className="md:w-3.5 md:h-3.5"/></button>
                                </div>
                                <div className="flex gap-1.5 md:gap-2">
                                    <button onClick={() => sendVote(m.id, "LIKE")} className="flex-1 flex items-center justify-center gap-1 md:gap-1.5 py-1 md:py-1.5 rounded-md md:rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all active:scale-95">
                                        <ThumbsUp size={10} className={`md:w-3 md:h-3 ${m.likeCount > 0 ? "fill-blue-400" : ""}`} /> <span className="text-[10px] md:text-xs font-bold">{m.likeCount}</span>
                                    </button>
                                    <button onClick={() => sendVote(m.id, "FIRE")} className="flex-1 flex items-center justify-center gap-1 md:gap-1.5 py-1 md:py-1.5 rounded-md md:rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all active:scale-95">
                                        <Flame size={10} className={`md:w-3 md:h-3 ${m.fireCount > 0 ? "fill-red-400" : ""}`} /> <span className="text-[10px] md:text-xs font-bold">{m.fireCount}</span>
                                    </button>
                                </div>
                            </motion.div>
                            
                            {/* 소요 시간 선 */}
                            {routeInfo && (
                                <div className="flex flex-col items-center my-0.5 md:my-1 relative z-0">
                                    <div className="h-3 md:h-4 border-l-2 border-dashed border-gray-700"></div>
                                    <div className="bg-gray-800 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold text-gray-400 border border-gray-700 flex items-center gap-1 shadow-sm">
                                        <MoveDown size={8} className="md:w-2.5 md:h-2.5" /> <span>도보 {routeInfo.time}분</span> <span className="text-gray-600">|</span> <span>{routeInfo.dist}</span>
                                    </div>
                                    <div className="h-3 md:h-4 border-l-2 border-dashed border-gray-700"></div>
                                </div>
                            )}
                        </div>
                    );
                })}
                </AnimatePresence>
            )}
        </div>
      </div>
    </div>
  );
}