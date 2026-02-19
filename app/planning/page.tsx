"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { 
  Share2, Trash2, MapPin, Users, Search, PlusCircle, X, Loader2, UserPlus, 
  ThumbsUp, Flame, Footprints, MoveDown, Wand2, Navigation 
} from "lucide-react"; 
import { motion, AnimatePresence } from "framer-motion";

import InteractiveMap from "../../src/components/Map/InteractiveMap"; 

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
    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-pink-500"];
    return colors[Math.floor(Math.random() * colors.length)];
};

// 🔥 [추가] API가 실패하거나 로딩 중일 때 보여줄 '가짜 경로(직선)' 생성 함수
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

// 🔥 [수정됨] TMAP 대신 'OSRM 오픈소스 API'를 사용하여 실제 도보 경로 가져오기
// 별도의 API Key나 설정이 필요 없습니다.
const fetchRealRoute = async (start: MarkerData, end: MarkerData) => {
    try {
        // OSRM API 호출 (좌표 순서: 경도(lng), 위도(lat))
        const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        
        const res = await fetch(url);
        
        if (res.ok) {
            const data = await res.json();
            
            // OSRM 데이터 파싱 (GeoJSON [lng, lat] -> { lat, lng } 변환)
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].geometry.coordinates.map((coord: number[]) => ({
                    lat: coord[1], // 위도
                    lng: coord[0]  // 경도
                }));
            }
        }
        // 실패 시 가짜 경로(직선) 반환
        return generateMockRoute(start, end); 
    } catch (e) {
        console.error("OSRM API Error:", e);
        return generateMockRoute(start, end); 
    }
};

// 거리/시간 계산 (Haversine Formula + 보정)
const calculateRouteInfo = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c; 
    const walkingDist = distKm * 1.3; // 도보 굴곡 보정
    const minutes = Math.round((walkingDist * 1000) / 67); 
    const distStr = walkingDist < 1 ? `${Math.round(walkingDist * 1000)}m` : `${walkingDist.toFixed(1)}km`;
    return { dist: distStr, time: minutes };
};

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room");

  const [markers, setMarkers] = useState<MarkerData[]>([]);
  // 지도에 그릴 실제 경로 데이터 (이중 배열)
  const [routePaths, setRoutePaths] = useState<{ lat: number; lng: number }[][]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const stompClientRef = useRef<Client | null>(null);
  
  const [myInfo, setMyInfo] = useState({ name: "", color: getRandomColor() });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 총 소요 시간 계산
  const totalTime = markers.reduce((acc, curr, idx) => {
      if (idx === 0) return 0;
      const prev = markers[idx - 1];
      return acc + calculateRouteInfo(prev.lat, prev.lng, curr.lat, curr.lng).time;
  }, 0);

  // 🔥 [핵심 로직] 마커 변경 시 OSRM API를 통해 경로 데이터 업데이트
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

  // 동선 최적화 (Greedy Algorithm)
  const optimizeRoute = () => {
      if (markers.length < 3) return alert("최적화하려면 장소가 3개 이상 필요합니다!");
      if (!confirm("현재 위치를 시작점으로 최적 경로를 계산하시겠습니까?")) return;

      let sorted = [markers[0]];
      let remaining = markers.slice(1);

      while (remaining.length > 0) {
          const last = sorted[sorted.length - 1];
          let nearestIdx = 0;
          let minDist = Infinity;

          remaining.forEach((m, i) => {
              const { rawDist } = calculateRouteInfo(last.lat, last.lng, m.lat, m.lng) as any; // rawDist는 내부 계산용
              // 간단한 거리 비교를 위해 직접 계산
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
      alert("⚡ 동선이 최적화되었습니다!");
  };

  const sendVote = (placeId: string, voteType: "LIKE" | "FIRE") => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return;
    const voteMessage = { placeId, voteType, sender: myInfo.name };
    stompClientRef.current.publish({ destination: `/app/plan/${roomId}/vote`, body: JSON.stringify(voteMessage) });
  };

  const addPlaceToMap = (place: SearchResult) => {
    if (!stompClientRef.current || !stompClientRef.current.connected) return alert("서버와 연결 중입니다.");
    if (markers.some(m => m.name === place.name)) return alert("이미 추가된 장소입니다.");
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
    alert("🔗 초대 링크가 복사되었습니다!\n친구에게 보내주세요.");
  };

  useEffect(() => {
    if (!roomId) { alert("잘못된 접근입니다."); router.push("/"); return; }
    const storedUser = localStorage.getItem("user");
    if (!storedUser) { alert("로그인이 필요한 서비스입니다."); router.push("/login"); return; }
    const userData = JSON.parse(storedUser);
    const myNickname = userData.nickname || "Unknown";
    setMyInfo(prev => ({ ...prev, name: myNickname }));

    fetch(`http://localhost:8080/api/planning/${roomId}/state`)
      .then(res => res.json())
      .then((data: any) => {
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

    const socket = new SockJS("http://localhost:8080/ws-planning");
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
      },
      onDisconnect: () => setIsConnected(false),
    });
    client.activate();
    stompClientRef.current = client;
    return () => { if (client) client.deactivate(); };
  }, [roomId, router]);

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      try {
        const res = await fetch(`http://localhost:8080/api/popups/search?keyword=${searchQuery}`);
        if (res.ok) setSearchResults(await res.json());
      } catch (e) {} finally { setIsSearching(false); }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#111] text-white overflow-hidden">
      {/* 🗺️ 왼쪽: 지도 영역 */}
      <div className="flex-1 relative h-[50vh] md:h-full border-r border-white/10">
        <InteractiveMap 
           mode="PLAN" 
           places={markers.map(m => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng, category: 'PLAN' }))} 
           showPath={true} 
           routePaths={routePaths} // 🔥 실제 경로(OSRM) 데이터 전달
        />
        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-black/80 backdrop-blur rounded-full border border-white/10 flex items-center gap-2 shadow-xl">
           <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
           <span className="text-[10px] font-bold text-gray-300">{isConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* 📝 오른쪽: 사이드바 */}
      <div className="w-full md:w-[400px] flex flex-col bg-[#1a1a1a] h-[50vh] md:h-full">
        {/* 헤더 */}
        <div className="p-5 border-b border-white/10 bg-[#1a1a1a]">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="font-bold text-lg flex items-center gap-2 text-indigo-400"><Navigation size={18}/> 작전 회의실</h2>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">ROOM ID: {roomId}</p>
                </div>
                <button onClick={inviteFriend} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-full text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-indigo-500/20">
                    <UserPlus size={14}/> 초대하기
                </button>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                {participants.map((p, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 min-w-[40px]">
                        <div className={`w-10 h-10 rounded-full ${p.color} border-2 border-[#1a1a1a] flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                            {p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-gray-400 truncate max-w-[50px]">{p.name === myInfo.name ? "나" : p.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* 검색 영역 */}
        <div className="p-4 border-b border-white/5 bg-[#1f1f1f]">
            <form onSubmit={handleSearch} className="relative">
                <input type="text" placeholder="성수동 팝업 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"/>
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"/>
                {isSearching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin"/>}
            </form>
            {searchResults.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 max-h-[150px] overflow-y-auto custom-scrollbar bg-[#111] rounded-xl border border-white/5">
                    {searchResults.map((place) => (
                        <div key={place.id} onClick={() => addPlaceToMap(place)} className="flex justify-between items-center p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 group">
                            <div><div className="text-sm font-bold text-gray-200 group-hover:text-indigo-400">{place.name}</div><div className="text-[10px] text-gray-500 truncate max-w-[200px]">{place.location}</div></div>
                            <PlusCircle size={16} className="text-gray-500 group-hover:text-indigo-500"/>
                        </div>
                    ))}
                </motion.div>
            )}
        </div>

        {/* 요약 & 최적화 버튼 */}
        <div className="px-4 py-3 bg-indigo-900/20 border-b border-indigo-500/20 flex items-center justify-between">
            <div>
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold"><Footprints size={14}/> 총 이동 시간</div>
                <div className="text-white font-bold text-sm">약 {totalTime}분 <span className="text-xs font-normal text-gray-400">소요 예상</span></div>
            </div>
            {markers.length >= 3 && (
                <button onClick={optimizeRoute} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs font-bold text-yellow-400 flex items-center gap-1 transition-colors">
                    <Wand2 size={12}/> 동선 최적화
                </button>
            )}
        </div>

        {/* 추가된 마커 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-0 custom-scrollbar relative">
            <div className="text-xs font-bold text-gray-500 mb-4 px-1 flex items-center gap-1"><MapPin size={12}/> 추가된 장소 ({markers.length})</div>
            {markers.length === 0 ? (
                <div className="text-center py-12 text-gray-600 text-xs"><p>아직 추가된 장소가 없습니다.<br/>위에서 검색하여 코스를 짜보세요!</p></div>
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
                                        className="flex flex-col p-4 bg-[#222] rounded-xl border border-white/5 group hover:border-indigo-500/30 transition-colors z-10 relative">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                        <div><div className="font-bold text-sm text-gray-200">{m.name}</div><div className="text-[10px] text-gray-500">lat: {m.lat.toFixed(4)}</div></div>
                                    </div>
                                    <button onClick={() => removeMarker(m)} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={14}/></button>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => sendVote(m.id, "LIKE")} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all active:scale-95">
                                        <ThumbsUp size={12} className={m.likeCount > 0 ? "fill-blue-400" : ""} /> <span className="text-xs font-bold">{m.likeCount}</span>
                                    </button>
                                    <button onClick={() => sendVote(m.id, "FIRE")} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all active:scale-95">
                                        <Flame size={12} className={m.fireCount > 0 ? "fill-red-400" : ""} /> <span className="text-xs font-bold">{m.fireCount}</span>
                                    </button>
                                </div>
                            </motion.div>
                            {routeInfo && (
                                <div className="flex flex-col items-center my-1 relative z-0">
                                    <div className="h-4 border-l-2 border-dashed border-gray-700"></div>
                                    <div className="bg-gray-800 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 border border-gray-700 flex items-center gap-1 shadow-sm">
                                        <MoveDown size={10} /> <span>도보 {routeInfo.time}분</span> <span className="text-gray-600">|</span> <span>{routeInfo.dist}</span>
                                    </div>
                                    <div className="h-4 border-l-2 border-dashed border-gray-700"></div>
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