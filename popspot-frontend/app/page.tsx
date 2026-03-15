"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation"; 
import { 
  Search, MapPin, ArrowUpRight, Flame, Calendar, Menu, Users, 
  Instagram, Twitter, Plus, X, ArrowUp, ArrowDown, Minus, 
  Map as MapIcon, Route, Ticket, User, LogOut, Sparkles, Lock, ArrowRight, Loader2, RefreshCw,
  Shirt, Video, ShoppingBag, Crown, GripVertical, PlusCircle, Zap, MessageCircle, Heart, Star, Gift, Megaphone,
  FolderOpen, Save, Trash2, Store, ShieldCheck, ChevronLeft, ChevronRight
} from "lucide-react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Swal, { SweetAlertResult } from "sweetalert2"; 

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

/* -------------------------------------------------------------------------- */
/* Algolia Custom Components                                                  */
/* -------------------------------------------------------------------------- */
function CustomSearchBox(props: any) {
  const { query, refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);

  useEffect(() => {
    if (query !== inputValue) {
        setInputValue(query);
    }
  }, [query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    refine(e.target.value);
  };

  return (
    <div className="relative w-full group/input">
        <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder="지역, 팝업 이름, 카테고리 검색..."
            className="w-full rounded-full py-3 md:py-4 pl-10 md:pl-12 pr-4 transition-all focus:outline-none bg-gray-100 border border-gray-300 text-gray-900 dark:bg-black/40 dark:border-white/10 dark:text-white dark:placeholder:text-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm md:text-base"
        />
        <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
    </div>
  );
}

function CustomHits() {
  const { hits } = useHits();
  const { query } = useSearchBox();
  
  if (!query) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 md:mt-4 bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl md:rounded-2xl overflow-hidden z-50 shadow-2xl max-h-[300px] md:max-h-[400px] overflow-y-auto custom-scrollbar">
      {hits.length === 0 ? (
          <div className="p-6 md:p-8 text-center text-gray-500 dark:text-white/50 text-xs md:text-sm">
              검색 결과가 없습니다.
          </div>
      ) : (
          hits.map((hit: any) => (
            <Link key={hit.objectID} href={`/popup/${hit.objectID}`} passHref legacyBehavior>
                <article className="flex items-center gap-3 md:gap-4 p-3 md:p-4 hover:bg-indigo-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-none group">
                    <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                        <Store size={18} className="md:w-5 md:h-5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-gray-900 dark:text-white font-bold text-xs md:text-sm truncate group-hover:text-indigo-500 transition-colors">
                            {hit.name}
                        </h4>
                        <p className="text-gray-500 dark:text-white/50 text-[10px] md:text-xs flex items-center gap-1 mt-0.5 truncate">
                            <MapPin size={10} /> {hit.location || "위치 정보 없음"}
                        </p>
                    </div>
                    <ArrowRight size={14} className="md:w-4 md:h-4 text-gray-400 group-hover:text-indigo-500 transition-colors -ml-2 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 duration-300"/>
                </article>
            </Link>
          ))
      )}
      <div className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-50 dark:bg-white/5 text-[9px] md:text-[10px] text-right text-gray-400 flex justify-end items-center gap-1">
          Search by <span className="font-bold text-indigo-500">Algolia</span> ⚡️
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Interfaces & Types                                                         */
/* -------------------------------------------------------------------------- */
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
  startDate?: string;
  endDate?: string;
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

/* -------------------------------------------------------------------------- */
/* Main Page Component                                                        */
/* -------------------------------------------------------------------------- */
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  
  const [hotPopups, setHotPopups] = useState<PopupStore[]>([]);
  const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [currentTab, setCurrentTab] = useState("MAP");
  const [user, setUser] = useState<any>(null);
  const [myPageInfo, setMyPageInfo] = useState<MyPageData | null>(null);
  const [savedCourses, setSavedCourses] = useState<any[]>([]);
  const [myWishlist, setMyWishlist] = useState<WishlistItem[]>([]);
  const [aiCourse, setAiCourse] = useState<any[]>([]); 
  const [myCourseItems, setMyCourseItems] = useState<any[]>(INITIAL_MY_COURSE);

  const [isAiLoading, setIsAiLoading] = useState(false); 
  const [selectedVibe, setSelectedVibe] = useState(""); 
  const [customVibeInput, setCustomVibeInput] = useState(""); 
  const [showCustomInput, setShowCustomInput] = useState(false); 
  const [congestionData, setCongestionData] = useState<CongestionData | null>(null);
  const [ootd, setOotd] = useState<TrendOotd | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /* Event Handlers */
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
          Swal.fire({ icon: 'warning', text: '먼저 AI 추천 코스를 생성해주세요!' });
          return;
      }
      setMyCourseItems([...aiCourse]); 
      handleTabChange("MY"); 
      Swal.fire({ icon: 'success', text: 'AI 추천 코스가 적용되었습니다! 📍' });
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
          Swal.fire({ icon: 'info', text: '이미 코스에 추가된 장소입니다.' });
          return;
      }
      setMyCourseItems([...myCourseItems, newItem]);
      setIsAddPlaceOpen(false); 
  };

  const handleCreateRoom = async () => {
    if (!user) {
        Swal.fire({
            title: '🔒 로그인이 필요합니다',
            text: '작전 회의실은 회원 전용 기능입니다.',
            showCancelButton: true,
            confirmButtonText: '로그인하기',
            cancelButtonText: '취소'
        }).then((result: SweetAlertResult) => { 
            if (result.isConfirmed) router.push("/login"); 
        });
        return;
    }
    try {
        const res = await apiFetch('/api/planning/create', { method: 'POST' });
        const roomId = await res.text();
        router.push(`/planning?room=${roomId}`);
    } catch (e) {
        Swal.fire({ icon: 'error', text: '서버 연결 실패!' });
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
      } catch (e) { console.error("마이페이지 로드 실패", e); }
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
                }
            }
        }
    } catch (e) { console.error("코스 불러오기 실패:", e); }
  };

  const fetchWishlist = async (userId: string) => {
    try {
        const res = await apiFetch(`/api/wishlist/${userId}`);
        if (res.ok) {
            const data = await res.json();
            setMyWishlist(data);
        }
    } catch (e) { console.error("위시리스트 로드 실패:", e); }
  };

  const handleRemoveWishlist = async (e: React.MouseEvent, popupId: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return;
    Swal.fire({
        title: '찜 삭제',
        text: '목록에서 삭제하시겠습니까?',
        icon: 'question',
        showCancelButton: true,
    }).then(async (result: SweetAlertResult) => {
        if (result.isConfirmed) {
            try {
                const res = await apiFetch(`/api/wishlist/${user.userId}/${popupId}`, { method: "DELETE" });
                if (res.ok) {
                    setMyWishlist(prev => prev.filter(item => item.popupId !== popupId));
                    fetchMyPageData(user.userId);
                    Swal.fire({ icon: 'success', text: '삭제되었습니다.' });
                }
            } catch (e) { console.error("찜 삭제 오류:", e); }
        }
    });
  };

  const handleLoadCourse = (courseDataStr: string) => {
      Swal.fire({
          title: '코스 불러오기',
          text: '현재 편집 중인 내용은 사라집니다. 계속할까요?',
          icon: 'warning',
          showCancelButton: true,
      }).then((result: SweetAlertResult) => {
          if (result.isConfirmed) {
              setMyCourseItems(JSON.parse(courseDataStr));
              window.scrollTo({ top: 0, behavior: 'smooth' }); 
          }
      });
  }

  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
      e.stopPropagation(); 
      Swal.fire({
          title: '코스 삭제',
          text: '정말 삭제하시겠습니까?',
          icon: 'error',
          showCancelButton: true,
      }).then(async (result: SweetAlertResult) => {
          if (result.isConfirmed) {
              try {
                  const res = await apiFetch(`/api/my-courses/${courseId}`, { method: 'DELETE' });
                  if (res.ok) {
                      Swal.fire('삭제 완료');
                      if (user) fetchMyCourses(user.userId); 
                  }
              } catch (err) { console.error(err); }
          }
      });
  };

  const handleTabChange = (tab: string) => {
    if ((tab === "PASSPORT" || tab === "MY" || tab === "MATE") && !user) {
        Swal.fire({
            title: '🔒 로그인이 필요합니다',
            showCancelButton: true,
            confirmButtonText: '로그인'
        }).then((res: SweetAlertResult) => { 
            if (res.isConfirmed) router.push("/login"); 
        });
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("aiCourseData"); 
    setUser(null);
    Swal.fire({ icon: 'success', text: '로그아웃 되었습니다.' }).then(() => window.location.reload());
  };

  const handleAiRecommend = async (vibe: string) => {
    if (!vibe.trim()) return Swal.fire('분위기를 입력해주세요!');
    setIsAiLoading(true);
    setAiCourse([]); 
    setSelectedVibe(vibe);
    setShowCustomInput(false); 

    try {
      const res = await apiFetch(`/api/courses/recommend?vibe=${vibe}`);
      const jsonString = await res.text();
      const result = JSON.parse(jsonString);
      setAiCourse(result);
      sessionStorage.setItem("aiCourseData", JSON.stringify({ vibe: vibe, course: result }));
    } catch (e) {
      Swal.fire({ icon: 'error', text: 'AI 연결 실패' });
    } finally { setIsAiLoading(false); }
  };

  const handleResetCourse = () => {
    setAiCourse([]);
    setSelectedVibe("");
    sessionStorage.removeItem("aiCourseData");
  };

  const handleSaveCourse = async () => {
    if (!user) return Swal.fire('로그인이 필요합니다.');
      
    if (!user.isPremium && savedCourses.length > 0) {
        Swal.fire({
            title: '🔒 무료 회원 슬롯 제한',
            text: '무료 회원은 코스를 1개만 저장 가능합니다. 덮어쓰시겠습니까?',
            icon: 'info',
            showCancelButton: true
        }).then((result: SweetAlertResult) => { 
            if (!result.isConfirmed) return; 
        });
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
            Swal.fire({ icon: 'success', text: '코스가 저장되었습니다! 💾' });
            fetchMyCourses(user.userId); 
        } else {
            Swal.fire('저장 실패: 서버 오류가 발생했습니다.');
        }
    } catch (e) {
        Swal.fire('저장 중 오류가 발생했습니다.');
    }
  };

  const handleOpenModal = () => setIsModalOpen(true);

  const handleMarkerClickToDetail = (popupId: number | string) => {
      router.push(`/popup/${popupId}`);
  };

  /* Data Initialization Effects */
  useEffect(() => {
    const tokenFromUrl = searchParams.get("accessToken"); 
    const userId = searchParams.get("userId");
    const nickname = searchParams.get("nickname");
    const isPremium = searchParams.get("isPremium");
    const roleFromUrl = searchParams.get("role"); 

    if (tokenFromUrl && userId) {
      localStorage.setItem("token", tokenFromUrl);
      const socialUser = {
        userId: userId,
        nickname: nickname ? decodeURIComponent(nickname) : "User",
        isPremium: isPremium === "true",
        role: roleFromUrl || "USER", 
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
    }
  }, [searchParams, router]);

  useEffect(() => {
    const cachedPopups = localStorage.getItem("cached_popups");
    if (cachedPopups) {
        const data = JSON.parse(cachedPopups);
        setAllPopups(data);
        const sortedData = [...data].sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));
        setHotPopups(sortedData.slice(0, 5)); 
    }
    
    apiFetch('/api/popups')
        .then(res => res.json())
        .then(data => {
            setAllPopups(data);
            const sortedData = [...data].sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));
            setHotPopups(sortedData.slice(0, 5)); 
            localStorage.setItem("cached_popups", JSON.stringify(data)); 
        })
        .catch(err => console.error("팝업 데이터 로딩 실패:", err));

    const cachedCongestion = localStorage.getItem("cached_congestion");
    if (cachedCongestion) {
        setCongestionData(JSON.parse(cachedCongestion));
    }

    apiFetch('/api/congestion')
      .then(res => res.json())
      .then(data => { 
          if (data && data.level) {
              setCongestionData(data); 
              localStorage.setItem("cached_congestion", JSON.stringify(data)); 
          }
      })
      .catch(err => console.error("혼잡도 데이터 실패:", err));

    const cachedOotd = localStorage.getItem("cached_ootd");
    if (cachedOotd) {
        setOotd(JSON.parse(cachedOotd));
    }

    apiFetch('/api/trends/ootd')
        .then(res => res.json())
        .then(data => {
            setOotd(data);
            localStorage.setItem("cached_ootd", JSON.stringify(data)); 
        })
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

  /* Utilities */
  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const renderRankChange = (change: number | undefined) => {
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
  
  const isAdmin = user?.role?.includes('ADMIN');

  return (
    <main className="min-h-screen font-sans relative pb-24 overflow-x-hidden transition-colors duration-500 bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video autoPlay loop muted playsInline className="absolute min-w-full min-h-full object-cover">
          <source src="/bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 transition-colors duration-500 bg-white/80 dark:bg-black/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 p-4 md:p-6 max-w-[1600px] mx-auto">
        
        <header role="banner" className="flex flex-col md:flex-row md:justify-between items-start md:items-end mb-6 md:mb-10 border-b border-gray-300 dark:border-white/10 pb-4 gap-4 md:gap-0">
          <Link href="/" onClick={() => handleTabChange("MAP")} passHref legacyBehavior>
            <a>
              <h1 className="text-3xl md:text-6xl font-black tracking-tighter leading-none text-gray-900 dark:text-white transition-colors hover:text-indigo-500 dark:hover:text-indigo-400">
                POP-SPOT<span className="text-primary">.</span>
              </h1>
              <p className="text-[10px] md:text-sm mt-1 tracking-widest uppercase text-gray-600 dark:text-white/60 transition-colors">
                Seoul Popup Store Intelligence
              </p>
            </a>
          </Link>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
             <ThemeToggle />

             {user && (
                 <button 
                    onClick={() => setIsReportPopupOpen(true)} 
                    className="flex items-center gap-1 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-[10px] md:text-xs border border-indigo-500/50 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white transition-all shadow-sm whitespace-nowrap"
                 >
                     <Megaphone size={12} className="md:w-3.5 md:h-3.5" /> 제보하기
                 </button>
             )}

             {isAdmin && (
                 <Link href="/admin" passHref legacyBehavior>
                    <a className="flex items-center gap-1 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-bold text-[10px] md:text-xs border border-red-500/50 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all shadow-sm whitespace-nowrap">
                        <ShieldCheck size={12} className="md:w-3.5 md:h-3.5" /> 관리자
                    </a>
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
          </div>
        </header>

        {/* TAB: MAP */}
        {currentTab === "MAP" && (
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
                
                {/* User Greeting Section */}
                <section aria-label="Welcome Banner" className="mb-6">
                    {user ? (
                        <div className="w-full border rounded-2xl md:rounded-[2rem] p-5 md:p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between group gap-4 md:gap-0 bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-200 dark:from-indigo-900/40 dark:to-violet-900/40 dark:border-indigo-500/30">
                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                             <div className="relative z-10 text-center md:text-left">
                                <h2 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 text-gray-900 dark:text-white">반가워요, <span className="text-indigo-600 dark:text-indigo-400">{user.nickname}</span>님!</h2>
                                <p className="text-xs md:text-base text-gray-700 dark:text-indigo-200">오늘 서울에 <span className="font-bold text-gray-900 dark:text-white">{allPopups.length}개</span>의 팝업이 열려있어요.</p>
                             </div>
                             <button onClick={() => handleTabChange("PASSPORT")} className="relative z-10 w-full md:w-auto flex px-6 py-3 bg-white text-indigo-900 font-bold rounded-xl items-center justify-center gap-2 hover:scale-105 transition-transform shadow-lg text-sm md:text-base">
                                <Ticket size={18}/> 내 여권 확인
                             </button>
                        </div>
                    ) : (
                        <div className="w-full border rounded-2xl md:rounded-[2rem] p-6 md:p-12 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 transition-colors bg-white/60 border-gray-200 backdrop-blur-md dark:bg-white/5 dark:border-white/10">
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 mb-3 md:mb-4 text-[10px] md:text-xs font-bold tracking-widest text-white uppercase rounded-full bg-gradient-to-r from-indigo-500 to-purple-500">
                                    Welcome to POP-SPOT
                                </div>
                                <h2 className="text-2xl md:text-5xl font-black mb-3 md:mb-4 leading-tight text-gray-900 dark:text-white">
                                    Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Vibe</span><br className="hidden md:block"/>
                                    in Seoul.
                                </h2>
                                <p className="text-xs md:text-base text-gray-600 dark:text-white/70 max-w-md">
                                    지금 로그인하고 나만의 팝업 지도를 만들어보세요.<br/>
                                    친구와 함께하는 실시간 동선 계획부터 스탬프 적립까지.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
                                <Link href="/login" className="flex-1 md:flex-none">
                                    <button className="w-full md:w-auto px-6 py-3 md:px-8 md:py-4 bg-primary hover:bg-primary/80 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] text-sm md:text-base">
                                        시작하기 <ArrowRight size={16} className="md:w-[18px] md:h-[18px]"/>
                                    </button>
                                </Link>
                                <Link href="/signup" className="flex-1 md:flex-none">
                                    <button className="w-full md:w-auto px-6 py-3 md:px-8 md:py-4 font-bold rounded-xl transition-all border bg-white text-gray-900 border-gray-300 hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20 text-sm md:text-base">
                                        회원가입
                                    </button>
                                </Link>
                            </div>
                        </div>
                    )}
                </section>

                {/* Dashboard Main Grid */}
                <section aria-label="Dashboard Layout" className="grid grid-cols-1 lg:grid-cols-12 md:grid-rows-6 gap-4 min-h-[80vh] mb-24">
                    
                    {/* Search Zone */}
                    <div className="col-span-1 lg:col-span-5 md:row-span-2 rounded-[2rem] p-6 md:p-8 flex flex-col justify-between border backdrop-blur-md transition-colors bg-white/80 border-gray-200 dark:bg-[#111]/80 dark:border-white/5 relative z-50 order-1 lg:order-none">
                        <InstantSearch searchClient={searchClient} indexName="popups">
                            <div>
                                <h2 className="text-2xl md:text-5xl font-black leading-tight uppercase mb-2 md:mb-4 text-gray-900 dark:text-white">
                                    Search <span className="text-primary">Zone.</span>
                                </h2>
                                <div className="mt-4 md:mt-8 relative w-full"> 
                                    <CustomSearchBox />
                                </div>
                            </div>
                            <CustomHits />
                        </InstantSearch>
                    </div>
                    
                    {/* Map Zone */}
                    <div className="col-span-1 lg:col-span-7 md:row-span-4 rounded-[2rem] relative overflow-hidden border border-gray-200 dark:border-white/5 group bg-gray-100 dark:bg-[#111]/80 backdrop-blur-md min-h-[400px] md:min-h-0 order-2 lg:order-none">
                        <InteractiveMap onMarkerClick={handleMarkerClickToDetail} />
                        <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex gap-2 z-20">
                            <span className="backdrop-blur px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 bg-white/80 border-gray-200 text-gray-900 dark:bg-black/60 dark:border-white/10 dark:text-white">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"/> LIVE DATA
                            </span>
                        </div>
                    </div>

                    {/* Real-time Ranking Zone */}
                    <div className="col-span-1 lg:col-span-5 md:row-span-4 rounded-[2rem] p-5 md:p-6 border flex flex-col backdrop-blur-md transition-colors bg-white/80 border-gray-200 dark:bg-[#111]/80 dark:border-white/5 order-3 lg:order-none h-[300px] md:h-auto">
                        <header className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <Flame size={18} className="text-secondary animate-pulse md:w-5 md:h-5"/>
                                <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">REAL-TIME RANKING</h3>
                            </div>
                            <button onClick={handleOpenModal} className="p-1.5 md:p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors group">
                                <Plus size={18} className="md:w-5 md:h-5 text-gray-500 dark:text-white/60 group-hover:text-primary transition-colors"/>
                            </button>
                        </header>
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                            {hotPopups.length > 0 ? (
                            <AnimatePresence>
                                {hotPopups.map((popup: any, idx) => (
                                <Link href={`/popup/${popup.id}`} key={popup.id} onClick={() => handleTabChange("MAP")} passHref legacyBehavior>
                                    <motion.a layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} 
                                                className="flex items-center justify-between p-3 md:p-4 mb-2 rounded-xl md:rounded-2xl transition-colors cursor-pointer group border bg-white hover:bg-gray-50 border-gray-100 hover:border-gray-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-transparent dark:hover:border-white/10">
                                    <div className="flex items-center gap-2 md:gap-3">
                                            <div className="flex flex-col items-center w-5 md:w-6">
                                                <span className={`text-xs md:text-sm font-black ${idx === 0 ? 'text-primary' : 'text-gray-400 dark:text-white/30'}`}>{idx + 1}</span>
                                                {renderRankChange(popup.rankChange)}
                                            </div>
                                            <div>
                                                <strong className="font-bold block text-xs md:text-sm text-gray-900 dark:text-white truncate max-w-[120px] md:max-w-[180px]">{popup.name}</strong>
                                                <span className="text-[9px] md:text-[10px] text-gray-500 dark:text-white/60 truncate max-w-[120px] md:max-w-full block">{popup.location}</span>
                                            </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] md:text-[10px] text-gray-500 dark:text-white/60 flex items-center gap-1"><Users size={8} className="md:w-2.5 md:h-2.5"/> {popup.viewCount}</span>
                                        <span className={`text-[9px] md:text-[10px] px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-full border whitespace-nowrap ${popup.status === '혼잡' ? 'border-secondary/30 text-secondary' : 'border-primary/30 text-primary'}`}>{popup.status || '영업중'}</span>
                                    </div>
                                    </motion.a>
                                </Link>
                                ))}
                            </AnimatePresence>
                            ) : (
                            <div className="h-full flex flex-col justify-center space-y-3 opacity-60">
                                {/* 스켈레톤 로딩 UI 적용 */}
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="animate-pulse flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl border bg-gray-100 dark:bg-white/5 border-transparent">
                                        <div className="flex gap-3 items-center">
                                            <div className="w-5 h-8 bg-gray-300 dark:bg-white/10 rounded"></div>
                                            <div className="space-y-2">
                                                <div className="h-3 w-24 bg-gray-300 dark:bg-white/10 rounded"></div>
                                                <div className="h-2 w-16 bg-gray-300 dark:bg-white/10 rounded"></div>
                                            </div>
                                        </div>
                                        <div className="w-10 h-4 bg-gray-300 dark:bg-white/10 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Calendar Zone */}
                    <div 
                        onClick={() => setIsCalendarOpen(true)}
                        className="col-span-1 lg:col-span-4 md:row-span-2 bg-primary/90 backdrop-blur-md text-black rounded-[2rem] p-5 md:p-6 transition-all hover:scale-[1.02] cursor-pointer shadow-lg relative overflow-hidden group order-4 lg:order-none flex flex-col justify-between"
                    >
                        <div className="relative z-10">
                            <Calendar size={28} className="md:w-8 md:h-8 group-hover:rotate-12 transition-transform" />
                            <h3 className="text-xl md:text-2xl font-black mt-2 leading-none uppercase">Popup<br/>Calendar</h3>
                            <p className="text-[10px] md:text-xs font-bold opacity-60 mt-1 md:mt-2 mb-2">어떤 팝업이 열릴지 궁금하다면?</p>
                        </div>
                        
                        <div className="relative z-10 w-full py-2.5 bg-black/10 group-hover:bg-black/20 rounded-xl text-center text-xs font-bold transition-colors">
                            전체 달력 펴보기 ➔
                        </div>

                        <div className="absolute -right-6 -bottom-6 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                            <Calendar size={140} />
                        </div>
                    </div>

                    {/* AI Report Zone */}
                    <div onClick={() => setIsReportOpen(true)} className="col-span-1 lg:col-span-3 md:row-span-2 rounded-[2rem] p-5 md:p-6 cursor-pointer border flex flex-col justify-between group backdrop-blur-md transition-colors bg-white/80 border-gray-200 hover:border-primary dark:bg-[#111]/80 dark:border-white/5 dark:hover:border-primary order-5 lg:order-none">
                        <div className="flex justify-between items-start">
                            <Users size={20} className={`md:w-6 md:h-6 ${getCongestionColor(congestionData?.level || '')} group-hover:scale-110 transition-transform`}/>
                            <div className="text-right">
                                {congestionData ? (
                                    <span className={`text-xl md:text-2xl font-black ${getCongestionColor(congestionData.level)}`}>{congestionData.level}</span>
                                ) : (
                                    <div className="h-6 w-16 bg-gray-200 dark:bg-white/10 rounded animate-pulse"></div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm md:text-lg text-gray-900 dark:text-white group-hover:text-primary transition-colors">AI Report</h3>
                            <p className="text-[10px] md:text-xs text-gray-500 dark:text-white/60 mt-0.5 md:mt-1">
                                {congestionData ? `성수동 인구 ${congestionData.minPop.toLocaleString()}~${congestionData.maxPop.toLocaleString()}명` : "성수동 혼잡도 분석 중"}
                            </p>
                        </div>
                    </div>
                </section>

                {/* OOTD Section */}
                <motion.section aria-label="Style Recommendation" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24">
                    <header className="flex flex-col md:flex-row items-center md:items-end justify-between mb-8 md:mb-12 text-center md:text-left">
                        <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-stroke relative z-10">POP-LOOK<span className="text-white">.</span></h2>
                        <p className="text-gray-500 dark:text-white/60 max-w-md mt-2 md:mt-0 relative z-10 text-xs md:text-base">서울 갈 때 뭐 입지?<br/>오늘의 분위기에 딱 맞는 OOTD를 제안합니다.</p>
                    </header>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[500px]">
                        <article className="lg:col-span-1 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-gray-200 dark:border-white/10 group bg-black h-[300px] lg:h-full">
                            {ootd?.data ? (
                                <>
                                    <video ref={videoRef} src={ootd.data.videoUrl} poster={ootd.data.thumbnail} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-90 group-hover:scale-105 lg:group-hover:scale-110 transition-transform duration-700"/>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"/>
                                    <div className="absolute top-4 right-4 lg:top-6 lg:right-6 bg-black/30 backdrop-blur-md px-2 py-1 lg:px-3 lg:py-1 rounded-full text-white text-[10px] lg:text-xs font-bold border border-white/20 flex items-center gap-1"><Video size={10} className="lg:w-3 lg:h-3"/> Pexels Shorts</div>
                                    <div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-6 lg:right-6 text-white"><p className="text-[10px] lg:text-xs font-medium opacity-80 mb-1 uppercase tracking-wider">Today's Pick</p><h3 className="text-xl lg:text-2xl font-black leading-none mb-1 lg:mb-2">{ootd.data.keyword}</h3><p className="text-[9px] lg:text-[10px] opacity-60">Creator: {ootd.data.photographer}</p></div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4"><Loader2 size={24} className="lg:w-8 lg:h-8 animate-spin"/><span className="text-xs lg:text-sm">Fetching OOTD...</span></div>
                            )}
                        </article>
                        <div className="lg:col-span-2 flex flex-col gap-4 lg:gap-6">
                            <article className="flex-1 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 bg-white/80 dark:bg-[#111]/80 backdrop-blur-lg border border-gray-200 dark:border-white/5 flex flex-col justify-center items-start relative overflow-hidden">
                                <Shirt size={80} className="lg:w-[120px] lg:h-[120px] absolute -right-4 -bottom-4 lg:-right-6 lg:-bottom-6 text-gray-100 dark:text-white/5 rotate-[-15deg]"/>
                                <span className="text-primary font-bold tracking-widest text-[10px] lg:text-xs uppercase mb-3 lg:mb-4 border border-primary/30 px-2 py-1 lg:px-3 lg:py-1 rounded-full">Daily Style Forecast</span>
                                <h3 className="text-xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4 lg:mb-6 leading-tight">{ootd?.comment || "트렌디한 서울 바이브를 분석 중입니다..."}</h3>
                                <div className="flex flex-wrap gap-2 lg:gap-3">{['#SeongsuVibe', '#PopUpStyle', '#OOTD', `#${ootd?.data?.keyword.replace(" ", "") || 'Fashion'}`].map((tag, i) => (<span key={i} className="text-xs lg:text-sm text-gray-500 dark:text-white/40 font-medium">{tag}</span>))}</div>
                            </article>
                            <article className="h-24 lg:h-32 rounded-[1.5rem] lg:rounded-[2rem] bg-gradient-to-r from-gray-900 to-black dark:from-white dark:to-gray-200 flex items-center justify-between px-6 lg:px-10 relative overflow-hidden group cursor-pointer">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"/>
                                <div className="z-10"><p className="text-gray-400 dark:text-gray-600 text-[10px] lg:text-xs font-bold mb-0.5 lg:mb-1">POP-SPOT EXCLUSIVE</p><p className="text-white dark:text-black text-sm lg:text-xl font-black">이 코디 입고 방문하면 스탬프 2배? 🎟️</p></div>
                                <div className="w-8 h-8 lg:w-12 lg:h-12 bg-white dark:bg-black rounded-full flex items-center justify-center text-black dark:text-white group-hover:scale-110 transition-transform z-10"><ArrowUpRight size={18} className="lg:w-6 lg:h-6"/></div>
                            </article>
                        </div>
                    </div>
                </motion.section>

                {/* Live Chat Ticker Section */}
                <motion.section aria-label="Live Community Updates" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24 relative">
                    <div className="absolute -top-10 right-0 w-32 h-32 lg:w-64 lg:h-64 bg-indigo-500/20 rounded-full blur-[50px] lg:blur-[100px] pointer-events-none" />
                    <LiveChatTicker />
                    <div className="text-center mt-6 lg:mt-8"><p className="text-[10px] lg:text-sm text-gray-500 dark:text-white/40">* 서울 현장 유저들이 실시간으로 공유하는 정보입니다.</p></div>
                </motion.section>

                {/* Collaboration Feature Promo Section */}
                <motion.section aria-label="Feature Promotion" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-24 py-12 px-6 lg:py-20 lg:px-12 bg-gradient-to-br from-indigo-900 via-gray-900 to-black text-white relative overflow-hidden rounded-[2rem] lg:rounded-[2.5rem] shadow-2xl">
                    <div className="absolute top-0 right-0 w-48 h-48 lg:w-96 lg:h-96 bg-indigo-500/20 rounded-full blur-2xl lg:blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 lg:w-64 lg:h-64 bg-pink-500/10 rounded-full blur-2xl lg:blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 relative z-10">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-1.5 lg:gap-2 px-2.5 py-1 lg:px-3 lg:py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] lg:text-sm font-bold mb-4 lg:mb-6">
                                <Users size={12} className="lg:w-4 lg:h-4"/> 실시간 협업 기능
                            </div>
                            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-4 lg:mb-6 leading-tight">
                                친구와 함께 그리는<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">서울 작전지도</span>
                            </h2>
                            <p className="text-gray-400 text-xs lg:text-lg mb-6 lg:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
                                "거기 어때?" 링크 공유는 그만.<br />
                                같은 화면을 보며 실시간으로 마커를 찍고 동선을 계획하세요.<br className="hidden lg:block"/>
                            </p>
                            <button 
                                onClick={handleCreateRoom}
                                className="group relative inline-flex items-center justify-center px-6 py-3 lg:px-8 lg:py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-full hover:bg-indigo-500 focus:outline-none ring-offset-2 focus:ring-2 ring-indigo-400 text-sm lg:text-lg w-full lg:w-auto"
                            >
                                <span className="mr-2">작전 회의실 만들기</span>
                                <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 transition-transform group-hover:translate-x-1" />
                                <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                            </button>
                        </div>

                        <div className="flex-1 w-full max-w-sm lg:max-w-md hidden md:block">
                            <div className="relative bg-gray-800/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4 lg:p-6 shadow-2xl transform rotate-3 transition-transform hover:rotate-0 duration-500">
                                <div className="w-full h-48 lg:h-64 bg-gray-700/50 rounded-xl mb-3 lg:mb-4 relative overflow-hidden border border-gray-600/30">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500/20 font-black text-4xl lg:text-6xl select-none">MAP</div>
                                    <div className="absolute top-1/3 left-1/4 w-6 h-6 lg:w-8 lg:h-8 bg-pink-500 rounded-full border-2 lg:border-4 border-gray-800 animate-bounce shadow-lg flex items-center justify-center text-[8px] lg:text-[10px] font-bold">A</div>
                                    <div className="absolute top-2/3 right-1/3 w-6 h-6 lg:w-8 lg:h-8 bg-indigo-500 rounded-full border-2 lg:border-4 border-gray-800 animate-bounce delay-100 shadow-lg flex items-center justify-center text-[8px] lg:text-[10px] font-bold">B</div>
                                    <div className="absolute bottom-6 lg:bottom-10 right-6 lg:right-10 pointer-events-none">
                                            <div className="w-2 h-2 lg:w-3 lg:h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.8)]"></div>
                                            <div className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-yellow-400 text-black text-[8px] lg:text-[10px] font-bold rounded ml-1 lg:ml-2 mt-0.5 lg:mt-1 whitespace-nowrap">친구 입력 중...</div>
                                    </div>
                                </div>
                                <div className="space-y-2 lg:space-y-3">
                                    <div className="flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                                        <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400"><MapIcon size={12} className="lg:w-4 lg:h-4"/></div>
                                        <div className="flex-1">
                                            <div className="h-1.5 lg:h-2 w-16 lg:w-24 bg-gray-600 rounded mb-1.5 lg:mb-2"></div>
                                            <div className="h-1.5 lg:h-2 w-10 lg:w-16 bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

            </motion.div>
        )}

        {/* TAB: PASSPORT */}
        {currentTab === "PASSPORT" && (
            <motion.section aria-label="Digital Passport" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} 
                        className="min-h-[80vh] flex flex-col items-center justify-center rounded-[2rem] lg:rounded-[2.5rem] border mb-24 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10 p-4">
              {user ? (<PassportView />) : (
                  <div className="text-center p-6 lg:p-8 z-10 w-full max-w-md">
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center mx-auto mb-4 lg:mb-6 border bg-gray-100 border-gray-200 dark:bg-white/5 dark:border-white/10"><Lock size={32} className="lg:w-10 lg:h-10 text-gray-400 dark:text-white/50" /></div>
                      <h2 className="text-2xl lg:text-3xl font-bold mb-2 lg:mb-3 text-gray-900 dark:text-white">로그인이 필요해요</h2><p className="text-xs lg:text-sm text-gray-500 dark:text-white/60 mb-6 lg:mb-8">나만의 팝업 여권을 만들고 스탬프 모아보세요.</p>
                      <Link href="/login"><button className="w-full lg:w-auto px-8 py-3 bg-primary text-black font-bold rounded-xl hover:bg-white transition-colors shadow-lg text-sm lg:text-base">로그인 하러가기</button></Link>
                  </div>
              )}
            </motion.section>
        )}

        {/* TAB: COURSE */}
        {currentTab === "COURSE" && (
             <motion.section aria-label="AI Course Generator" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                          className="min-h-[80vh] flex flex-col items-center rounded-[2.5rem] border mb-24 p-4 lg:p-6 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                <header className="text-center mb-8 lg:mb-10 z-10 mt-6 lg:mt-8">
                    <div className="inline-flex items-center gap-1.5 lg:gap-2 px-3 py-1 lg:px-4 lg:py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] lg:text-xs font-bold mb-3 lg:mb-4 animate-pulse"><Sparkles size={10} className="lg:w-3 lg:h-3"/> AI CURATION BETA</div>
                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-black italic uppercase tracking-tighter mb-1.5 lg:mb-2 text-gray-900 dark:text-white">POP<span className="text-gray-300 dark:text-white/20">-</span>COURSE</h2>
                    <p className="text-gray-500 dark:text-white/60 text-xs lg:text-sm">원하는 분위기를 선택하면 AI가 최적의 동선을 추천합니다.</p>
                </header>

                <div className="w-full max-w-3xl z-10 mb-8 lg:mb-12 flex flex-col gap-3 lg:gap-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 px-2 lg:px-0">
                        {[{ label: '🔥 핫플 정복', val: '핫플' }, { label: '💖 로맨틱 데이트', val: '데이트' }, { label: '📸 인생샷 투어', val: '사진' }, { label: '🧘 힐링/여유', val: '힐링' }].map((item, idx) => (
                            <button key={idx} onClick={() => handleAiRecommend(item.val)} disabled={isAiLoading}
                                className={`group relative p-4 lg:p-6 rounded-2xl lg:rounded-3xl border transition-all duration-300 flex flex-col items-center gap-2 lg:gap-3 hover:scale-105 shadow-sm hover:shadow-md ${selectedVibe === item.val ? "bg-indigo-600 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.5)] lg:shadow-[0_0_30px_rgba(79,70,229,0.6)] text-white" : "bg-white border-gray-200 hover:bg-gray-50 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"}`}>
                                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-lg lg:text-xl ${selectedVibe === item.val ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'}`}>{item.label.split(' ')[0]}</div>
                                <span className={`font-bold text-xs lg:text-sm ${selectedVibe === item.val ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{item.label.split(' ')[1]}</span>
                                {isAiLoading && selectedVibe === item.val && (<div className="absolute inset-0 bg-black/50 rounded-2xl lg:rounded-3xl flex items-center justify-center"><Loader2 className="animate-spin text-white w-5 h-5 lg:w-6 lg:h-6" /></div>)}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col items-center mt-2 px-2 lg:px-0">
                        {!showCustomInput ? (
                            <button onClick={() => setShowCustomInput(true)} className="text-xs lg:text-sm flex items-center gap-1.5 lg:gap-2 transition-colors border-b border-transparent pb-1 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 dark:text-white/50 dark:hover:text-indigo-400 dark:hover:border-indigo-400">
                                <Sparkles size={12} className="lg:w-3.5 lg:h-3.5"/> 찾는 분위기가 없나요? 직접 입력하기
                            </button>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full max-w-md gap-2">
                                <input type="text" value={customVibeInput} onChange={(e) => setCustomVibeInput(e.target.value)} placeholder="예: 비 오는 날 가기 좋은..." className="flex-1 rounded-xl px-3 py-2.5 lg:px-4 lg:py-3 transition-all focus:outline-none focus:border-indigo-500 bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/30 text-xs lg:text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAiRecommend(customVibeInput)}/>
                                <button onClick={() => handleAiRecommend(customVibeInput)} className="bg-indigo-600 hover:bg-indigo-50 text-white px-4 lg:px-6 rounded-xl font-bold transition-colors shadow-lg text-xs lg:text-sm whitespace-nowrap">추천</button>
                                <button onClick={() => setShowCustomInput(false)} className="p-2.5 lg:p-3 rounded-xl transition-colors bg-gray-100 hover:bg-gray-200 text-gray-500 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/50 flex-shrink-0"><X size={16} className="lg:w-[18px] lg:h-[18px]"/></button>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="w-full max-w-3xl z-10 min-h-[300px] px-2 lg:px-0">
                    <header className="flex items-center justify-between mb-4 lg:mb-6">
                        <h3 className="text-left font-bold text-sm lg:text-lg flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            {isAiLoading ? <Loader2 className="animate-spin text-indigo-500 w-4 h-4 lg:w-5 lg:h-5"/> : <Route size={16} className="text-indigo-500 lg:w-5 lg:h-5"/>}
                            {isAiLoading ? "AI가 코스를 짜고 있어요..." : (aiCourse.length > 0 ? "AI RECOMMENDED COURSE" : "원하는 분위기를 선택해보세요!")}
                        </h3>
                        {aiCourse.length > 0 && !isAiLoading && (
                             <button onClick={handleResetCourse} className="text-[10px] lg:text-xs flex items-center gap-1 transition-colors text-gray-500 hover:text-red-500 dark:text-white/40 dark:hover:text-red-400"><RefreshCw size={10} className="lg:w-3 lg:h-3"/> 초기화</button>
                        )}
                    </header>

                    {!isAiLoading && aiCourse.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                                    className="rounded-2xl lg:rounded-3xl p-5 lg:p-8 border relative overflow-hidden group hover:border-indigo-500/50 transition-colors shadow-xl bg-white border-gray-200 dark:bg-[#1a1a1a] dark:border-white/10">
                            <div className="absolute top-0 right-0 p-6 lg:p-10 opacity-5"><MapIcon size={100} className="lg:w-[150px] lg:h-[150px]" /></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6 lg:mb-8">
                                    <div>
                                        <span className="text-[9px] lg:text-xs font-bold text-white bg-indigo-600 px-2.5 py-1 lg:px-3 lg:py-1 rounded-full mb-2 lg:mb-3 inline-block shadow-md">FOR YOU</span>
                                        <h4 className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-white">서울 <span className="text-indigo-600 dark:text-indigo-400">{selectedVibe}</span> 맞춤 코스</h4>
                                        <p className="text-gray-500 dark:text-white/50 text-[10px] lg:text-sm mt-0.5 lg:mt-1">AI가 제안하는 최적의 동선입니다.</p>
                                    </div>
                                </div>
                                <div className="space-y-4 lg:space-y-6">
                                    {aiCourse.map((item, idx) => (
                                        <article key={idx} className="flex gap-3 lg:gap-4 group/item">
                                            <div className="flex flex-col items-center">
                                                <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs lg:text-sm font-bold text-white shadow-lg z-10">{idx + 1}</div>
                                                {idx < aiCourse.length - 1 && (<div className="w-0.5 flex-1 transition-colors my-1 lg:my-2 bg-gray-200 group-hover/item:bg-indigo-200 dark:bg-white/10 dark:group-hover/item:bg-indigo-600/50"></div>)}
                                            </div>
                                            <div className="flex-1 pb-4 lg:pb-6 cursor-pointer" onClick={() => router.push(`/popup/${item.id}`)}>
                                                <div className="p-3 lg:p-4 rounded-xl lg:rounded-2xl border transition-colors shadow-sm bg-gray-200 hover:bg-indigo-50 hover:border-indigo-200 dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10">
                                                    <div className="flex justify-between items-center mb-1"><h5 className="font-bold text-sm lg:text-lg text-gray-900 dark:text-white">{item.name}</h5><ArrowRight size={14} className="lg:w-4 lg:h-4 text-gray-400 dark:text-white/30" /></div>
                                                    <p className="text-xs lg:text-sm mb-1.5 lg:mb-2 text-indigo-600 dark:text-indigo-200/80 line-clamp-2">"{item.reason}"</p>
                                                    <div className="flex gap-2"><span className="text-[9px] lg:text-[10px] px-1.5 py-0.5 lg:px-2 lg:py-0.5 rounded border bg-white border-gray-200 text-gray-500 dark:bg-black/30 dark:border-white/5 dark:text-white/50">POP-UP</span></div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={handleCopyAiToMyCourse}
                                    className="w-full py-3 lg:py-4 mt-2 lg:mt-4 bg-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-white transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 lg:gap-2 text-xs lg:text-base"
                                >
                                  <MapIcon size={14} className="lg:w-[18px] lg:h-[18px]" /> 전체 경로 지도에서 보기 (MY 탭으로 이동)
                                </button>
                                
                                <button onClick={handleSaveCourse} className="w-full py-3 lg:py-4 mt-2 lg:mt-3 bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 rounded-xl font-bold transition-colors flex items-center justify-center gap-1.5 lg:gap-2 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/20 text-xs lg:text-base">
                                    <Ticket size={14} className="lg:w-[18px] lg:h-[18px]" /> 내 코스로 저장하기
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.section>
        )}

        {/* TAB: MY */}
        {currentTab === "MY" && (
            <motion.section aria-label="User Dashboard" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                        className="h-[85vh] lg:h-[85vh] flex flex-col md:flex-row overflow-hidden rounded-[2rem] lg:rounded-[2.5rem] border backdrop-blur-md mb-24 transition-colors relative
                                    bg-white/80 border-gray-200 
                                    dark:bg-[#111]/80 dark:border-white/10">
                
                {/* 1. Map Context Area */}
                <div className="w-full md:w-[55%] h-[35vh] md:h-full relative border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 flex-shrink-0">
                    <InteractiveMap 
                        places={myCourseItems} 
                        showPath={true} 
                        center={myCourseItems.length > 0 ? { lat: myCourseItems[0].lat, lng: myCourseItems[0].lng } : undefined}
                    />
                    <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10 bg-white/90 dark:bg-black/80 backdrop-blur px-3 py-1.5 lg:px-4 lg:py-2 rounded-full shadow-lg border border-gray-200 dark:border-white/10">
                        <span className="text-[10px] lg:text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <Sparkles size={10} className="lg:w-3 lg:h-3" /> My Course Preview
                        </span>
                    </div>
                </div>

                {/* 2. Scrollable Dashboard Area */}
                <div className="w-full md:w-[45%] h-[50vh] md:h-full flex flex-col bg-white dark:bg-[#111] relative overflow-y-auto custom-scrollbar pb-24 md:pb-20">
                    
                    {/* Activity Dashboard */}
                    <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            <User size={16} className="lg:w-[18px] lg:h-[18px] text-indigo-500"/> Activity Dashboard
                        </h3>
                        <div className="grid grid-cols-3 gap-2 lg:gap-3">
                            <div className="bg-gray-50 dark:bg-[#222] p-3 lg:p-4 rounded-xl lg:rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <Heart size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-red-500"/>
                                <div className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.likeCount || 0}</div>
                                <div className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5">찜한 팝업</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-[#222] p-3 lg:p-4 rounded-xl lg:rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <Ticket size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-indigo-500"/>
                                <div className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.stampCount || 0}<span className="text-xs lg:text-sm text-gray-400 font-normal">/12</span></div>
                                <div className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5">획득 스탬프</div>
                            </div>
                            <div className="bg-gray-50 dark:bg-[#222] p-3 lg:p-4 rounded-xl lg:rounded-2xl text-center border border-gray-100 dark:border-white/5">
                                <MessageCircle size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-green-500"/>
                                <div className="text-lg lg:text-2xl font-black text-gray-900 dark:text-white">{myPageInfo?.reviewCount || 0}</div>
                                <div className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5">리뷰/톡</div>
                            </div>
                        </div>
                    </div>

                    {/* Inventory */}
                    <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            <Gift size={16} className="lg:w-[18px] lg:h-[18px] text-indigo-500"/> Inventory
                        </h3>
                        <div className="space-y-2 lg:space-y-3">
                            <article className={`p-3 lg:p-4 rounded-xl lg:rounded-2xl border flex items-center justify-between ${
                                myPageInfo?.isPremium 
                                ? "bg-gradient-to-r from-indigo-900 to-purple-900 border-indigo-500 text-white shadow-lg"
                                : "bg-gray-50 dark:bg-[#222] border-gray-100 dark:border-white/5 text-gray-400"
                            }`}>
                                <div className="flex items-center gap-2.5 lg:gap-3">
                                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-white/10 flex items-center justify-center">
                                        <Crown size={16} className={`lg:w-5 lg:h-5 ${myPageInfo?.isPremium ? "text-yellow-400" : "text-gray-400"}`}/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs lg:text-sm">POP-PASS</div>
                                        <div className="text-[10px] lg:text-xs opacity-70 mt-0.5">
                                            {myPageInfo?.isPremium 
                                                ? `${getDday(myPageInfo?.premiumExpiryDate)}일 남음`
                                                : "미보유"}
                                        </div>
                                    </div>
                                </div>
                                <Link href="/shop" passHref legacyBehavior>
                                    <a>
                                        <button className="text-[10px] lg:text-xs px-2.5 py-1.5 lg:px-3 lg:py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-bold whitespace-nowrap">
                                            {myPageInfo?.isPremium ? "연장하기" : "구매하기"}
                                        </button>
                                    </a>
                                </Link>
                            </article>

                            <article className="p-3 lg:p-4 rounded-xl lg:rounded-2xl border bg-gray-50 dark:bg-[#222] border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2.5 lg:gap-3">
                                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                        <Megaphone size={16} className="lg:w-5 lg:h-5 text-green-600 dark:text-green-400"/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs lg:text-sm text-gray-900 dark:text-white">메이트 확성기</div>
                                        <div className="text-[10px] lg:text-xs text-gray-500 dark:text-white/50 mt-0.5">보유 수량: {myPageInfo?.megaphoneCount || 0}개</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        if((myPageInfo?.megaphoneCount || 0) > 0) {
                                            alert("동행 게시판 글쓰기 화면에서 사용할 수 있습니다!");
                                            handleTabChange("MATE");
                                        } else {
                                            if(confirm("확성기가 없습니다. 상점에서 구매하시겠습니까?")) router.push("/shop");
                                        }
                                    }}
                                    className={`text-[10px] lg:text-xs px-2.5 py-1.5 lg:px-3 lg:py-1.5 rounded-lg transition-colors font-bold whitespace-nowrap ${
                                        (myPageInfo?.megaphoneCount || 0) > 0 
                                        ? "bg-indigo-600 text-white hover:bg-indigo-500" 
                                        : "bg-gray-200 text-gray-400 dark:bg-white/5 cursor-not-allowed"
                                    }`}
                                >
                                    사용하기
                                </button>
                            </article>
                        </div>
                    </div>

                    {/* Wishlist */}
                    <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            <Heart size={16} className="lg:w-[18px] lg:h-[18px] text-red-500"/> Wishlist
                        </h3>
                        {myWishlist.length === 0 ? (
                            <div className="text-center py-6 lg:py-8 text-gray-400 text-[10px] lg:text-xs border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                                아직 찜한 팝업스토어가 없습니다.<br/>
                                마음에 드는 팝업에 하트를 눌러보세요!
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 lg:gap-3">
                                {myWishlist.map((item, i) => (
                                    <div key={i} className="relative rounded-lg lg:rounded-xl overflow-hidden aspect-video group cursor-pointer border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-[#222]">
                                            {item.popupImage ? (
                                                <img src={item.popupImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.popupName}/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Store size={20} className="lg:w-6 lg:h-6" />
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 lg:p-3">
                                                <span className="text-white text-[10px] lg:text-xs font-bold truncate">{item.popupName}</span>
                                                <span className="text-white/60 text-[8px] lg:text-[10px] truncate mt-0.5">{item.location}</span>
                                            </div>

                                            <button 
                                                onClick={(e) => handleRemoveWishlist(e, item.popupId)}
                                                className="absolute top-1.5 right-1.5 lg:top-2 lg:right-2 bg-black/50 backdrop-blur rounded-full p-1 lg:p-1.5 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100" 
                                                title="찜 해제"
                                            >
                                                <Heart size={10} className="lg:w-3 lg:h-3 fill-current"/>
                                            </button>

                                            <Link href={`/popup/${item.popupId}`} className="absolute inset-0 z-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Saved Courses History */}
                    <div className="p-4 lg:p-6 border-b border-gray-100 dark:border-white/5">
                        <h3 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            <FolderOpen size={16} className="lg:w-[18px] lg:h-[18px] text-indigo-500"/> Saved Courses
                        </h3>
                        
                        {savedCourses.length === 0 ? (
                            <div className="text-center text-gray-400 py-3 lg:py-4 text-[10px] lg:text-xs">
                                아직 저장된 코스가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {savedCourses.map((course: any, idx: number) => (
                                    <article key={idx} className="flex items-center justify-between p-2.5 lg:p-3 rounded-lg lg:rounded-xl border bg-gray-50 dark:bg-[#222] border-gray-200 dark:border-white/5 hover:border-indigo-500 transition-colors cursor-pointer group"
                                     onClick={() => handleLoadCourse(course.courseData)}>
                                    <div className="flex items-center gap-2 lg:gap-3">
                                            <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-[10px] lg:text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="text-xs lg:text-sm font-bold text-gray-900 dark:text-white">{course.courseName}</div>
                                                <div className="text-[9px] lg:text-xs text-gray-500 mt-0.5">클릭하여 불러오기</div>
                                            </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => handleDeleteCourse(e, course.id)}
                                        className="p-1.5 lg:p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="삭제하기"
                                    >
                                        <Trash2 size={14} className="lg:w-4 lg:h-4"/>
                                    </button>
                                    </article>
                                ))}
                                {!user.isPremium && savedCourses.length >= 1 && (
                                    <div className="mt-2 text-[9px] lg:text-xs text-center text-red-500 bg-red-50 dark:bg-red-900/10 p-1.5 lg:p-2 rounded-lg">
                                        🔒 무료 회원은 코스를 1개만 저장할 수 있습니다.<br className="hidden md:block"/>새로 저장하면 이 코스는 삭제됩니다.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Current Editing Course (DND) */}
                    <div className="p-4 lg:p-6">
                        <h3 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-1.5 lg:gap-2 text-gray-900 dark:text-white">
                            <Route size={16} className="lg:w-[18px] lg:h-[18px] text-indigo-500"/> Current Plan
                        </h3>
                        
                        {myCourseItems.length === 0 && (
                            <div className="text-center text-gray-400 py-4 lg:py-6 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg lg:rounded-xl mb-3 lg:mb-4 text-[10px] lg:text-xs">
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
                                                className="absolute -top-1.5 -right-1.5 lg:-top-2 lg:-right-2 bg-red-500 text-white p-1 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                                                title="삭제"
                                            >
                                                <X size={10} className="lg:w-3 lg:h-3"/>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        <button 
                            onClick={() => setIsAddPlaceOpen(true)}
                            className="w-full py-2.5 lg:py-3 mt-3 lg:mt-4 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-lg lg:rounded-xl text-gray-500 dark:text-white/50 hover:border-indigo-500 hover:text-indigo-500 transition-colors flex items-center justify-center gap-1.5 lg:gap-2 font-bold text-xs lg:text-sm"
                        >
                            <PlusCircle size={14} className="lg:w-4 lg:h-4"/> 장소 추가하기
                        </button>

                        <button onClick={handleSaveCourse} className="w-full py-3 lg:py-4 mt-3 lg:mt-4 bg-gray-900 hover:bg-black text-white font-bold rounded-lg lg:rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 lg:gap-2 dark:bg-white dark:text-black dark:hover:bg-gray-200 text-xs lg:text-base">
                            <Save size={14} className="lg:w-[18px] lg:h-[18px]"/> <span>현재 코스 저장하기</span>
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAddPlaceOpen && (
                            <motion.div 
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                className="absolute inset-0 bg-white dark:bg-[#111] z-50 flex flex-col"
                            >
                                <header className="p-3 lg:p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-base lg:text-lg text-gray-900 dark:text-white">장소 추가하기</h3>
                                    <button onClick={() => setIsAddPlaceOpen(false)} className="p-1.5 lg:p-2 bg-gray-100 dark:bg-white/10 rounded-full">
                                        <X size={16} className="lg:w-5 lg:h-5"/>
                                    </button>
                                </header>
                                <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar">
                                    {allPopups.map((popup) => (
                                        <div key={popup.id} onClick={() => handleAddPlace(popup)} 
                                             className="flex justify-between items-center p-3 lg:p-4 mb-2 border border-gray-100 dark:border-white/5 rounded-lg lg:rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 transition-colors">
                                            <div>
                                                <h4 className="font-bold text-xs lg:text-sm text-gray-900 dark:text-white">{popup.name}</h4>
                                                <p className="text-[10px] lg:text-xs text-gray-500 dark:text-white/50 mt-0.5">{popup.location}</p>
                                            </div>
                                            <PlusCircle size={16} className="lg:w-[18px] lg:h-[18px] text-indigo-500" />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.section>
        )}

        {/* TAB: MATE */}
        {currentTab === "MATE" && (
            <motion.section aria-label="Mate Board" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                        className="min-h-[80vh] rounded-[2rem] lg:rounded-[2.5rem] border mb-24 relative overflow-hidden backdrop-blur-xl transition-colors bg-white/80 border-gray-200 dark:bg-black/80 dark:border-white/10 shadow-2xl">
                <MateBoard user={user} />
            </motion.section>
        )}

      </div>

      <footer role="contentinfo" className="relative z-10 border-t py-8 md:py-12 lg:py-20 rounded-t-[2rem] lg:rounded-t-[3rem] mt-8 lg:mt-12 pb-32 backdrop-blur-xl transition-colors bg-gray-100 border-gray-300 dark:bg-black/80 dark:border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <div className="col-span-1 sm:col-span-2">
                <h2 className="text-2xl lg:text-3xl font-black mb-3 lg:mb-4 text-gray-900 dark:text-white">POP-SPOT<span className="text-primary">.</span></h2>
                <p className="text-gray-500 dark:text-white/60 max-w-sm mb-4 lg:mb-6 leading-relaxed text-xs lg:text-sm">서울의 모든 팝업스토어를 연결합니다. <br className="hidden md:block"/>데이터 기반의 스마트한 오프라인 경험을 제공합니다.</p>
                <div className="flex gap-3 lg:gap-4">
                    <a href="#" className="p-2.5 lg:p-3 rounded-full transition-colors bg-white hover:bg-primary hover:text-black dark:bg-white/5">
                        <Instagram size={18} className="lg:w-5 lg:h-5 text-gray-700 dark:text-white"/>
                    </a>
                    <a href="#" className="p-2.5 lg:p-3 rounded-full transition-colors bg-white hover:bg-primary hover:text-black dark:bg-white/5">
                        <Twitter size={18} className="lg:w-5 lg:h-5 text-gray-700 dark:text-white"/>
                    </a>
                </div>
            </div>
            <div>
                <h4 className="font-bold mb-4 lg:mb-6 uppercase tracking-wider text-xs lg:text-sm text-gray-900 dark:text-white">Platform</h4>
                <ul className="space-y-2 lg:space-y-3 text-xs lg:text-sm text-gray-500 dark:text-white/60">
                    <li><a href="#" className="hover:text-primary transition-colors">지도 보기</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">팝업 캘린더</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">AI 혼잡도 분석</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">매거진</a></li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold mb-4 lg:mb-6 uppercase tracking-wider text-xs lg:text-sm text-gray-900 dark:text-white">Partners</h4>
                <ul className="space-y-2 lg:space-y-3 text-xs lg:text-sm text-gray-500 dark:text-white/60">
                    <li><a href="#" className="hover:text-primary transition-colors">파트너 등록</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">비즈니스 문의</a></li>
                    <li><a href="#" className="hover:text-primary transition-colors">광고 안내</a></li>
                </ul>
            </div>
        </div>

        <div className="mt-10 lg:mt-16 pt-6 lg:pt-8 border-t border-gray-300 dark:border-white/10 text-center max-w-[1200px] mx-auto px-4 lg:px-6">
            <div className="bg-gray-200 dark:bg-white/5 rounded-lg lg:rounded-xl p-4 lg:p-6 text-[10px] lg:text-xs text-gray-600 dark:text-white/40 leading-relaxed border border-gray-300 dark:border-white/5">
                <p className="font-bold mb-1.5 lg:mb-2 text-gray-900 dark:text-white text-xs lg:text-sm">⚠️ [포트폴리오 안내] 본 사이트는 상업적 목적이 없는 개인 개발용 포트폴리오입니다.</p>
                <p className="mb-1.5 lg:mb-2">
                    제공되는 모든 팝업 정보, 이미지, 혼잡도 데이터는 학습 목적으로 크롤링되거나 시뮬레이션된 데이터이며 실제와 다를 수 있습니다.<br className="hidden md:block"/>
                    실제 티켓 예매 및 결제는 이루어지지 않으며, 금전적 거래를 요구하지 않습니다.
                </p>
                <p>
                    콘텐츠와 관련하여 저작권 및 기타 문제가 있을 경우, 아래 이메일로 연락 주시면 즉시 삭제 및 수정 조치하겠습니다.
                </p>
                <p className="mt-3 lg:mt-4 font-bold text-indigo-600 dark:text-indigo-400">Contact: [reo4321@naver.com]</p>
                <p className="mt-3 lg:mt-4 opacity-50">© 2026 POP-SPOT Portfolio Project. All rights reserved.</p>
            </div>
        </div>
      </footer>

      {/* Navigation Dock */}
      <nav aria-label="Main Navigation" className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-[400px] md:max-w-max md:w-auto">
        <div className="flex items-center justify-between md:justify-center gap-1 md:gap-2 rounded-full p-1.5 md:p-2 px-3 md:px-6 shadow-2xl backdrop-blur-xl border transition-colors bg-white/80 border-gray-200 dark:bg-black/70 dark:border-white/10">
            <DockItem icon={<MapIcon size={20} className="w-4 h-4 md:w-5 md:h-5"/>} label="지도" isActive={currentTab === "MAP"} onClick={() => handleTabChange("MAP")} />
            <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-white/10 mx-0 md:mx-1 shrink-0"></div>
            <DockItem icon={<Route size={20} className="w-4 h-4 md:w-5 md:h-5"/>} label="코스" isActive={currentTab === "COURSE"} onClick={() => handleTabChange("COURSE")} />
            <Link href="/shop" passHref legacyBehavior>
                <a className="shrink-0">
                    <button className={`flex flex-col items-center justify-center w-10 h-10 md:w-14 md:h-14 rounded-full transition-all duration-300 text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10`}>
                        <ShoppingBag size={20} className="w-4 h-4 md:w-5 md:h-5"/>
                    </button>
                </a>
            </Link>
            <DockItem icon={<Ticket size={20} className="w-4 h-4 md:w-5 md:h-5"/>} label="여권" isActive={currentTab === "PASSPORT"} onClick={() => handleTabChange("PASSPORT")} />
            <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-white/10 mx-0 md:mx-1 shrink-0"></div>
            <DockItem icon={<User size={20} className="w-4 h-4 md:w-5 md:h-5"/>} label="MY" isActive={currentTab === "MY"} onClick={() => handleTabChange("MY")} />
            
            <div className="w-px h-3 md:h-4 bg-gray-300 dark:bg-white/10 mx-0 md:mx-1 shrink-0"></div>
            <DockItem icon={<Users size={20} className={`w-4 h-4 md:w-5 md:h-5 ${currentTab === "MATE" ? "text-indigo-500" : ""}`} />} label="동행" isActive={currentTab === "MATE"} onClick={() => handleTabChange("MATE")} />
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 dark:bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}></motion.div>
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }} 
                            className="relative w-full max-w-5xl h-[85vh] rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 flex flex-col shadow-2xl overflow-hidden border transition-colors bg-white border-gray-200 dark:bg-[#0a0a0a] dark:border-white/10">
                    <header className="flex justify-between items-center mb-6 lg:mb-8 pb-4 lg:pb-6 border-b border-gray-200 dark:border-white/5">
                        <div>
                            <h2 className="text-2xl lg:text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">ALL TRENDING<span className="text-primary text-3xl lg:text-5xl animate-pulse">.</span></h2>
                            <p className="text-[10px] lg:text-sm text-gray-500 dark:text-white/60 mt-1 lg:mt-2">서울에서 가장 핫한 팝업스토어 실시간 랭킹</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 lg:p-3 rounded-full transition-colors group bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/20">
                            <X size={20} className="lg:w-6 lg:h-6 text-gray-900 dark:text-white group-hover:rotate-90 transition-transform duration-300"/>
                        </button>
                    </header>
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-1 lg:px-2">
                        {allPopups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-white/60 space-y-4">
                                {/* 스켈레톤 로딩 적용 */}
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="animate-pulse w-full max-w-3xl p-5 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-gray-300 dark:bg-white/10 rounded-full"></div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-40 bg-gray-300 dark:bg-white/10 rounded"></div>
                                                <div className="h-3 w-24 bg-gray-300 dark:bg-white/10 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                                <AnimatePresence>
                                {allPopups.map((popup, idx) => (
                                    <Link href={`/popup/${popup.id}`} key={popup.id} onClick={() => setIsModalOpen(false)} passHref legacyBehavior>
                                        <motion.a layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} 
                                                    className="relative flex items-center justify-between p-4 lg:p-5 rounded-xl lg:rounded-2xl transition-all duration-300 group hover:translate-y-[-2px] hover:shadow-lg border bg-white border-gray-200 hover:border-primary/50 dark:bg-[#111] dark:bg-gradient-to-br dark:from-white/5 dark:to-transparent dark:border-white/5">
                                            <div className="flex items-center gap-3 lg:gap-5">
                                                    <div className="w-8 lg:w-12 text-center">
                                                        <span className={`text-xl lg:text-3xl font-black italic tracking-tighter ${idx < 3 ? 'text-transparent bg-clip-text bg-gradient-to-br from-primary to-white drop-shadow-md' : 'text-gray-300 dark:text-white/20'}`}>{idx + 1}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-sm lg:text-lg block mb-0.5 lg:mb-1 transition-colors duration-300 truncate max-w-[150px] md:max-w-[200px] lg:max-w-[280px] text-gray-900 group-hover:text-primary dark:text-white">{popup.name}</span>
                                                        <span className="text-[10px] lg:text-xs flex items-center gap-1 text-gray-500 dark:text-white/60"><MapPin size={10} className="lg:w-3 lg:h-3"/> {popup.location}</span>
                                                    </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 lg:gap-2 pl-2 lg:pl-4">
                                                    <div className="text-[9px] lg:text-[10px] flex items-center gap-1 px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-black/30 dark:text-white/60"><Users size={8} className="lg:w-2.5 lg:h-2.5"/> {popup.viewCount || 0}</div>
                                                    <span className={`text-[9px] lg:text-[11px] px-2 py-1 lg:px-3 lg:py-1.5 rounded-full border font-bold whitespace-nowrap shrink-0 tracking-wider ${popup.status === '혼잡' ? 'border-secondary/50 text-secondary bg-secondary/10' : 'border-primary/50 text-primary bg-primary/10'}`}>{popup.status || '영업중'}</span>
                                            </div>
                                        </motion.a>
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

      <AnimatePresence>
        {isReportOpen && congestionData && (
            <AIReportModal 
            data={congestionData} 
            onClose={() => setIsReportOpen(false)} 
            />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReportPopupOpen && (
            <ReportPopupModal 
                user={user} 
                onClose={() => setIsReportPopupOpen(false)} 
            />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCalendarOpen && (
            <PopupCalendarModal 
                popups={allPopups} 
                onClose={() => setIsCalendarOpen(false)} 
            />
        )}
      </AnimatePresence>

    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub Components                                                             */
/* -------------------------------------------------------------------------- */
function DockItem({ icon, label, isActive, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-10 h-10 md:w-14 md:h-14 rounded-full transition-all duration-300 shrink-0 ${
        isActive 
        ? "bg-gray-900 text-white scale-110 shadow-lg dark:bg-white dark:text-black" 
        : "text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
    }`}>
      {icon}
      {isActive && <span className="text-[8px] md:text-[9px] font-bold mt-0.5">{label}</span>}
    </button>
  );
}

function ReportPopupModal({ onClose, user }: { onClose: () => void, user: any }) {
    const [formData, setFormData] = useState({
        name: "", category: "FASHION", location: "", address: "",
        startDate: "", endDate: "", description: "", reporterId: user?.userId || "unknown"
    });

    const handleChange = (e: any) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_BASE_URL}/api/popups/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: '제보 완료! 📢',
                    text: '관리자 승인 후 지도에 노출됩니다.',
                    confirmButtonColor: '#4f46e5'
                });
                onClose();
            } else { Swal.fire({ icon: 'error', text: '오류가 발생했습니다.' }); }
        } catch (error) { Swal.fire({ icon: 'error', text: '서버와 연결할 수 없습니다.' }); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1a1a1a] rounded-3xl p-8 border border-gray-200 dark:border-white/10 shadow-2xl">
                <header className="flex justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-black flex items-center gap-2"><Megaphone className="text-indigo-500"/> 팝업 제보</h2>
                        <p className="text-sm text-gray-500">알고 있는 팝업 정보를 공유하세요!</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </header>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div><label className="block text-xs font-bold mb-1">팝업 이름 *</label><input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                    <div><label className="block text-xs font-bold mb-1">카테고리 *</label><select name="category" value={formData.category} onChange={handleChange} className="w-full bg-gray-50 dark:bg-black/50 border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"><option value="FASHION">패션</option><option value="FOOD">음식</option><option value="POPUP">일반</option></select></div>
                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold mb-1">지역 *</label><input type="text" name="location" required value={formData.location} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none"/></div><div><label className="block text-xs font-bold mb-1">주소</label><input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none"/></div></div>
                    <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold mb-1">시작일 *</label><input type="date" name="startDate" required value={formData.startDate} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none"/></div><div><label className="block text-xs font-bold mb-1">종료일 *</label><input type="date" name="endDate" required value={formData.endDate} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none"/></div></div>
                    <div><label className="block text-xs font-bold mb-1">간단 설명</label><textarea name="description" rows={3} value={formData.description} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 text-sm outline-none resize-none"></textarea></div>
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">제보 제출</button>
                </form>
            </motion.div>
        </div>
    );
}

function PopupCalendarModal({ onClose, popups }: { onClose: () => void, popups: PopupStore[] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [
        ...Array.from({ length: firstDay }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
    ];

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(1); 
    };
    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(1);
    };

    const getPopupsForDate = (day: number | null) => {
        if (!day) return [];
        const targetDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return popups.filter(p => {
            if (!p.startDate) return false;
            const start = p.startDate;
            const end = p.endDate || p.startDate; 
            return targetDate >= start && targetDate <= end;
        });
    };

    const selectedPopups = getPopupsForDate(selectedDay);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                onClick={onClose} 
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-3xl p-5 md:p-6 border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh]"
            >
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black flex items-center gap-2 text-gray-900 dark:text-white">🗓️ 팝업 캘린더</h2>
                        <p className="text-[10px] md:text-xs text-gray-500 mt-1">원하는 날짜를 눌러 일정을 확인하세요.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors text-gray-800 dark:text-white"><X size={18}/></button>
                </header>

                <nav className="flex justify-between items-center mb-4 px-2">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-800 dark:text-white"><ChevronLeft size={20}/></button>
                    <span className="font-black text-lg md:text-xl text-gray-900 dark:text-white">{year}년 {month + 1}월</span>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-800 dark:text-white"><ChevronRight size={20}/></button>
                </nav>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div key={d} className={`text-[10px] md:text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                        const dailyPopups = getPopupsForDate(day);
                        const hasPopups = dailyPopups.length > 0;
                        const isSelected = day === selectedDay;
                        return (
                            <div 
                                key={idx} 
                                onClick={() => day && setSelectedDay(day)}
                                className={`aspect-square flex flex-col items-center justify-center rounded-lg md:rounded-xl cursor-pointer transition-all relative
                                    ${!day ? '' : isSelected ? 'bg-indigo-600 shadow-md shadow-indigo-600/30 scale-105 z-10' : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'}
                                `}
                            >
                                <span className={`text-xs md:text-sm font-bold ${!day ? '' : isSelected ? 'text-white' : idx % 7 === 0 ? 'text-red-500' : idx % 7 === 6 ? 'text-blue-500' : 'text-gray-900 dark:text-white'}`}>
                                    {day}
                                </span>
                                {hasPopups && day && (
                                    <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mt-0.5 md:mt-1 ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}></div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 md:mt-6 flex-1 overflow-y-auto custom-scrollbar border-t border-gray-100 dark:border-white/5 pt-4">
                    <h4 className="text-xs md:text-sm font-bold mb-3 flex items-center gap-1.5 md:gap-2 text-gray-900 dark:text-white px-1">
                        <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-indigo-500 rounded-full animate-pulse"></span> 
                        {month + 1}월 {selectedDay}일 진행 팝업 ({selectedPopups.length})
                    </h4>
                    
                    {selectedPopups.length === 0 ? (
                        <div className="text-[10px] md:text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">이 날은 팝업 일정이 없습니다.</div>
                    ) : (
                        <div className="space-y-2 pr-1">
                            {selectedPopups.map(popup => (
                                <Link href={`/popup/${popup.id}`} key={popup.id} onClick={onClose} passHref legacyBehavior>
                                    <article className="p-3 bg-gray-50 dark:bg-[#222] rounded-xl border border-gray-200 dark:border-white/5 flex justify-between items-center hover:border-indigo-500 transition-colors group cursor-pointer">
                                        <div>
                                            <h5 className="font-bold text-xs md:text-sm text-gray-900 dark:text-white group-hover:text-indigo-500 truncate max-w-[180px] md:max-w-[220px]">{popup.name}</h5>
                                            <p className="text-[9px] md:text-[10px] text-gray-500 mt-0.5 truncate max-w-[180px] md:max-w-[220px]">{popup.location}</p>
                                        </div>
                                        <span className="text-[9px] md:text-[10px] px-2 py-1 bg-white dark:bg-black/50 text-gray-700 dark:text-white rounded-md border border-gray-200 dark:border-white/10 shrink-0 font-bold group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 transition-colors">
                                            상세보기
                                        </span>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
