"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation"; 
import { 
  Search, MapPin, ArrowUpRight, Flame, Calendar, Menu, Users, 
  Instagram, Twitter, Plus, X, ArrowUp, ArrowDown, Minus, 
  Map as MapIcon, Route, Ticket, User as UserIcon, LogOut, Sparkles, Lock, ArrowRight, Loader2, RefreshCw,
  Shirt, Video, ShoppingBag, Crown, GripVertical, PlusCircle, Zap, MessageCircle, Heart, Star, Gift, Megaphone,
  FolderOpen, Save, Trash2, Store, ShieldCheck, ChevronLeft, ChevronRight, Camera, Coffee, Music
} from "lucide-react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import Swal, { SweetAlertResult } from "sweetalert2"; 

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
import AIReportModal from "../src/components/AIReportModal"; 
import LiveChatTicker from "../src/components/LiveChatTicker";
import { SortableItem } from "../src/components/SortableItem";
import MateBoard from "../src/components/MateBoard"; 
import { apiFetch, API_BASE_URL, SOCKET_BASE_URL } from "../src/lib/api";
import { Header } from "../src/components/layout/Header";
import { Footer } from "../src/components/layout/Footer";
import { BottomDock, type DockTab } from "../src/components/layout/BottomDock";
import MusicTab from "@/components/music/MusicTab";
import RankCard from "@/components/rank/RankCard";
import { notify } from "@/lib/notify";
import { SearchZone } from "@/features/popup/SearchBox";
import { ReportPopupModal } from "@/features/popup/ReportPopupModal";
import { PopupCalendarModal } from "@/features/popup/PopupCalendarModal";
import { AllTrendingModal } from "@/features/popup/AllTrendingModal";
import type {
  User,
  PopupStore,
  CongestionData,
  TrendOotd,
  MyPageData,
  WishlistItem,
  CourseItem,
  SavedCourse,
} from "@/types/popup";

const INITIAL_MY_COURSE: CourseItem[] = [];

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
  const [user, setUser] = useState<User | null>(null);
  const [myPageInfo, setMyPageInfo] = useState<MyPageData | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [myWishlist, setMyWishlist] = useState<WishlistItem[]>([]);
  const [aiCourse, setAiCourse] = useState<CourseItem[]>([]); 
  const [myCourseItems, setMyCourseItems] = useState<CourseItem[]>(INITIAL_MY_COURSE);

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
          Swal.fire({ icon: 'warning', text: '먼저 AI 추천 코스를 생성해주세요.' });
          return;
      }
      setMyCourseItems([...aiCourse]); 
      handleTabChange("MY"); 
      Swal.fire({ icon: 'success', text: 'AI 추천 코스가 적용되었습니다.' });
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
            title: '로그인이 필요합니다',
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
            title: '로그인이 필요합니다',
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
    if (!vibe.trim()) return Swal.fire('분위기를 입력해주세요.');
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
            title: '무료 회원 슬롯 제한',
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
            Swal.fire({ icon: 'success', text: '코스가 저장되었습니다.' });
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
        const sortedData = [...(data as PopupStore[])].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        setHotPopups(sortedData.slice(0, 5)); 
    }
    
    apiFetch('/api/popups')
        .then(res => res.json())
        .then(data => {
            setAllPopups(data);
            const sortedData = [...(data as PopupStore[])].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
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
      
    // 외부에서 들어올 때 ?tab=music 같은 파라미터로 직접 진입할 수 있게 한다.
    // (예: 구버전 /music 라우트가 / 로 redirect 될 때 사용)
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setCurrentTab(tabParam.toUpperCase());
      return;
    }
    const lastTab = sessionStorage.getItem("lastTab");
    if (lastTab) setCurrentTab(lastTab);
  }, [searchParams]);

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
    <main className="min-h-screen font-sans relative pb-32 overflow-x-hidden transition-colors duration-500 bg-gray-50 text-gray-900 dark:bg-black dark:text-white">
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <video autoPlay loop muted playsInline className="absolute min-w-full min-h-full object-cover">
          <source src="/bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 transition-colors duration-500 bg-white/80 dark:bg-black/80 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 px-4 md:px-6 py-4 md:py-6 max-w-[1600px] mx-auto">
        
        <Header
          user={user}
          onLogout={handleLogout}
          onLogoClick={() => handleTabChange("MAP")}
          onReportClick={() => setIsReportPopupOpen(true)}
          className="mb-6 md:mb-10"
        />

        {/* TAB: MAP */}
        {currentTab === "MAP" && (
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
                
                {/* User Greeting Section */}
                <section aria-label="Welcome Banner" className="mb-6">
                    {user ? (
                        <div className="w-full border rounded-xl p-5 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200">
                             <div className="relative z-10 text-center md:text-left">
                                <h2 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">반가워요, <span className="text-lime-300 dark:text-lime-700">{user.nickname}</span>님!</h2>
                                <p className="text-xs md:text-base opacity-70">오늘 서울에 <span className="font-bold text-lime-300">{allPopups.length}개</span>의 팝업이 열려있어요.</p>
                             </div>
                             <button onClick={() => handleTabChange("PASSPORT")} className="relative z-10 w-full md:w-auto inline-flex px-5 py-3 bg-lime-300 hover:bg-lime-400 text-ink-900 font-semibold rounded-pill items-center justify-center gap-2 transition-colors text-sm md:text-base">
                                <Ticket size={18}/> 내 여권 확인
                             </button>
                        </div>
                    ) : (
                        <div className="w-full border rounded-xl p-6 md:p-10 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6 transition-colors bg-white/60 border-gray-200 backdrop-blur-md dark:bg-white/5 dark:border-white/10">
                            <div className="relative z-10">
                                <div className="inline-block px-3 py-1 mb-3 md:mb-4 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase rounded-pill bg-lime-300 text-ink-900">
                                    Welcome to POP-SPOT
                                </div>
                                <h2 className="text-2xl md:text-5xl font-black mb-3 md:mb-4 leading-tight text-gray-900 dark:text-white">
                                    Find Your <span className="text-hot-400">Vibe</span><br className="hidden md:block"/>
                                    in Seoul.
                                </h2>
                                <p className="text-xs md:text-base text-gray-600 dark:text-white/70 max-w-md">
                                    지금 로그인하고 나만의 팝업 지도를 만들어보세요.<br/>
                                    친구와 함께하는 실시간 동선 계획부터 스탬프 적립까지.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
                                <Link href="/login" className="flex-1 md:flex-none">
                                    <button className="w-full md:w-auto px-6 py-3 md:px-8 md:py-4 bg-lime-300 hover:bg-lime-400 text-ink-900 font-semibold rounded-pill transition-colors inline-flex items-center justify-center gap-2 text-sm md:text-base">
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

                {/* V5: 음악 → 팝업 추천 진입 (홈 디스커버리) */}
                <button
                    type="button"
                    onClick={() => handleTabChange("MUSIC")}
                    aria-label="POP·MUSIC 둘러보기"
                    className="group relative mb-6 flex w-full items-center justify-between overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-fuchsia-500/15 via-lime-300/10 to-sky-500/15 p-5 backdrop-blur transition hover:scale-[1.005] hover:shadow-lg"
                >
                    <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-lime-300 text-ink-900 shadow-lg shadow-lime-300/30">
                            <Music size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
                                NEW · BETA
                            </p>
                            <p className="text-base md:text-lg font-black text-foreground">
                                듣는 곡으로 분위기에 맞는 팝업 찾기
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Spotify 검색 · 풀 재생 · 룰렛 · 패스포트
                            </p>
                        </div>
                    </div>
                    <ArrowRight size={20} className="text-foreground transition group-hover:translate-x-1" />
                </button>

                {/* Dashboard Main Grid */}
                <section aria-label="Dashboard Layout" className="grid grid-cols-1 lg:grid-cols-12 md:grid-rows-6 gap-4 min-h-[80vh] mb-16">
                    
                    {/* Search Zone */}
                    <div className="col-span-1 lg:col-span-5 md:row-span-2 relative z-50 order-1 lg:order-none">
                        <SearchZone />
                    </div>
                    
                    {/* Map Zone — 배경 분리를 위해 solid 배경 + shadow 로 카드 블록 강화. */}
                    <div className="col-span-1 lg:col-span-7 md:row-span-4 rounded-[2rem] relative overflow-hidden border border-gray-200 dark:border-white/10 group bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 min-h-[400px] md:min-h-0 order-2 lg:order-none">
                        <InteractiveMap onMarkerClick={handleMarkerClickToDetail} />
                        <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex gap-2 z-20">
                            <span className="backdrop-blur px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 bg-white/80 border-gray-200 text-gray-900 dark:bg-black/60 dark:border-white/10 dark:text-white">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"/> LIVE DATA
                            </span>
                        </div>
                    </div>

                    {/* Real-time Ranking Zone — solid 카드 블록 (배경 겹침 가독성 개선). */}
                    <div className="col-span-1 lg:col-span-5 md:row-span-4 rounded-[2rem] p-5 md:p-6 border flex flex-col transition-colors bg-white border-gray-200 dark:bg-[#111] dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 order-3 lg:order-none h-[300px] md:h-auto">
                        <header className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <Flame size={18} className="text-secondary animate-pulse md:w-5 md:h-5"/>
                                <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">REAL-TIME RANKING</h3>
                            </div>
                            <button onClick={handleOpenModal} aria-label="전체 트렌딩 보기" className="p-1.5 md:p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors group">
                                <Plus size={18} className="md:w-5 md:h-5 text-gray-500 dark:text-white/60 group-hover:text-primary transition-colors"/>
                            </button>
                        </header>
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1 md:pr-2">
                            {hotPopups.length > 0 ? (
                            <AnimatePresence>
                                {hotPopups.map((popup, idx) => (
                                <motion.a
                                    href={`/popup/${popup.id}`}
                                    key={popup.id}
                                    onClick={(e) => { e.preventDefault(); handleTabChange("MAP"); router.push(`/popup/${popup.id}`); }} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} 
                                                className="flex items-center justify-between p-3 md:p-4 mb-2 rounded-xl md:rounded-2xl transition-all cursor-pointer group border bg-white hover:bg-gray-50 hover:scale-[1.01] active:scale-[0.99] border-gray-100 hover:border-gray-300 dark:bg-white/5 dark:hover:bg-white/10 dark:border-transparent dark:hover:border-white/10">
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
                                ))}
                            </AnimatePresence>
                            ) : (
                            <div className="h-full flex flex-col justify-center space-y-3 opacity-60">
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

                    {/* Calendar Zone — primary 컬러 solid + shadow 강화. */}
                    <div
                        onClick={() => setIsCalendarOpen(true)}
                        className="col-span-1 lg:col-span-4 md:row-span-2 bg-primary text-black rounded-[2rem] p-5 md:p-6 transition-all hover:scale-[1.02] cursor-pointer shadow-xl shadow-primary/20 dark:shadow-primary/10 relative overflow-hidden group order-4 lg:order-none flex flex-col justify-between"
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

                    {/* AI Report Zone — solid 카드 블록 + 클릭 피드백. */}
                    <div onClick={() => setIsReportOpen(true)} className="col-span-1 lg:col-span-3 md:row-span-2 rounded-[2rem] p-5 md:p-6 cursor-pointer border flex flex-col justify-between group transition-all hover:scale-[1.02] active:scale-[0.99] bg-white border-gray-200 hover:border-primary dark:bg-[#111] dark:border-white/10 dark:hover:border-primary shadow-lg shadow-black/5 dark:shadow-black/30 order-5 lg:order-none">
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
                <motion.section aria-label="Style Recommendation" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-16">
                    <header className="flex flex-col md:flex-row items-center md:items-end justify-between mb-8 md:mb-12 text-center md:text-left">
                        <h2 className="font-display-en text-4xl md:text-7xl font-extrabold tracking-tighter relative z-10 text-foreground">POP-LOOK<span className="text-hot-400">.</span></h2>
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
                                <div className="z-10"><p className="text-gray-400 dark:text-gray-600 text-[10px] lg:text-xs font-bold mb-0.5 lg:mb-1">POP-SPOT EXCLUSIVE</p><p className="text-white dark:text-black text-sm lg:text-xl font-black">해당 스타일로 방문 시 스탬프 2배 적립</p></div>
                                <div className="w-8 h-8 lg:w-12 lg:h-12 bg-white dark:bg-black rounded-full flex items-center justify-center text-black dark:text-white group-hover:scale-110 transition-transform z-10"><ArrowUpRight size={18} className="lg:w-6 lg:h-6"/></div>
                            </article>
                        </div>
                    </div>
                </motion.section>

                {/* Live Chat Ticker Section */}
                <motion.section aria-label="Live Community Updates" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-16 relative">
                                        <LiveChatTicker />
                    <div className="text-center mt-6 lg:mt-8"><p className="text-[10px] lg:text-sm text-gray-500 dark:text-white/40">* 서울 현장 유저들이 실시간으로 공유하는 정보입니다.</p></div>
                </motion.section>

                {/* Collaboration Feature Promo Section */}
                <motion.section aria-label="Feature Promotion" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-16 py-12 px-6 lg:py-20 lg:px-12 bg-ink-900 text-cream-200 relative overflow-hidden rounded-xl lg:rounded-2xl shadow-pop">
                                        
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 relative z-10">
                        <div className="flex-1 text-center lg:text-left">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-lime-300/15 border border-lime-300/40 text-lime-300 text-[10px] lg:text-xs font-semibold tracking-wide mb-4 lg:mb-6">
                                <Users size={12} className="lg:w-4 lg:h-4"/> 실시간 협업 기능
                            </div>
                            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-4 lg:mb-6 leading-tight">
                                친구와 함께 그리는<br />
                                <span className="text-lime-300">서울 작전지도</span>
                            </h2>
                            <p className="text-gray-400 text-xs lg:text-lg mb-6 lg:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
                                "거기 어때?" 링크 공유는 그만.<br />
                                같은 화면을 보며 실시간으로 마커를 찍고 동선을 계획하세요.<br className="hidden lg:block"/>
                            </p>
                            <button 
                                onClick={handleCreateRoom}
                                className="group relative inline-flex items-center justify-center px-6 py-3 lg:px-8 lg:py-4 font-semibold text-ink-900 transition-colors bg-lime-300 hover:bg-lime-400 rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-sm lg:text-base w-full lg:w-auto"
                            >
                                <span className="mr-2">작전 회의실 만들기</span>
                                <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 transition-transform group-hover:translate-x-1" />
                                <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                            </button>
                        </div>

                        <div className="flex-1 w-full max-w-sm lg:max-w-md hidden md:block">
                            <div className="relative bg-ink-800 border border-ink-700 rounded-xl p-5 lg:p-6 shadow-pop">

                                {/* 협업 도구 미리보기: 점선 경로 + 실제 지명 핀 */}
                                <div className="relative w-full h-48 lg:h-56 rounded-lg overflow-hidden bg-ink-900 border border-ink-700"
                                     style={{
                                         backgroundImage: "radial-gradient(circle, rgba(245,243,238,0.06) 1px, transparent 1px)",
                                         backgroundSize: "16px 16px",
                                     }}
                                     aria-hidden
                                >
                                    {/* 점선 SVG 경로: 성수 → 한남 → 압구정 */}
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 224" preserveAspectRatio="none">
                                        <path
                                            d="M 60 50 Q 120 90 170 110 T 270 175"
                                            fill="none"
                                            stroke="var(--color-lime-300)"
                                            strokeWidth="2"
                                            strokeDasharray="5 5"
                                            strokeLinecap="round"
                                            opacity="0.7"
                                        />
                                    </svg>

                                    {/* 핀 1 — 성수 */}
                                    <div className="absolute top-[18%] left-[15%] flex items-center gap-1.5">
                                        <span className="w-3 h-3 rounded-full bg-lime-300 ring-2 ring-ink-900" />
                                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">성수</span>
                                    </div>

                                    {/* 핀 2 — 한남 (현재 편집 중인 위치) */}
                                    <div className="absolute top-[44%] left-[48%] flex items-center gap-1.5">
                                        <span className="relative flex items-center justify-center">
                                            <span className="absolute w-5 h-5 rounded-full bg-hot-400/40 animate-ping" />
                                            <span className="relative w-3 h-3 rounded-full bg-hot-400 ring-2 ring-ink-900" />
                                        </span>
                                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">한남</span>
                                    </div>

                                    {/* 핀 3 — 압구정 */}
                                    <div className="absolute bottom-[12%] right-[8%] flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">압구정</span>
                                        <span className="w-3 h-3 rounded-full bg-cream-200 ring-2 ring-ink-900" />
                                    </div>

                                    {/* 친구의 동시 편집 커서 */}
                                    <div className="absolute top-[35%] left-[55%] pointer-events-none">
                                        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className="drop-shadow-md">
                                            <path d="M0 0 L 0 14 L 4 11 L 7 17 L 9 16 L 6 10 L 11 10 Z" fill="#FFC107" stroke="#0a0a0a" strokeWidth="0.8" strokeLinejoin="round" />
                                        </svg>
                                        <div className="ml-3 mt-0 px-1.5 py-0.5 bg-amber-400 text-ink-900 text-[9px] font-bold rounded whitespace-nowrap">민지</div>
                                    </div>
                                </div>

                                {/* 하단: 다음 후보지 메타 */}
                                <div className="mt-4 flex items-center justify-between gap-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
                                        <span className="text-[11px] text-cream-200/70">2명 함께 편집 중</span>
                                    </div>
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-cream-200/40">3 stops · 1.2km</span>
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
                        className="min-h-[60vh] flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 relative overflow-hidden p-4 shadow-md">
              {user ? (<PassportView />) : (
                  <div className="text-center p-6 lg:p-8 z-10 w-full max-w-md">
                      <div className="w-20 h-20 rounded-pill flex items-center justify-center mx-auto mb-6 border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800"><Lock size={32} className="lg:w-10 lg:h-10 text-muted-foreground" /></div>
                      <h2 className="text-2xl lg:text-3xl font-bold mb-3 text-foreground">로그인이 필요합니다</h2><p className="text-sm text-muted-foreground mb-8">나만의 팝업 여권을 만들고 스탬프를 모아보세요.</p>
                      <Link href="/login" className="inline-flex w-full lg:w-auto px-6 py-3 bg-lime-300 hover:bg-lime-400 text-ink-900 font-semibold rounded-pill transition-colors items-center justify-center text-sm lg:text-base">로그인 하러가기</Link>
                  </div>
              )}
            </motion.section>
        )}

        {/* TAB: MUSIC */}
        {currentTab === "MUSIC" && (
            <motion.section
                aria-label="Music to Popup"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-16 rounded-xl border border-[var(--color-border)] bg-surface p-4 lg:p-6"
            >
                <MusicTab />
            </motion.section>
        )}

        {/* TAB: COURSE */}
        {currentTab === "COURSE" && (
             <motion.section aria-label="AI Course Generator" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} 
                          className="min-h-[60vh] flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 p-4 lg:p-6 relative overflow-hidden">
                <header className="text-center mb-8 lg:mb-10 z-10 mt-6 lg:mt-8">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill border border-lime-300/40 bg-lime-300/10 text-lime-500 text-[10px] lg:text-xs font-semibold tracking-wide mb-4"><Sparkles size={10} className="lg:w-3 lg:h-3"/> AI CURATION · BETA</div>
                    <h2 className="font-display-en text-2xl md:text-4xl lg:text-5xl font-extrabold tracking-tighter mb-2 text-foreground">POP<span className="text-lime-300">-</span>COURSE</h2>
                    <p className="text-muted-foreground text-sm">원하는 분위기를 선택하면 AI가 최적의 동선을 추천합니다.</p>
                </header>

                <div className="w-full max-w-3xl z-10 mb-8 lg:mb-12 flex flex-col gap-3 lg:gap-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 px-2 lg:px-0">
                        {[
                            { val: '핫플', no: '01', label: '핫플레이스', desc: '지금 가장 뜨거운', icon: Flame },
                            { val: '데이트', no: '02', label: '데이트', desc: '둘이 가기 좋은', icon: Heart },
                            { val: '사진', no: '03', label: '사진 명소', desc: '찍기 좋은 스팟', icon: Camera },
                            { val: '힐링', no: '04', label: '휴식·힐링', desc: '잠시 멈출 곳', icon: Coffee },
                        ].map((item) => {
                            const Icon = item.icon;
                            const active = selectedVibe === item.val;
                            return (
                                <button
                                    key={item.val}
                                    type="button"
                                    onClick={() => handleAiRecommend(item.val)}
                                    disabled={isAiLoading}
                                    aria-pressed={active}
                                    className={`group relative overflow-hidden rounded-xl border text-left transition-colors p-4 lg:p-5 min-h-[136px] lg:min-h-[160px] flex flex-col justify-between
                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                                        disabled:opacity-60 ${
                                            active
                                                ? "bg-lime-300 border-lime-400 text-ink-900 shadow-md"
                                                : "bg-cream-100 dark:bg-ink-600 text-foreground border-[var(--color-border)] hover:border-lime-300/60"
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <span className={`font-mono text-[11px] tracking-[0.2em] ${active ? "text-ink-900/60" : "text-muted-foreground"}`}>
                                            No. {item.no}
                                        </span>
                                        <Icon
                                            className={`size-5 transition-colors ${active ? "text-ink-900" : "text-foreground/40 group-hover:text-lime-500"}`}
                                            aria-hidden
                                            strokeWidth={1.6}
                                        />
                                    </div>

                                    <div>
                                        <div className={`text-base lg:text-lg font-bold leading-tight ${active ? "text-ink-900" : "text-foreground"}`}>
                                            {item.label}
                                        </div>
                                        <div className={`text-xs mt-0.5 ${active ? "text-ink-900/70" : "text-muted-foreground"}`}>
                                            {item.desc}
                                        </div>
                                    </div>

                                    {isAiLoading && active && (
                                        <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                                            <Loader2 className="animate-spin text-ink-900 size-5" aria-hidden />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex flex-col items-center mt-2 px-2 lg:px-0">
                        {!showCustomInput ? (
                            <button onClick={() => setShowCustomInput(true)} className="text-sm flex items-center gap-2 transition-colors border-b border-transparent pb-1 text-muted-foreground hover:text-lime-500 hover:border-lime-500">
                                <Sparkles size={12} className="lg:w-3.5 lg:h-3.5"/> 찾는 분위기가 없나요? 직접 입력하기
                            </button>
                        ) : (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full max-w-md gap-2">
                                <input type="text" value={customVibeInput} onChange={(e) => setCustomVibeInput(e.target.value)} placeholder="예: 비 오는 날 가기 좋은 곳" className="flex-1 h-11 rounded-md px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-surface border border-[var(--color-border-strong)] text-foreground placeholder:text-muted-foreground text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAiRecommend(customVibeInput)}/>
                                <button onClick={() => handleAiRecommend(customVibeInput)} className="bg-lime-300 hover:bg-lime-400 text-ink-900 px-4 lg:px-6 rounded-pill font-semibold transition-colors text-xs lg:text-sm whitespace-nowrap">추천</button>
                                <button onClick={() => setShowCustomInput(false)} className="size-11 inline-flex items-center justify-center rounded-md transition-colors bg-cream-300 dark:bg-ink-700 hover:bg-cream-400 dark:hover:bg-ink-600 text-muted-foreground flex-shrink-0"><X size={16} className="lg:w-[18px] lg:h-[18px]"/></button>
                            </motion.div>
                        )}
                    </div>
                </div>

                <div className="w-full max-w-3xl z-10 min-h-[300px] px-2 lg:px-0">
                    <header className="flex items-center justify-between mb-4 lg:mb-6">
                        <h3 className="font-bold text-base lg:text-lg flex items-center gap-2 text-foreground">
                            {isAiLoading ? <Loader2 className="animate-spin text-lime-500 w-4 h-4 lg:w-5 lg:h-5"/> : <Route size={16} className="text-lime-500 lg:w-5 lg:h-5"/>}
                            {isAiLoading ? "AI가 코스를 짜고 있어요..." : (aiCourse.length > 0 ? "AI RECOMMENDED COURSE" : "원하는 분위기를 선택해보세요.")}
                        </h3>
                        {aiCourse.length > 0 && !isAiLoading && (
                             <button onClick={handleResetCourse} className="text-xs flex items-center gap-1 transition-colors text-muted-foreground hover:text-danger"><RefreshCw size={10} className="lg:w-3 lg:h-3"/> 초기화</button>
                        )}
                    </header>

                    {!isAiLoading && aiCourse.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                                    className="rounded-xl p-5 lg:p-8 border border-[var(--color-border)] relative overflow-hidden bg-surface shadow-md">
                                                        <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6 lg:mb-8">
                                    <div>
                                        <span className="text-[9px] lg:text-xs font-bold tracking-wider text-ink-900 bg-lime-300 px-2.5 py-1 rounded-pill mb-2 lg:mb-3 inline-block">FOR YOU</span>
                                        <h4 className="text-xl lg:text-2xl font-bold text-foreground">서울 <span className="text-hot-500">{selectedVibe}</span> 맞춤 코스</h4>
                                        <p className="text-muted-foreground text-sm mt-1">AI가 제안하는 최적의 동선입니다.</p>
                                    </div>
                                </div>
                                <div className="space-y-4 lg:space-y-6">
                                    {aiCourse.map((item, idx) => (
                                        <article key={idx} className="flex gap-3 lg:gap-4 group/item">
                                            <div className="flex flex-col items-center">
                                                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-pill bg-ink-900 dark:bg-cream-200 flex items-center justify-center text-xs lg:text-sm font-bold text-cream-200 dark:text-ink-900 z-10">{idx + 1}</div>
                                                {idx < aiCourse.length - 1 && (<div className="w-px flex-1 my-1 lg:my-2 bg-[var(--color-border-strong)]" />)}
                                            </div>
                                            <div className="flex-1 pb-4 lg:pb-6 cursor-pointer" onClick={() => router.push(`/popup/${item.id}`)}>
                                                <div className="p-4 rounded-md border border-[var(--color-border)] transition-colors bg-cream-300 dark:bg-ink-800 hover:border-lime-300/60">
                                                    <div className="flex justify-between items-center mb-1"><h5 className="font-bold text-sm lg:text-base text-foreground">{item.name}</h5><ArrowRight size={14} className="lg:w-4 lg:h-4 text-muted-foreground" /></div>
                                                    <p className="text-sm mb-2 text-muted-foreground line-clamp-2 italic">"{item.reason}"</p>
                                                    <div className="flex gap-2"><span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-pill bg-surface border border-[var(--color-border)] text-muted-foreground">POP-UP</span></div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={handleCopyAiToMyCourse}
                                    className="w-full py-3 lg:py-4 mt-2 lg:mt-4 bg-lime-300 hover:bg-lime-400 rounded-pill font-semibold text-ink-900 transition-colors flex items-center justify-center gap-1.5 lg:gap-2 text-sm lg:text-base"
                                >
                                  <MapIcon size={14} className="lg:w-[18px] lg:h-[18px]" /> 전체 경로 지도에서 보기 (MY 탭으로 이동)
                                </button>
                                
                                <button onClick={handleSaveCourse} className="w-full py-3 lg:py-4 mt-2 lg:mt-3 bg-transparent hover:bg-foreground/5 text-foreground border border-[var(--color-border-strong)] rounded-pill font-semibold transition-colors flex items-center justify-center gap-2 text-sm lg:text-base">
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
                        className="h-[85vh] flex flex-col md:flex-row overflow-hidden rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 relative shadow-md">
                
                {/* 1. Map Context Area */}
                <div className="w-full md:w-[55%] h-[35vh] md:h-full relative border-b md:border-b-0 md:border-r border-[var(--color-border)] flex-shrink-0">
                    <InteractiveMap 
                        places={myCourseItems} 
                        showPath={true} 
                        center={myCourseItems.length > 0 ? { lat: myCourseItems[0].lat, lng: myCourseItems[0].lng } : undefined}
                    />
                    <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-10 bg-surface/95 backdrop-blur px-3 py-1.5 rounded-pill shadow-md border border-[var(--color-border)]">
                        <span className="text-xs font-semibold tracking-wide text-lime-500 flex items-center gap-1.5">
                            <Sparkles size={10} className="lg:w-3 lg:h-3" /> My Course Preview
                        </span>
                    </div>
                </div>

                {/* 2. Scrollable Dashboard Area */}
                <div className="w-full md:w-[45%] h-[50vh] md:h-full flex flex-col bg-surface relative overflow-y-auto custom-scrollbar pb-24 md:pb-20">
                    
                    {/* Activity Dashboard */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <UserIcon size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> Activity Dashboard
                        </h3>
                        <div className="grid grid-cols-3 gap-2 lg:gap-3">
                            <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                                <Heart size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-red-500"/>
                                <div className="text-2xl font-extrabold text-foreground">{myPageInfo?.likeCount || 0}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">찜한 팝업</div>
                            </div>
                            <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                                <Ticket size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-lime-500"/>
                                <div className="text-2xl font-extrabold text-foreground">{myPageInfo?.stampCount || 0}<span className="text-sm text-muted-foreground font-normal">/12</span></div>
                                <div className="text-xs text-muted-foreground mt-0.5">획득 스탬프</div>
                            </div>
                            <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                                <MessageCircle size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-green-500"/>
                                <div className="text-2xl font-extrabold text-foreground">{myPageInfo?.reviewCount || 0}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">리뷰/톡</div>
                            </div>
                        </div>
                    </div>

                    {/* 등급 진열 카드 — 스탬프 누적량에 따른 등급 + 다음 단계 진행도 */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <Star size={16} className="lg:w-[18px] lg:h-[18px] text-amber-500" /> 내 등급
                        </h3>
                        <RankCard
                            stampCount={myPageInfo?.stampCount || 0}
                            nickname={user?.nickname}
                            onSeeAll={() => handleTabChange("PASSPORT")}
                        />
                    </div>

                    {/* 옛 inventory 컨테이너 — 보존 (혹시 후속 카드 추가 시 재사용) */}
                    <div className="hidden">
                    </div>

                    {/* Wishlist */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <Heart size={16} className="lg:w-[18px] lg:h-[18px] text-hot-400"/> Wishlist
                        </h3>
                        {myWishlist.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-[var(--color-border-strong)] rounded-md">
                                아직 찜한 팝업스토어가 없습니다.<br/>
                                마음에 드는 팝업에 하트를 눌러보세요!
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 lg:gap-3">
                                {myWishlist.map((item, i) => (
                                    <div key={i} className="relative rounded-md overflow-hidden aspect-video group cursor-pointer border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800">
                                            {item.popupImage ? (
                                                <Image
                                                    src={item.popupImage}
                                                    alt={item.popupName}
                                                    fill
                                                    sizes="(max-width: 768px) 50vw, 25vw"
                                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                    <Store size={20} className="lg:w-6 lg:h-6" />
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/30 to-transparent flex flex-col justify-end p-3">
                                                <span className="text-cream-200 text-xs font-semibold truncate">{item.popupName}</span>
                                                <span className="text-cream-200/70 text-[10px] truncate mt-0.5">{item.location}</span>
                                            </div>

                                            <button 
                                                onClick={(e) => handleRemoveWishlist(e, item.popupId)}
                                                className="absolute top-2 right-2 bg-ink-900/60 backdrop-blur rounded-pill p-1.5 text-hot-400 hover:bg-hot-400 hover:text-white transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100" 
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
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <FolderOpen size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> Saved Courses
                        </h3>
                        
                        {savedCourses.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4 text-sm">
                                아직 저장된 코스가 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {savedCourses.map((course: SavedCourse, idx: number) => (
                                    <article key={idx} className="flex items-center justify-between p-3 rounded-md border bg-cream-300 dark:bg-ink-800 border-[var(--color-border)] hover:border-lime-300/60 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                                     onClick={() => handleLoadCourse(course.courseData)}>
                                    <div className="flex items-center gap-2 lg:gap-3">
                                            <div className="w-8 h-8 rounded-pill bg-lime-300/15 flex items-center justify-center text-lime-700 dark:text-lime-300 font-bold text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-foreground">{course.courseName}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">클릭하여 불러오기</div>
                                            </div>
                                    </div>
                                    
                                    <button 
                                        onClick={(e) => handleDeleteCourse(e, course.id)}
                                        className="p-2 text-muted-foreground hover:text-danger transition-colors rounded-pill hover:bg-hot-400/10"
                                        title="삭제하기"
                                    >
                                        <Trash2 size={14} className="lg:w-4 lg:h-4"/>
                                    </button>
                                    </article>
                                ))}
                                {user && !user.isPremium && savedCourses.length >= 1 && (
                                    <div className="mt-2 text-xs text-center text-danger bg-hot-400/10 border border-hot-400/20 p-2 rounded-md">
                                        안내: 무료 회원은 코스를 1개만 저장할 수 있습니다.<br className="hidden md:block"/>새로 저장하면 이 코스는 삭제됩니다.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Current Editing Course (DND) */}
                    <div className="p-4 lg:p-6">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <Route size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> Current Plan
                        </h3>
                        
                        {myCourseItems.length === 0 && (
                            <div className="text-center text-muted-foreground py-6 border border-dashed border-[var(--color-border-strong)] rounded-md mb-4 text-sm">
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
                                                aria-label="장소 제거"
                                                onClick={() => {
                                                    const newItems = myCourseItems.filter(i => i.id !== place.id);
                                                    setMyCourseItems(newItems);
                                                }}
                                                className="absolute -top-2 -right-2 bg-hot-400 text-white p-1 rounded-pill opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
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
                            className="w-full py-3 mt-4 border border-dashed border-[var(--color-border-strong)] rounded-md text-muted-foreground hover:border-lime-500 hover:text-lime-500 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                        >
                            <PlusCircle size={14} className="lg:w-4 lg:h-4"/> 장소 추가하기
                        </button>

                        <button onClick={handleSaveCourse} className="w-full py-3 lg:py-4 mt-4 bg-ink-900 hover:bg-ink-700 text-cream-200 font-semibold rounded-pill shadow-md transition-colors active:scale-[0.98] flex items-center justify-center gap-2 dark:bg-cream-200 dark:text-ink-900 dark:hover:bg-cream-300 text-sm lg:text-base">
                            <Save size={14} className="lg:w-[18px] lg:h-[18px]"/> <span>현재 코스 저장하기</span>
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAddPlaceOpen && (
                            <motion.div 
                                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                                className="absolute inset-0 bg-surface z-50 flex flex-col"
                            >
                                <header className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-foreground">장소 추가하기</h3>
                                    <button onClick={() => setIsAddPlaceOpen(false)} aria-label="닫기" className="size-9 inline-flex items-center justify-center bg-cream-300 dark:bg-ink-700 rounded-pill hover:bg-cream-400 dark:hover:bg-ink-600 transition-colors">
                                        <X size={16} className="lg:w-5 lg:h-5"/>
                                    </button>
                                </header>
                                <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar">
                                    {allPopups.map((popup) => (
                                        <div key={popup.id} onClick={() => handleAddPlace(popup)} 
                                             className="flex justify-between items-center p-3 mb-2 border border-[var(--color-border)] rounded-md cursor-pointer hover:bg-cream-300 dark:hover:bg-ink-800 hover:border-lime-300/60 hover:scale-[1.01] active:scale-[0.99] transition-all">
                                            <div>
                                                <h4 className="font-semibold text-sm text-foreground">{popup.name}</h4>
                                                <p className="text-xs text-muted-foreground mt-0.5">{popup.location}</p>
                                            </div>
                                            <PlusCircle size={18} className="text-lime-500" />
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
                        className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 relative overflow-hidden shadow-md">
                {user && <MateBoard user={user} />}
            </motion.section>
        )}

      </div>

      <Footer />

      {/* Navigation Dock */}
      <BottomDock currentTab={currentTab as DockTab} onTabChange={(t) => handleTabChange(t)} />

      {/* Modals — 새 Dialog 컴포넌트(Radix) 사용. 포커스 트랩·ESC·스크롤 잠금 자동. */}
      <AllTrendingModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        popups={allPopups}
      />
      <ReportPopupModal
        open={isReportPopupOpen}
        onOpenChange={setIsReportPopupOpen}
        user={user}
      />
      <PopupCalendarModal
        open={isCalendarOpen}
        onOpenChange={setIsCalendarOpen}
        popups={allPopups}
      />

      {/* AI Report — 기존 컴포넌트는 자체 모달 구조 유지 */}
      <AnimatePresence>
        {isReportOpen && congestionData && (
          <AIReportModal
            data={congestionData}
            onClose={() => setIsReportOpen(false)}
          />
        )}
      </AnimatePresence>

    </main>
  );
}
