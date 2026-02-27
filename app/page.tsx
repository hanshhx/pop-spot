"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // 🔥 useSearchParams 추가
import { 
  Search, MapPin, ArrowUpRight, Flame, Calendar, Menu, Users, 
  Instagram, Twitter, Plus, X, ArrowUp, ArrowDown, Minus, 
  Map as MapIcon, Route, Ticket, User, LogOut, Sparkles, Lock, ArrowRight, Loader2, RefreshCw,
  Shirt, Video, ShoppingBag, Crown, GripVertical, PlusCircle, Zap, MessageCircle, Heart, Star, Gift, Megaphone,
  FolderOpen, Save, Trash2, Store, ShieldCheck
} from "lucide-react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Link from "next/link";

// 🔥 [Algolia] 클라이언트 설정
import { liteClient as algoliasearch } from "algoliasearch/lite"; 
import { InstantSearch, useSearchBox, useHits } from "react-instantsearch";

import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';

import InteractiveMap from "../src/components/Map/InteractiveMap";
import PassportView from "../src/components/Passport/PassportView";
import ThemeToggle from "../src/components/ThemeToggle"; 
import AIReportModal from "../src/components/AIReportModal"; 
import LiveChatTicker from "../src/components/LiveChatTicker";
import { SortableItem } from "../src/components/SortableItem";
import MateBoard from "../src/components/MateBoard"; 
import { apiFetch, API_BASE_URL, SOCKET_BASE_URL } from "../src/lib/api";

const searchClient = algoliasearch("EWZCTMAVQS", "f28e121d432930f092ec55cea220efda");

function CustomSearchBox(props: any) {
  const { query, refine } = useSearchBox(props);
  return (
    <div className="relative w-full group/input">
        <input
            type="text"
            value={query}
            onChange={(e) => refine(e.target.value)}
            placeholder="지역, 팝업 이름, 카테고리 검색..."
            className="w-full rounded-full py-4 pl-12 pr-4 transition-all focus:outline-none bg-gray-100 border border-gray-300 text-gray-900 dark:bg-black/40 dark:border-white/10 dark:text-white dark:placeholder:text-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
    </div>
  );
}

function CustomHits() {
  const { hits, results } = useHits();
  const { query } = useSearchBox();
  if (!query) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-4 bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar">
      {hits.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-white/50 text-sm">
              검색 결과가 없습니다.
          </div>
      ) : (
          hits.map((hit: any) => (
            <Link key={hit.objectID} href={`/popup/${hit.objectID}`}>
                <div className="flex items-center gap-4 p-4 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-none group">
                    {hit.imageUrl ? (
                        <img src={hit.imageUrl} alt={hit.name} className="w-12 h-12 rounded-xl object-cover bg-gray-200"/>
                    ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400">
                            <Store size={20}/>
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h4 className="text-gray-900 dark:text-white font-bold text-sm truncate group-hover:text-indigo-500 transition-colors">
                            {hit.name}
                        </h4>
                        <p className="text-gray-500 dark:text-white/50 text-xs flex items-center gap-1 mt-0.5 truncate">
                            <MapPin size={10} /> {hit.location || "위치 정보 없음"}
                        </p>
                    </div>
                    <ArrowRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors -ml-2 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 duration-300"/>
                </div>
            </Link>
          ))
      )}
      <div className="px-4 py-2 bg-gray-50 dark:bg-white/5 text-[10px] text-right text-gray-400 flex justify-end items-center gap-1">
          Search by <span className="font-bold text-indigo-500">Algolia</span> ⚡️
      </div>
    </div>
  );
}

interface PopupStore {
  id: number;
  name: string;
  location: string;
  status: string;
  viewCount: number;
  prevRank?: number;
  latitude?: string;
  longitude?: string;
  category?: string;
  rankChange?: number;
}

interface CongestionData {
    level: string;
    message: string;
    minPop: number;
    maxPop: number;
    temp: string;
    sky: string;
    rainChance: string;
    forecast: any[];
    ageRates: any;
    aiComment?: string;
}

interface TrendOotd {
    type: string;
    comment: string;
    data: {
        keyword: string;
        photographer: string;
        videoUrl: string;
        thumbnail: string;
    } | null;
}

interface MyPageData {
    nickname: string;
    isPremium: boolean;
    premiumExpiryDate: string | null;
    megaphoneCount: number;
    stampCount: number;
    likeCount: number;
    reviewCount: number;
}

interface WishlistItem {
    wishlistId: number;
    popupId: number;
    popupName: string;
    popupImage: string;
    location: string;
    startDate: string;
    endDate: string;
}

const INITIAL_MY_COURSE: any[] = [];

// [로직 해석] 쿠키 읽기용 헬퍼 함수
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const [hotPopups, setHotPopups] = useState<PopupStore[]>([]);
  const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  // 🔥 [추가] 팝업 제보 모달창 상태를 관리하는 State입니다.
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);

  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("MAP");
  const [user, setUser] = useState<any>(null);
  const [myPageInfo, setMyPageInfo] = useState<MyPageData | null>(null);
  const [savedCourses, setSavedCourses] = useState<any[]>([]);
  const [myWishlist, setMyWishlist] = useState<WishlistItem[]>([]);
  const [aiCourse, setAiCourse] = useState<any[]>([]); 
  const [isAiLoading, setIsAiLoading] = useState(false); 
  const [selectedVibe, setSelectedVibe] = useState(""); 
  const [customVibeInput, setCustomVibeInput] = useState(""); 
  const [showCustomInput, setShowCustomInput] = useState(false); 
  const [congestionData, setCongestionData] = useState<CongestionData | null>(null);
  const [ootd, setOotd] = useState<TrendOotd | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [myCourseItems, setMyCourseItems] = useState<any[]>(INITIAL_MY_COURSE);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setMyCourseItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleCopyAiToMyCourse = () => {
      if (aiCourse.length === 0) {
          alert("먼저 AI 추천 코스를 생성해주세요!");
          return;
      }
      setMyCourseItems([...aiCourse]); 
      handleTabChange("MY"); 
      alert("AI 추천 코스가 'MY' 탭에 적용되었습니다! 순서를 자유롭게 수정해보세요.");
  };

  const handleAddPlace = (popup: PopupStore) => {
      const newItem = {
          id: popup.id.toString(), 
          name: popup.name,
          lat: parseFloat(popup.latitude || '37.5445'),
          lng: parseFloat(popup.longitude || '127.0560'),
          category: popup.category || 'POPUP',
          reason: '사용자 추가 장소'
      };
        
      if (myCourseItems.find(item => item.id === newItem.id)) {
          alert("이미 코스에 추가된 장소입니다.");
          return;
      }
      setMyCourseItems([...myCourseItems, newItem]);
      setIsAddPlaceOpen(false); 
  };

  const handleCreateRoom = async () => {
    if (!user) {
        if(confirm("🔒 작전 회의실은 로그인 후 이용 가능합니다.\n로그인 페이지로 이동하시겠습니까?")) {
            router.push("/login");
        }
        return;
    }
    try {
        const res = await apiFetch('/api/planning/create', { method: 'POST' });
        const roomId = await res.text();
        router.push(`/planning?room=${roomId}`);
    } catch (e) {
        alert("서버 연결 실패! 백엔드를 실행해주세요.");
    }
  };

  const fetchMyPageData = async (userId: string) => {
      try {
          const res = await apiFetch(`/api/mypage/${userId}`);
          if (res.ok) {
              const data = await res.json();
              setMyPageInfo(data);
              if (user) {
                  const updatedUser = { ...user, isPremium: data.isPremium };
                  setUser(updatedUser); 
                  localStorage.setItem("user", JSON.stringify(updatedUser));
              }
          }
      } catch (e) {
          console.error("마이페이지 로드 실패", e);
      }
  };

  const fetchMyCourses = async (userId: string, shouldAutoLoad = false) => {
    try {
        const res = await apiFetch(`/api/my-courses?userId=${userId}`);
        if (res.ok) {
            const data = await res.json();
            setSavedCourses(data); 
            if (shouldAutoLoad && data.length > 0) {
                const latestCourse = data[data.length - 1]; 
                if (latestCourse.courseData) {
                    const parsedItems = JSON.parse(latestCourse.courseData);
                    setMyCourseItems(parsedItems); 
                    console.log("✅ 저장된 코스 자동 로드 완료");
                }
            }
        }
    } catch (e) {
        console.error("코스 불러오기 실패:", e);
    }
  };

  const fetchWishlist = async (userId: string) => {
    try {
        const res = await apiFetch(`/api/wishlist/${userId}`);
        if (res.ok) {
            const data = await res.json();
            setMyWishlist(data);
        }
    } catch (e) {
        console.error("위시리스트 로드 실패:", e);
    }
  };

  const handleRemoveWishlist = async (e: React.MouseEvent, popupId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    if (!confirm("찜 목록에서 삭제하시겠습니까?")) return;

    try {
        const res = await apiFetch(`/api/wishlist/${user.userId}/${popupId}`, {
            method: "DELETE" 
        });
        if (res.ok) {
            setMyWishlist(prev => prev.filter(item => item.popupId !== popupId));
            fetchMyPageData(user.userId);
        } else {
            alert("삭제 실패");
        }
    } catch (e) {
        console.error("찜 삭제 오류:", e);
    }
  };

  const handleLoadCourse = (courseDataStr: string) => {
      if(confirm("이 코스를 불러오시겠습니까?\n현재 편집 중인 내용은 사라집니다.")) {
          setMyCourseItems(JSON.parse(courseDataStr));
          window.scrollTo({ top: 0, behavior: 'smooth' }); 
      }
  }

  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
      e.stopPropagation(); 
      if (!confirm("정말 이 코스를 삭제하시겠습니까?")) return;

      try {
          const res = await apiFetch(`/api/my-courses/${courseId}`, { method: 'DELETE' });
          if (res.ok) {
              alert("코스가 삭제되었습니다.");
              if (user) fetchMyCourses(user.userId); 
          } else {
              alert("삭제 실패");
          }
      } catch (err) {
          console.error(err);
          alert("삭제 중 오류가 발생했습니다.");
      }
  };

  const handleTabChange = (tab: string) => {
    if ((tab === "PASSPORT" || tab === "MY" || tab === "MATE") && !user) {
        if(confirm("🔒 해당 기능은 로그인이 필요합니다.\n로그인 하시겠습니까?")) {
            router.push("/login");
        }
        return;
    }
    setCurrentTab(tab);
    sessionStorage.setItem("lastTab", tab);

    if (tab === "MY" && user) {
        fetchMyPageData(user.userId);
        fetchMyCourses(user.userId);
        fetchWishlist(user.userId); 
    }
  };

  useEffect(() => {
    const tokenFromUrl = searchParams.get("accessToken"); 
    const userId = searchParams.get("userId");
    const nickname = searchParams.get("nickname");
    const isPremium = searchParams.get("isPremium");

    if (tokenFromUrl && userId) {
      localStorage.setItem("token", tokenFromUrl);
      const socialUser = {
        userId: userId,
        nickname: nickname ? decodeURIComponent(nickname) : "User",
        isPremium: isPremium === "true",
        isSocial: true
      };
      localStorage.setItem("user", JSON.stringify(socialUser));
      setUser(socialUser);

      fetchMyCourses(userId, true);
      fetchWishlist(userId);
      if (sessionStorage.getItem("lastTab") === "MY") {
          fetchMyPageData(userId);
      }

      router.replace("/");
      console.log("✅ [소셜 로그인] URL 파라미터 기반 인증 및 데이터 연동 성공");
    }
  }, [searchParams, router]);

  useEffect(() => {
    apiFetch('/api/popups')
        .then(res => res.json())
        .then(data => {
            setAllPopups(data);
            const sortedData = [...data].sort((a: PopupStore, b: PopupStore) => (b.viewCount || 0) - (a.viewCount || 0));
            setHotPopups(sortedData.slice(0, 5)); 
        })
        .catch(err => console.error("팝업 데이터 로딩 실패:", err));

    apiFetch('/api/congestion')
      .then(res => res.json())
      .then(data => { if (data && data.level) setCongestionData(data); })
      .catch(err => console.error("혼잡도 데이터 실패:", err));

    apiFetch('/api/trends/ootd')
        .then(res => res.json())
        .then(data => setOotd(data))
        .catch(err => console.error("OOTD 로딩 실패:", err));
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
         
        fetchMyCourses(parsedUser.userId, true);
        fetchWishlist(parsedUser.userId);

        if (sessionStorage.getItem("lastTab") === "MY") {
            fetchMyPageData(parsedUser.userId);
        }
    }

    const savedCourse = sessionStorage.getItem("aiCourseData");
    if (savedCourse) {
      const parsed = JSON.parse(savedCourse);
      setAiCourse(parsed.course);
      setSelectedVibe(parsed.vibe);
    }
      
    const lastTab = sessionStorage.getItem("lastTab");
    if (lastTab) setCurrentTab(lastTab);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("aiCourseData"); 
    setUser(null);
    alert("로그아웃 되었습니다.");
    window.location.reload();
  };

  const handleAiRecommend = async (vibe: string) => {
    if (!vibe.trim()) return alert("원하는 분위기를 입력해주세요!");
    setIsAiLoading(true);
    setAiCourse([]); 
    setSelectedVibe(vibe);
    setShowCustomInput(false); 

    try {
      const res = await apiFetch(`/api/courses/recommend?vibe=${vibe}`);
      if (!res.ok) throw new Error("AI 서버 오류");
      const jsonString = await res.text();
      const result = JSON.parse(jsonString);
      setAiCourse(result);
      sessionStorage.setItem("aiCourseData", JSON.stringify({ vibe: vibe, course: result }));
    } catch (e) {
      alert("AI 연결에 실패했습니다.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleResetCourse = () => {
    setAiCourse([]);
    setSelectedVibe("");
    sessionStorage.removeItem("aiCourseData");
  };

  const handleSaveCourse = async () => {
    if (!user) return alert("로그인이 필요합니다.");
     
    if (!user.isPremium && savedCourses.length > 0) {
        const confirmOverwrite = confirm("🔒 무료 회원은 코스를 1개만 저장할 수 있습니다.\n새로 저장하면 기존 코스는 사라집니다. 계속하시겠습니까?");
        if(!confirmOverwrite) return;
    }

    try {
        const res = await apiFetch("/api/my-courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user.userId,
                courseName: `나만의 코스 (${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString().slice(0,5)})`,
                courseData: JSON.stringify(myCourseItems)
            })
        });

        if (res.ok) {
            alert("✅ 코스가 안전하게 저장되었습니다!");
            fetchMyCourses(user.userId); 
        } else {
            alert("저장 실패: 서버 오류가 발생했습니다.");
        }
    } catch (e) {
        alert("저장 중 오류가 발생했습니다.");
    }
  };

  const handleOpenModal = () => setIsModalOpen(true);

  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const renderRankChange = (change: number) => {
      if (!change || change === 0) return <Minus size={10} className="text-gray-500"/>;
      if (change > 0) return <span className="flex items-center text-red-500 text-[10px]"><ArrowUp size={10}/> {change}</span>;
      return <span className="flex items-center text-blue-500 text-[10px]"><ArrowDown size={10}/> {Math.abs(change)}</span>;
  };

  const getCongestionColor = (level: string) => {
      switch (level) {
          case "여유": return "text-green-500";
          case "보통": return "text-yellow-500";
          case "약간 붐빔": return "text-orange-500";
          case "붐빔": return "text-red-500";
          default: return "text-gray-400";
      }
  };

  const getDday = (dateStr: string | null) => {
      if (!dateStr) return null;
      const expiry = new Date(dateStr);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
  };

  const isAdmin = user?.role?.includes('ADMIN') || user?.email === 'reo4321@naver.com' || user?.userId === 'reo4321@naver.com';

  return (
    <main className="min-h-screen font-sans relative pb-24 overflow-x-hidden transition-colors duration-500 bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      
      <div className="fixed inset-0 z-0 overflow-hidden">
        <video autoPlay loop muted playsInline className="absolute min-w-full min-h-full object-cover">
          <source src="/bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 transition-colors duration-500 bg-white/80 dark:bg-black/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 p-4 md:p-6 max-w-[1600px] mx-auto">
        
        {/* 헤더 */}
        <header className="flex justify-between items-end mb-8 md:mb-10 border-b border-gray-300 dark:border-white/10 pb-4">
          <div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none text-gray-900 dark:text-white transition-colors">
              POP-SPOT<span className="text-primary">.</span>
            </h1>
            <p className="text-xs md:text-sm mt-1 tracking-widest uppercase text-gray-600 dark:text-white/60 transition-colors">
              Seoul Popup Store Intelligence
            </p>
          </div>

          <div className="flex items-center gap-4">
             <ThemeToggle />

             {/* 🔥 [수정] Link가 아닌 onClick으로 모달창을 열도록 변경했습니다. */}
             {user && (
                 <button 
                    onClick={() => setIsReportPopupOpen(true)} 
                    className="hidden md:flex items-center gap-1 px-4 py-2 rounded-full font-bold text-xs border border-indigo-500/50 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                 >
                     <Megaphone size={14} /> 제보하기
                 </button>
             )}

             {isAdmin && (
                 <Link href="/admin" className="hidden md:flex items-center gap-1 px-4 py-2 rounded-full font-bold text-xs border border-red-500/50 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                     <ShieldCheck size={14} /> 관리자
                 </Link>
             )}

             {user ? (
                <div className={`hidden md:flex items-center gap-4 px-4 py-2 rounded-full border backdrop-blur-md transition-colors
                    ${user.isPremium 
                        ? "bg-gradient-to-r from-indigo-900 to-purple-900 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] text-white" 
                        : "bg-white/50 border-gray-300 text-gray-900 dark:bg-white/5 dark:border-white/10 dark:text-white"
                    }`}>
                    <div className="flex items-center gap-2">
                        {user.isPremium && <Crown size={16} className="text-yellow-400 fill-yellow-400 animate-pulse" />}
                        <span className={`text-sm font-bold ${user.isPremium ? "text-white" : "text-indigo-600 dark:text-indigo-400"}`}>
                            Hello, {user.nickname}
                        </span>
                    </div>
                    <div className={`w-px h-3 ${user.isPremium ? "bg-white/30" : "bg-gray-400 dark:bg-white/20"}`}></div>
                    <button onClick={handleLogout} className="text-xs flex items-center gap-1 transition-colors hover:text-red-500 dark:text-white/70 dark:hover:text-white">
                        <LogOut size={14} /> 로그아웃
                    </button>
                </div>
            ) : (
                <div className="hidden md:flex items-center gap-4 text-sm font-medium">
                    <Link href="/login" className="text-gray-700 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors">로그인</Link>
                    <Link href="/signup" className="px-4 py-2 font-bold rounded-full transition-all border
                                                    bg-white/50 border-gray-300 text-gray-900 hover:bg-white 
                                                    dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white dark:hover:text-black">
                        회원가입
                    </Link>
                </div>
            )}
            <button className="p-3 rounded-full transition-all bg-white/50 hover:bg-primary dark:bg-white/5 dark:hover:bg-primary hover:text-black">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* 🟢 [MAP 탭] */}
        {currentTab === "MAP" && (
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
                <div className="mb-6">
                    {user ? (
                        <div className="w-full border rounded-[2rem] p-8 md:p-10 relative overflow-hidden flex items-center justify-between group
                                                bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-200 
                                                dark:from-indigo-900/40 dark:to-violet-900/40 dark:border-indigo-500/30">
                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                             <div className="relative z-10">
                                <h2 className="text-2xl md:text-3xl font-bold mb-2 text-gray-900 dark:text-white">반가워요, <span className="text-indigo-600 dark:text-indigo-400">{user.nickname}</span>님!</h2>
                                <p className="text-sm md:text-base text-gray-700 dark:text-indigo-200">오늘 성수동에 <span className="font-bold text-gray-900 dark:text-white">{allPopups.length}개</span>의 팝업이 열려있어요.</p>
                             </div>
                             <button onClick={() => handleTabChange("PASSPORT")} className="hidden md:flex px-6 py-3 bg-white text-indigo-900 font-bold rounded-xl items-center gap-2 hover:scale-105 transition-transform shadow-lg">
                                <Ticket size={18}/> 내 여권 확인
                             </button>
                        </div>
                    ) : (
                        <div className="w-full border rounded-[2rem] p-8 md:p-12 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 transition-colors
                                                bg-white/60 border-gray-200 backdrop-blur-md
                                                dark:bg-white/5 dark:border-white/10">
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-widest text-white uppercase rounded-full bg-gradient-to-r from-indigo-500 to-purple-500">
                                    Welcome to POP-SPOT
                                </div>
                                <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight text-gray-900 dark:text-white">
                                    Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Vibe</span><br/>
                                    in Seoul.
                                </h2>
                                <p className="text-base text-gray-600 dark:text-white/70 max-w-md">
                                    지금 로그인하고 나만의 팝업 지도를 만들어보세요.<br/>
                                    친구와 함께하는 실시간 동선 계획부터 스탬프 적립까지.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
                                <Link href="/login" className="flex-1 md:flex-none">
                                    <button className="w-full md:w-auto px-8 py-4 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
                                        시작하기 <ArrowRight size={18} />
                                    </button>
                                </Link>
                                <Link href="/signup" className="flex-1 md:flex-none">
                                    <button className="w-full md:w-auto px-8 py-4 font-bold rounded-xl transition-all border
                                                    bg-white text-gray-900 border-gray-300 hover:bg-gray-100 
                                                    dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20">
                                        회원가입
                                    </button>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                <section className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 min-h-[80vh] mb-24">
                    <div className="col-span-1 md:col-span-5 md:row-span-2 rounded-[2rem] p-8 flex flex-col justify-between border backdrop-blur-md transition-colors bg-white/80 border-gray-200 dark:bg-[#111]/80 dark:border-white/5 relative z-50">
                        <InstantSearch searchClient={searchClient} indexName="popups">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-black leading-tight uppercase mb-4 text-gray-900 dark:text-white">
                                    Search <span className="text-primary">Zone.</span>
                                </h2>
                                <div className="mt-8 relative w-full"> 
                                    <CustomSearchBox />
                                </div>
                            </div>
                            
                            <CustomHits />
                        </InstantSearch>
                    </div>
                    
                    <div className="col-span-1 md:col-span-7 md:row-span-4 rounded-[2rem] relative overflow-hidden border border-gray-200 dark:border-white/5 group bg-gray-100 dark:bg-[#111]/80 backdrop-blur-md">
                        <InteractiveMap />
                        <div className="absolute bottom-6 left-6 flex gap-2 z-20">
                            <span className="backdrop-blur px-4 py-2 rounded-full border text-xs font-bold flex items-center gap-2 bg-white/80 border-gray-200 text-gray-900 dark:bg-black/60 dark:border-white/10 dark:text-white">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> LIVE DATA
                            </span>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-5 md:row-span-4 rounded-[2rem] p-6 border flex flex-col backdrop-blur-md transition-colors bg-white/80 border-gray-200 dark:bg-[#111]/80 dark:border-white/5">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2"><Flame className="text-secondary animate-pulse" size={20} /><h3 className="font-bold text-lg text-gray-900 dark:text-white">REAL-TIME RANKING</h3></div>
                            <button onClick={handleOpenModal} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors group"><Plus size={20} className="text-gray-500 dark:text-white/60 group-hover:text-primary transition-colors"/></button>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2">
                            {hotPopups.length > 0 ? (
                            <AnimatePresence>
                                {hotPopups.map((popup: any, idx) => (
                                <Link href={`/popup/${popup.id}`} key={popup.id} onClick={() => handleTabChange("MAP")}>
                                    <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} 
                                                className="flex items-center justify-between p-4 mb-2 rounded-2xl transition-colors cursor-pointer group border bg-white hover:bg-gray-50 border-gray-100 hover:border-gray-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-transparent dark:hover:border-white/10">
                                    <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center w-6"><span className={`text-sm font-black ${idx === 0 ? 'text-primary' : 'text-gray-400 dark:text-white/30'}`}>{idx + 1}</span>{renderRankChange(popup.rankChange)}</div>
                                            <div><span className="font-bold block text-sm text-gray-900 dark:text-white">{popup.name}</span><span className="text-[10px] text-gray-500 dark:text-white/60">{popup.location}</span></div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1"><span className="text-[10px] text-gray-500 dark:text-white/60 flex items-center gap-1"><Users size={10}/> {popup.viewCount}</span><span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${popup.status === '혼잡' ? 'border-secondary/30 text-secondary' : 'border-primary/30 text-primary'}`}>{popup.status || '영업중'}</span></div>
                                    </motion.div>
                                </Link>
                                ))}
                            </AnimatePresence>
                            ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-white/60 text-xs opacity-60"><div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mb-2"></div>실시간 데이터 수신 중...</div>
                            )}
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-4 md:row-span-2 bg-primary/90 backdrop-blur-md text-black rounded-[2rem] p-6 cursor-pointer hover:bg-white transition-colors relative overflow-hidden group">
                        <ArrowUpRight className="absolute top-6 right-6 opacity-30 group-hover:opacity-100 transition-opacity" />
                        <Calendar size={32} /><h3 className="text-2xl font-black mt-2 leading-none uppercase">Popup<br/>Calendar</h3><p className="text-xs font-bold opacity-60 mt-4 pt-4 border-t border-black/10">이번 주 오픈 &rarr;</p>
                    </div>

                    <div onClick={() => setIsReportOpen(true)} className="col-span-1 md:col-span-3 md:row-span-2 rounded-[2rem] p-6 cursor-pointer border flex flex-col justify-between group backdrop-blur-md transition-colors bg-white/80 border-gray-200 hover:border-primary dark:bg-[#111]/80 dark:border-white/5 dark:hover:border-primary">
                        <div className="flex justify-between items-start"><Users size={24} className={`${getCongestionColor(congestionData?.level || '')} group-hover:scale-110 transition-transform`}/><div className="text-right">{congestionData ? (<span className={`text-2xl font-black ${getCongestionColor(congestionData.level)}`}>{congestionData.level}</span>) : (<span className="text-lg font-bold text-gray-400 animate-pulse">분석중...</span>)}</div></div>
                        <div><h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-primary transition-colors">AI Report</h3><p className="text-xs text-gray-500 dark:text-white/60 mt-1">{congestionData ? `성수동 인구 ${congestionData.minPop.toLocaleString()}~${congestionData.maxPop.toLocaleString()}명` : "성수동 혼잡도 분석 중"}</p></div>
                    </div>
                </section>

                <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24">
                    <div className="flex flex-col md:flex-row items-end justify-between mb-12">
                        <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-stroke relative z-10">POP-LOOK<span className="text-white">.</span></h2>
                        <p className="text-gray-500 dark:text-white/60 max-w-md text-right md:text-left mt-4 md:mt-0 relative z-10">성수동 갈 때 뭐 입지?<br/>오늘의 분위기에 딱 맞는 OOTD를 제안합니다.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[500px]">
                        <div className="md:col-span-1 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-gray-200 dark:border-white/10 group bg-black">
                            {ootd?.data ? (
                                <>
                                    <video ref={videoRef} src={ootd.data.videoUrl} poster={ootd.data.thumbnail} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-700"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"/>
                                    <div className="absolute top-6 right-6 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-bold border border-white/20 flex items-center gap-1"><Video size={12}/> Pexels Shorts</div>
                                    <div className="absolute bottom-6 left-6 right-6 text-white"><p className="text-xs font-medium opacity-80 mb-1 uppercase tracking-wider">Today's Pick</p><h3 className="text-2xl font-black leading-none mb-2">{ootd.data.keyword}</h3><p className="text-[10px] opacity-60">Creator: {ootd.data.photographer}</p></div>
                                </>
                            ) : (<div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4"><Loader2 size={32} className="animate-spin"/><span className="text-sm">Fetching OOTD...</span></div>)}
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-6">
                            <div className="flex-1 rounded-[2.5rem] p-10 bg-white/80 dark:bg-[#111]/80 backdrop-blur-lg border border-gray-200 dark:border-white/5 flex flex-col justify-center items-start relative overflow-hidden">
                                <Shirt size={120} className="absolute -right-6 -bottom-6 text-gray-100 dark:text-white/5 rotate-[-15deg]"/>
                                <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 border border-primary/30 px-3 py-1 rounded-full">Daily Style Forecast</span>
                                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">{ootd?.comment || "트렌디한 성수동 바이브를 분석 중입니다..."}</h3>
                                <div className="flex flex-wrap gap-3">{['#SeongsuVibe', '#PopUpStyle', '#OOTD', `#${ootd?.data?.keyword.replace(" ", "") || 'Fashion'}`].map((tag, i) => (<span key={i} className="text-sm text-gray-500 dark:text-white/40 font-medium">{tag}</span>))}</div>
                            </div>
                            <div className="h-32 rounded-[2rem] bg-gradient-to-r from-gray-900 to-black dark:from-white dark:to-gray-200 flex items-center justify-between px-10 relative overflow-hidden group cursor-pointer">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"/>
                                <div className="z-10"><p className="text-gray-400 dark:text-gray-600 text-xs font-bold mb-1">POP-SPOT EXCLUSIVE</p><p className="text-white dark:text-black text-xl font-black">이 코디 입고 방문하면 스탬프 2배? 🎟️</p></div>
                                <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center text-black dark:text-white group-hover:scale-110 transition-transform z-10"><ArrowUpRight size={24}/></div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24 relative">
                    <div className="absolute -top-10 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
                    <LiveChatTicker />
                    <div className="text-center mt-8"><p className="text-sm text-gray-500 dark:text-white/40">* 성수동 현장 유저들이 실시간으로 공유하는 정보입니다.</p></div>
                </motion.section>

                <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24 py-20 px-8 md:px-12 bg-gradient-to-br from-indigo-900 via-gray-900 to-black text-white relative overflow-hidden rounded-[2.5rem] shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                        <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-sm font-bold mb-6">
                                <Users size={16} /> Beta: 실시간 협업 기능
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                                친구와 함께 그리는<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">성수동 작전지도</span>
                            </h2>
                            <p className="text-gray-400 text-lg mb-8 leading-relaxed max-w-lg">
                                "거기 어때?" 링크 공유는 그만.<br />
                                같은 화면을 보며 실시간으로 마커를 찍고 동선을 계획하세요.<br />
                                늦게 온 친구도 Redis가 저장한 기록을 바로 볼 수 있습니다.
                            </p>
                            <button 
                                onClick={handleCreateRoom}
                                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-full hover:bg-indigo-500 focus:outline-none ring-offset-2 focus:ring-2 ring-indigo-400"
                            >
                                <span className="mr-2 text-lg">작전 회의실 만들기</span>
                                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                            </button>
                        </div>

                        <div className="flex-1 w-full max-w-md hidden md:block">
                            <div className="relative bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl transform rotate-3 transition-transform hover:rotate-0 duration-500">
                                <div className="w-full h-64 bg-gray-700/50 rounded-xl mb-4 relative overflow-hidden border border-gray-600/30">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500/20 font-black text-6xl select-none">MAP</div>
                                    <div className="absolute top-1/3 left-1/4 w-8 h-8 bg-pink-500 rounded-full border-4 border-gray-800 animate-bounce shadow-lg flex items-center justify-center text-[10px] font-bold">A</div>
                                    <div className="absolute top-2/3 right-1/3 w-8 h-8 bg-indigo-500 rounded-full border-4 border-gray-800 animate-bounce delay-100 shadow-lg flex items-center justify-center text-[10px] font-bold">B</div>
                                    <div className="absolute bottom-10 right-10 pointer-events-none">
                                            <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
                                            <div className="px-2 py-1 bg-yellow-400 text-black text-[10px] font-bold rounded ml-2 mt-1">친구 입력 중...</div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400"><MapIcon size={16}/></div>
                                        <div className="flex-1">
                                            <div className="h-2 w-24 bg-gray-600 rounded mb-2"></div>
                                            <div className="h-2 w-16 bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

            </motion.div>
        )}

        {/* 🟢 [PASSPORT 탭] */}
        {currentTab === "PASSPORT" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} 
                        className="min-h-[80vh] flex flex-col items-center justify-center rounded-[2.5rem] border mb-24 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10">
              {user ? (<PassportView />) : (
                  <div className="text-center p-8 z-10">
                      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border bg-gray-100 border-gray-200 dark:bg-white/5 dark:border-white/10"><Lock size={40} className="text-gray-400 dark:text-white/50" /></div>
                      <h2 className="text-3xl font-bold mb-3 text-gray-900 dark:text-white">로그인이 필요해요</h2><p className="text-gray-500 dark:text-white/60 mb-8">나만의 팝업 여권을 만들고 스탬프를 모아보세요.</p>
                      <Link href="/login"><button className="px-8 py-3 bg-primary text-black font-bold rounded-xl hover:bg-white transition-colors shadow-lg">로그인 하러가기</button></Link>
                  </div>
              )}
            </motion.div>
        )}

        {/* 🟢 [COURSE 탭] */}
        {currentTab === "COURSE" && (
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                          className="min-h-[80vh] flex flex-col items-center rounded-[2.5rem] border mb-24 p-6 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                <div className="text-center mb-10 z-10 mt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-xs font-bold mb-4 animate-pulse"><Sparkles size={12} /> AI CURATION BETA</div>
                    <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2 text-gray-900 dark:text-white">POP<span className="text-gray-300 dark:text-white/20">-</span>COURSE</h2>
                    <p className="text-gray-500 dark:text-white/60 text-sm">원하는 분위기를 선택하면 AI가 최적의 동선을 추천합니다.</p>
                </div>

                <div className="w-full max-w-3xl z-10 mb-12 flex flex-col gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[{ label: '🔥 핫플 정복', val: '핫플' }, { label: '💖 로맨틱 데이트', val: '데이트' }, { label: '📸 인생샷 투어', val: '사진' }, { label: '🧘 힐링/여유', val: '힐링' }].map((item, idx) => (
                            <button key={idx} onClick={() => handleAiRecommend(item.val)} disabled={isAiLoading}
                                className={`group relative p-6 rounded-3xl border transition-all duration-300 flex flex-col items-center gap-3 hover:scale-105 shadow-sm hover:shadow-md ${selectedVibe === item.val ? "bg-indigo-600 border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.6)] text-white" : "bg-white border-gray-200 hover:bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"}`}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${selectedVibe === item.val ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'}`}>{item.label.split(' ')[0]}</div>
                                <span className={`font-bold text-sm ${selectedVibe === item.val ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{item.label.split(' ')[1]}</span>
                                {isAiLoading && selectedVibe === item.val && (<div className="absolute inset-0 bg-black/50 rounded-3xl flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>)}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col items-center mt-2">
                        {!showCustomInput ? (
                            <button onClick={() => setShowCustomInput(true)} className="text-sm flex items-center gap-2 transition-colors border-b border-transparent pb-1 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 dark:text-white/50 dark:hover:text-indigo-400 dark:hover:border-indigo-400">
                                <Sparkles size={14} /> 찾는 분위기가 없나요? 직접 입력하기
                            </button>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full max-w-md gap-2">
                                <input type="text" value={customVibeInput} onChange={(e) => setCustomVibeInput(e.target.value)} placeholder="예: 비 오는 날 가기 좋은..." className="flex-1 rounded-xl px-4 py-3 transition-all focus:outline-none focus:border-indigo-500 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/30" onKeyDown={(e) => e.key === 'Enter' && handleAiRecommend(customVibeInput)}/>
                                <button onClick={() => handleAiRecommend(customVibeInput)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 rounded-xl font-bold transition-colors shadow-lg">추천</button>
                                <button onClick={() => setShowCustomInput(false)} className="p-3 rounded-xl transition-colors bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50"><X size={18} /></button>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="w-full max-w-3xl z-10 min-h-[300px]">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-left font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                            {isAiLoading ? <Loader2 className="animate-spin text-indigo-500"/> : <Route size={20} className="text-indigo-500"/>}
                            {isAiLoading ? "AI가 코스를 짜고 있어요..." : (aiCourse.length > 0 ? "AI RECOMMENDED COURSE" : "원하는 분위기를 선택해보세요!")}
                        </h3>
                        {aiCourse.length > 0 && !isAiLoading && (
                             <button onClick={handleResetCourse} className="text-xs flex items-center gap-1 transition-colors text-gray-500 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400"><RefreshCw size={12}/> 초기화</button>
                        )}
                    </div>

                    {!isAiLoading && aiCourse.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                                    className="rounded-3xl p-8 border relative overflow-hidden group hover:border-indigo-500/50 transition-colors shadow-xl bg-white border-gray-200 dark:bg-[#1a1a1a] dark:border-white/10">
                            <div className="absolute top-0 right-0 p-10 opacity-5"><MapIcon size={150} /></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <span className="text-xs font-bold text-white bg-indigo-600 px-3 py-1 rounded-full mb-3 inline-block shadow-md">FOR YOU</span>
                                        <h4 className="text-2xl font-bold text-gray-900 dark:text-white">성수동 <span className="text-indigo-600 dark:text-indigo-400">{selectedVibe}</span> 맞춤 코스</h4>
                                        <p className="text-gray-500 dark:text-white/50 text-sm mt-1">AI가 제안하는 최적의 동선입니다.</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {aiCourse.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 group/item">
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10">{idx + 1}</div>
                                                {idx < aiCourse.length - 1 && (<div className="w-0.5 flex-1 transition-colors my-2 bg-gray-200 group-hover/item:bg-indigo-200 dark:bg-white/10 dark:group-hover/item:bg-indigo-600/50"></div>)}
                                            </div>
                                            <div className="flex-1 pb-6 cursor-pointer" onClick={() => router.push(`/popup/${item.id}`)}>
                                                <div className="p-4 rounded-2xl border transition-colors shadow-sm bg-gray-200 hover:bg-indigo-50 hover:border-indigo-200 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10">
                                                    <div className="flex justify-between items-center mb-1"><h5 className="font-bold text-lg text-gray-900 dark:text-white">{item.name}</h5><ArrowRight size={16} className="text-gray-400 dark:text-white/30" /></div>
                                                    <p className="text-sm mb-2 text-indigo-600 dark:text-indigo-200/80">"{item.reason}"</p>
                                                    <div className="flex gap-2"><span className="text-[10px] px-2 py-0.5 rounded border bg-white border-gray-200 text-gray-500 dark:bg-black/30 dark:border-white/5 dark:text-white/50">POP-UP</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={handleCopyAiToMyCourse}
                                    className="w-full py-4 mt-4 bg-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-white transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                >
                                  <MapIcon size={18} /> 전체 경로 지도에서 보기 (MY 탭으로 이동)
                                </button>
                                
                                <button onClick={handleSaveCourse} className="w-full py-4 mt-3 bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20">
                                    <Ticket size={18} /> 내 코스로 저장하기
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        )}

        {/* 🟢 [MY 탭] - 🔥 저장된 코스 목록 & 위시리스트 */}
        {currentTab === "MY" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                        className="h-[85vh] flex flex-col md:flex-row overflow-hidden rounded-[2.5rem] border backdrop-blur-md mb-24 transition-colors relative
                                    bg-white/80 border-gray-200 
                                    dark:bg-[#111]/80 dark:border-white/10">
                
                {/* 1. 지도 영역 (왼쪽) */}
                <div className="w-full md:w-[55%] h-[40vh] md:h-full relative border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5">
                    <InteractiveMap 
                        places={myCourseItems} 
                        showPath={true} 
                        center={myCourseItems.length > 0 ? { lat: myCourseItems[0].lat, lng: myCourseItems[0].lng } : undefined}
                    />
                    <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-black/80 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-200 dark:border-white/10">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Sparkles size={12} /> My Course Preview
                        </span>
                    </div>
                </div>

                {/* 2. 대시보드 & 리스트 영역 (오른쪽) */}
                <div className="w-full md:w-[45%] h-full flex flex-col bg-white dark:bg-[#111] relative overflow-y-auto custom-scrollbar pb-20">
                    
                    {/* [섹션 1] 내 활동 요약 (Dashboard) */}
                    <div className="p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <User size={18} className="text-indigo-500"/> Activity Dashboard
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 dark:bg-[#222] p-4 rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <Heart size={20} className="mx-auto mb-1 text-red-500"/>
                                <div className="text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.likeCount || 0}</div>
                                <div className="text-[10px] text-gray-500">찜한 팝업</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-[#222] p-4 rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <Ticket size={20} className="mx-auto mb-1 text-indigo-500"/>
                                <div className="text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.stampCount || 0}<span className="text-sm text-gray-400 font-normal">/12</span></div>
                                <div className="text-[10px] text-gray-500">획득 스탬프</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-[#222] p-4 rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <MessageCircle size={20} className="mx-auto mb-1 text-green-500"/>
                                <div className="text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.reviewCount || 0}</div>
                                <div className="text-[10px] text-gray-500">리뷰/톡</div>
                            </div>
                        </div>
                    </div>

                    {/* [섹션 2] 아이템 보관함 (Inventory) */}
                    <div className="p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Gift size={18} className="text-indigo-500"/> Inventory
                        </h3>
                        <div className="space-y-3">
                            {/* POP-PASS 카드 */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                                myPageInfo?.isPremium 
                                ? "bg-gradient-to-r from-indigo-900 to-purple-900 border-indigo-500 text-white shadow-lg"
                                : "bg-gray-50 dark:bg-[#222] border-gray-100 dark:border-white/5 text-gray-400"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                        <Crown size={20} className={myPageInfo?.isPremium ? "text-yellow-400" : "text-gray-400"}/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">POP-PASS</div>
                                        <div className="text-xs opacity-70">
                                            {myPageInfo?.isPremium 
                                                ? `${getDday(myPageInfo?.premiumExpiryDate)}일 남음`
                                                : "미보유"}
                                        </div>
                                    </div>
                                </div>
                                <Link href="/shop">
                                    <button className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-bold">
                                        {myPageInfo?.isPremium ? "연장하기" : "구매하기"}
                                    </button>
                                </Link>
                            </div>

                            {/* 확성기 카드 */}
                            <div className="p-4 rounded-2xl border bg-gray-50 dark:bg-[#222] border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Megaphone size={20} className="text-green-600 dark:text-green-400"/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">메이트 확성기</div>
                                        <div className="text-xs text-gray-500 dark:text-white/50">보유 수량: {myPageInfo?.megaphoneCount || 0}개</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        if((myPageInfo?.megaphoneCount || 0) > 0) {
                                            alert("동행 게시판 글쓰기 화면에서 사용할 수 있습니다!");
                                            handleTabChange("MATE");
                                        } else {
                                            if(confirm("확성기가 없습니다. 상점으로 이동할까요?")) router.push("/shop");
                                        }
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-bold ${
                                        (myPageInfo?.megaphoneCount || 0) > 0 
                                        ? "bg-indigo-600 text-white hover:bg-indigo-500" 
                                        : "bg-gray-200 text-gray-400 dark:bg-white/5 cursor-not-allowed"
                                    }`}
                                >
                                    사용하기
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 🔥 [섹션 3] 찜한 팝업 (Wishlist - 실제 연동 완료) */}
                    <div className="p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Heart size={18} className="text-red-500"/> Wishlist
                        </h3>
                        {myWishlist.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-xs border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                아직 찜한 팝업스토어가 없습니다.<br/>
                                마음에 드는 팝업에 하트를 눌러보세요!
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {myWishlist.map((item, i) => (
                                    <div key={i} className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#222]">
                                            {/* 이미지 (없으면 대체 이미지) */}
                                            {item.popupImage ? (
                                                <img src={item.popupImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Store size={24} />
                                                </div>
                                            )}
                                            
                                            {/* 텍스트 오버레이 */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                                                <span className="text-white text-xs font-bold truncate">{item.popupName}</span>
                                                <span className="text-white/60 text-[10px] truncate">{item.location}</span>
                                            </div>

                                            {/* 삭제 버튼 (우상단) */}
                                            <button 
                                                onClick={(e) => handleRemoveWishlist(e, item.popupId)}
                                                className="absolute top-2 right-2 bg-black/50 backdrop-blur rounded-full p-1.5 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100" 
                                                title="찜 해제"
                                            >
                                                <Heart size={12} className="fill-current"/>
                                            </button>

                                            {/* 상세보기 링크 (전체 영역) */}
                                            <Link href={`/popup/${item.popupId}`} className="absolute inset-0 z-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* [섹션 4-1] 저장된 코스 목록 (History) */}
                    <div className="p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <FolderOpen size={18} className="text-indigo-500"/> Saved Courses
                        </h3>
                        
                        {savedCourses.length === 0 ? (
                            <div className="text-center text-gray-400 py-4 text-xs">
                                아직 저장된 코스가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {savedCourses.map((course: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-gray-50 dark:bg-[#222] border-gray-200 dark:border-white/5 hover:border-indigo-500 transition-colors cursor-pointer group"
                                     onClick={() => handleLoadCourse(course.courseData)}>
                                    <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">{course.courseName}</div>
                                                <div className="text-xs text-gray-500">클릭하여 불러오기</div>
                                            </div>
                                    </div>
                                    
                                    {/* 삭제 버튼 추가 */}
                                    <button 
                                        onClick={(e) => handleDeleteCourse(e, course.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="삭제하기"
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                    </div>
                                ))}
                                {!user.isPremium && savedCourses.length >= 1 && (
                                    <div className="mt-2 text-xs text-center text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg">
                                        🔒 무료 회원은 코스를 1개만 저장할 수 있습니다.<br/>새로 저장하면 이 코스는 삭제됩니다.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* [섹션 4-2] 내 코스 관리 (기존 DND 기능) */}
                    <div className="p-6">
                        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                            <Route size={18} className="text-indigo-500"/> Current Plan
                        </h3>
                        
                        {myCourseItems.length === 0 && (
                            <div className="text-center text-gray-400 py-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl mb-4 text-xs">
                                현재 편집 중인 코스가 없습니다.<br/>위 목록에서 불러오거나 새로 추가하세요!
                            </div>
                        )}

                        <DndContext 
                            sensors={sensors} 
                            collisionDetection={closestCenter} 
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={myCourseItems} 
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-2">
                                    {myCourseItems.map((place, index) => (
                                        <div key={place.id} className="relative group">
                                            <SortableItem id={place.id} place={place} index={index} />
                                            <button 
                                                onClick={() => {
                                                    const newItems = myCourseItems.filter(i => i.id !== place.id);
                                                    setMyCourseItems(newItems);
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                title="삭제"
                                            >
                                                <X size={12}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        <button 
                            onClick={() => setIsAddPlaceOpen(true)}
                            className="w-full py-3 mt-4 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl text-gray-500 dark:text-white/50 hover:border-indigo-500 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 font-bold text-sm"
                        >
                            <PlusCircle size={16} /> 장소 추가하기
                        </button>

                        <button onClick={handleSaveCourse} className="w-full py-4 mt-4 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                            <Save size={18}/> <span>현재 코스 저장하기</span>
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAddPlaceOpen && (
                            <motion.div 
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                className="absolute inset-0 bg-white dark:bg-[#111] z-50 flex flex-col"
                            >
                                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">장소 추가하기</h3>
                                    <button onClick={() => setIsAddPlaceOpen(false)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    {allPopups.map((popup) => (
                                        <div key={popup.id} onClick={() => handleAddPlace(popup)} 
                                             className="flex justify-between items-center p-4 mb-2 border border-gray-100 dark:border-white/5 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-sm text-gray-900 dark:text-white">{popup.name}</h4>
                                                <p className="text-xs text-gray-500 dark:text-white/50">{popup.location}</p>
                                            </div>
                                            <PlusCircle size={18} className="text-indigo-500" />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        )}

        {currentTab === "MATE" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                        className="min-h-[80vh] rounded-[2.5rem] border mb-24 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10 shadow-2xl">
                <MateBoard user={user} />
            </motion.div>
        )}

      </div>

      <footer className="relative z-10 border-t py-12 md:py-20 rounded-t-[3rem] mt-12 pb-32 backdrop-blur-xl transition-colors
                        bg-gray-100 border-gray-300 
                        dark:bg-black/80 dark:border-white/10">
        <div className="max-w-[1600px] mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="col-span-1 md:col-span-2">
                <h2 className="text-3xl font-black mb-4 text-gray-900 dark:text-white">POP-SPOT<span className="text-primary">.</span></h2>
                <p className="text-gray-500 dark:text-white/60 max-w-sm mb-6 leading-relaxed text-sm">서울의 모든 팝업스토어를 연결합니다. <br/>데이터 기반의 스마트한 오프라인 경험을 제공합니다.</p>
                <div className="flex gap-4">
                    <a href="#" className="p-3 rounded-full transition-colors bg-white hover:bg-primary hover:text-black dark:bg-white/5">
                        <Instagram size={20} className="text-gray-700 dark:text-white"/>
                    </a>
                    <a href="#" className="p-3 rounded-full transition-colors bg-white hover:bg-primary hover:text-black dark:bg-white/5">
                        <Twitter size={20} className="text-gray-700 dark:text-white"/>
                    </a>
                </div>
            </div>
            <div>
                <h4 className="font-bold mb-6 uppercase tracking-wider text-sm text-gray-900 dark:text-white">Platform</h4>
                <ul className="space-y-3 text-sm text-gray-500 dark:text-white/60">
                    <li><a href="#" className="hover:text-primary transition-colors">지도 보기</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">팝업 캘린더</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">AI 혼잡도 분석</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">매거진</a></li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold mb-6 uppercase tracking-wider text-sm text-gray-900 dark:text-white">Partners</h4>
                <ul className="space-y-3 text-sm text-gray-500 dark:text-white/60">
                    <li><a href="#" className="hover:text-primary transition-colors">파트너 등록</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">비즈니스 문의</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">광고 안내</a></li>
                </ul>
            </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-300 dark:border-white/10 text-center max-w-[1200px] mx-auto px-6">
            <div className="bg-gray-200 dark:bg-white/5 rounded-xl p-6 text-xs text-gray-600 dark:text-white/40 leading-relaxed border border-gray-300 dark:border-white/5">
                <p className="font-bold mb-2 text-gray-900 dark:text-white text-sm">⚠️ [포트폴리오 안내] 본 사이트는 상업적 목적이 없는 개인 개발용 포트폴리오입니다.</p>
                <p className="mb-2">
                    제공되는 모든 팝업 정보, 이미지, 혼잡도 데이터는 학습 목적으로 크롤링되거나 시뮬레이션된 데이터이며 실제와 다를 수 있습니다.<br/>
                    실제 티켓 예매 및 결제는 이루어지지 않으며, 금전적 거래를 요구하지 않습니다.
                </p>
                <p>
                    콘텐츠와 관련하여 저작권 및 기타 문제가 있을 경우, 아래 이메일로 연락 주시면 즉시 삭제 및 수정 조치하겠습니다.
                </p>
                <p className="mt-4 font-bold text-indigo-600 dark:text-indigo-400">Contact: [reo4321@naver.com]</p>
                <p className="mt-4 opacity-50">© 2026 POP-SPOT Portfolio Project. All rights reserved.</p>
            </div>
        </div>
      </footer>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 rounded-full p-2 px-6 shadow-2xl backdrop-blur-xl border transition-colors
                        bg-white/80 border-gray-200 
                        dark:bg-black/70 dark:border-white/10">
            <DockItem icon={<MapIcon size={20} />} label="지도" isActive={currentTab === "MAP"} onClick={() => handleTabChange("MAP")} />
            <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1"></div>
            <DockItem icon={<Route size={20} />} label="코스" isActive={currentTab === "COURSE"} onClick={() => handleTabChange("COURSE")} />
            <Link href="/shop">
                <button className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10`}>
                    <ShoppingBag size={20} />
                </button>
            </Link>
            <DockItem icon={<Ticket size={20} />} label="패스포트" isActive={currentTab === "PASSPORT"} onClick={() => handleTabChange("PASSPORT")} />
            <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1"></div>
            <DockItem icon={<User size={20} />} label="MY" isActive={currentTab === "MY"} onClick={() => handleTabChange("MY")} />
            
            <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1"></div>
            <DockItem icon={<Users size={20} className={currentTab === "MATE" ? "text-indigo-500" : ""} />} label="동행" isActive={currentTab === "MATE"} onClick={() => handleTabChange("MATE")} />
        </div>
      </div>

      {/* 실시간 랭킹 모달 */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }} 
                            className="relative w-full max-w-5xl h-[85vh] rounded-[2.5rem] p-8 flex flex-col shadow-2xl overflow-hidden border transition-colors bg-white border-gray-200 dark:bg-[#0a0a0a] dark:border-white/10">
                    <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200 dark:border-white/5">
                        <div>
                        <h2 className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">ALL TRENDING<span className="text-primary text-5xl animate-pulse">.</span></h2>
                        <p className="text-sm text-gray-500 dark:text-white/60 mt-2">서울에서 가장 핫한 팝업스토어 실시간 랭킹</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="p-3 rounded-full transition-colors group bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/20">
                            <X size={24} className="text-gray-900 dark:text-white group-hover:rotate-90 transition-transform duration-300"/>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
                        {allPopups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-white/60 space-y-4">
                                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-2"></div>
                                <span className="text-sm tracking-widest uppercase">Fetching Live Data...</span>
                            </div>
                        ) : (
                            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence>
                                {allPopups.map((popup, idx) => (
                                    <Link href={`/popup/${popup.id}`} key={popup.id} onClick={() => setIsModalOpen(false)}>
                                        <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} 
                                                    className="relative flex items-center justify-between p-5 rounded-2xl transition-all duration-300 group hover:translate-y-[-2px] hover:shadow-lg border bg-white border-gray-200 hover:border-primary/50 dark:bg-[#111] dark:bg-gradient-to-br dark:from-white/5 dark:to-transparent dark:border-white/5">
                                        <div className="flex items-center gap-5">
                                                <div className="w-12 text-center">
                                                    <span className={`text-3xl font-black italic tracking-tighter ${idx < 3 ? 'text-transparent bg-clip-text bg-gradient-to-br from-primary to-white drop-shadow-md' : 'text-gray-300 dark:text-white/20'}`}>{idx + 1}</span>
                                                </div>
                                                <div>
                                                    <span className="font-bold text-lg block mb-1 transition-colors duration-300 truncate max-w-[200px] md:max-w-[280px] text-gray-900 group-hover:text-primary dark:text-white">{popup.name}</span>
                                                    <span className="text-xs flex items-center gap-1 text-gray-500 dark:text-white/60"><MapPin size={12}/> {popup.location}</span>
                                                </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 pl-4">
                                                <div className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-black/30 dark:text-white/60"><Users size={10}/> {popup.viewCount || 0}</div>
                                                <span className={`text-[11px] px-3 py-1.5 rounded-full border font-bold whitespace-nowrap shrink-0 tracking-wider ${popup.status === '혼잡' ? 'border-secondary/50 text-secondary bg-secondary/10' : 'border-primary/50 text-primary bg-primary/10'}`}>{popup.status || '영업중'}</span>
                                        </div>
                                        </motion.div>
                                    </Link>
                                ))}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* AI 혼잡도 모달 */}
      <AnimatePresence>
        {isReportOpen && congestionData && (
            <AIReportModal 
            data={congestionData} 
            onClose={() => setIsReportOpen(false)} 
            />
        )}
      </AnimatePresence>

      {/* 🔥 [추가] 팝업스토어 제보하기 모달창 */}
      <AnimatePresence>
        {isReportPopupOpen && (
            <ReportPopupModal 
                user={user} 
                onClose={() => setIsReportPopupOpen(false)} 
            />
        )}
      </AnimatePresence>

    </main>
  );
}

function DockItem({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
        isActive 
        ? "bg-gray-900 text-white scale-110 shadow-lg dark:bg-white dark:text-black" 
        : "text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
    }`}>
      {icon}
      {isActive && <span className="text-[9px] font-bold mt-0.5">{label}</span>}
    </button>
  );
}

// 🔥 [추가 로직] 제보하기 기능을 수행하는 모달창 전용 컴포넌트입니다.
function ReportPopupModal({ onClose, user }: { onClose: () => void, user: any }) {
    // [로직 해석] 모달창 안에서 입력될 데이터들을 관리합니다.
    const [formData, setFormData] = useState({
        name: "",
        category: "FASHION",
        location: "",
        address: "",
        startDate: "",
        endDate: "",
        description: "",
        reporterId: user?.userId || "unknown", // 현재 로그인한 유저 ID 자동 기입
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // [로직 해석] 설정하신 GCP 서버 IP로 전송합니다.
            const response = await fetch("http://34.121.40.248:8080/api/popups/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                alert("팝업스토어 제보가 완료되었습니다! 관리자 승인 후 지도에 노출됩니다.");
                onClose(); // 성공 시 모달창을 닫습니다.
            } else {
                alert("제보 처리 중 오류가 발생했습니다.");
            }
        } catch (error) {
            console.error("제보 실패:", error);
            alert("서버와 연결할 수 없습니다.");
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* 배경 어둡게 처리하는 오버레이 */}
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={onClose}
            ></motion.div>
            
            {/* 실제 모달창 박스 */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-white/10"
            >
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <Megaphone className="text-indigo-500"/> 팝업스토어 제보하기
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-white/60 mt-1">알고 있는 팝업 정보를 공유하고 보상을 받으세요!</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full transition-colors">
                        <X size={20} className="text-gray-900 dark:text-white" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">팝업스토어 이름 *</label>
                        <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="예) 휩드 하우스 성수"
                               className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"/>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">카테고리 *</label>
                        <select name="category" value={formData.category} onChange={handleChange}
                                className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white">
                            <option value="FASHION">패션 (FASHION)</option>
                            <option value="FOOD">음식/카페 (FOOD)</option>
                            <option value="POPUP">일반 팝업 (POPUP)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">지역 (간략히) *</label>
                            <input type="text" name="location" required value={formData.location} onChange={handleChange} placeholder="예) 성수동"
                                   className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 outline-none text-sm dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">상세 주소</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="도로명 주소"
                                   className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 outline-none text-sm dark:text-white"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">시작일 *</label>
                            <input type="date" name="startDate" required value={formData.startDate} onChange={handleChange}
                                   className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 outline-none text-sm dark:text-white"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">종료일 *</label>
                            <input type="date" name="endDate" required value={formData.endDate} onChange={handleChange}
                                   className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 outline-none text-sm dark:text-white"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-white/80 mb-1">간단한 설명</label>
                        <textarea name="description" rows={3} value={formData.description} onChange={handleChange} placeholder="어떤 팝업인가요?"
                                  className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 dark:border-white/10 rounded-xl p-3 outline-none resize-none text-sm dark:text-white"></textarea>
                    </div>

                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95">
                        제보 제출하기
                    </button>
                </form>
            </motion.div>
        </div>
    );
}