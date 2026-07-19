"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { 
  Search, MapPin, ArrowUpRight, Flame, Calendar, Menu, Users,
  Instagram, Plus, X, ArrowUp, ArrowDown, Minus,
  Map as MapIcon, Route, Ticket, User as UserIcon, LogOut, Sparkles, Lock, ArrowRight, Loader2, RefreshCw,
  Shirt, Video, ShoppingBag, Crown, GripVertical, PlusCircle, Zap, MessageCircle, Heart, Star, Gift,
  FolderOpen, Save, Trash2, ShieldCheck, ChevronLeft, ChevronRight, Camera, Coffee, Clock
} from "lucide-react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { popupCoverUrl } from "@/lib/popupCover";

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
import LoopingBgVideo from "@/components/LoopingBgVideo";
import { notify, notifySuccess, notifyError, notifyWarning, confirmAction } from "@/lib/notify";
import {
  getGuestFirstVisit,
  getRemainingGuestDays,
  isGuestExpired,
  startGuestMode,
} from "@/lib/guestMode";
import { SearchZone } from "@/features/popup/SearchBox";
import { SectionLogo } from "@/components/layout/BrandLogos";
import { ReportPopupModal } from "@/features/popup/ReportPopupModal";
import { PopupCalendarModal } from "@/features/popup/PopupCalendarModal";
import { AllTrendingModal } from "@/features/popup/AllTrendingModal";
import { AddPlaceModal } from "@/features/popup/AddPlaceModal";
import {
  GlobalSearchModal,
  useGlobalSearchHotkey,
} from "@/features/popup/GlobalSearchModal";
import { OnboardingModal } from "@/features/onboarding/OnboardingModal";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { TermsReconsentModal } from "@/features/terms/TermsReconsentModal";
import { MyFeedbackList } from "@/features/feedback/MyFeedbackList";
import { FeedbackForm } from "@/features/feedback/FeedbackForm";
import { ProfileEditModal } from "@/features/profile/ProfileEditModal";
import BrowseSection from "@/components/main/BrowseSection";
import { PopupCard } from "@/components/main/PopupCard";
import { devMockPopups } from "@/lib/devMockPopups";
import FeatureSections from "@/components/main/FeatureSections";
import HomeBento1a from "@/components/main/HomeBento1a";
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
/* 탭 접근 정책 — 한 곳에서 관리해 게이트 / sessionStorage 복원 / ?tab= 쿼리 어디서든   */
/* 동일 규칙이 적용된다.                                                          */
/*                                                                            */
/*  - 로그인 사용자 : 모든 탭                                                    */
/*  - 게스트 활성  : v2.13.1 부터 모든 탭 통과 — "7일 동안 전체 기능 둘러보기"        */
/*                  의 약속을 실제로 지키기 위함. 만료 후엔 회원가입 유도            */
/*  - 비로그인+비게스트 : MAP / PASSPORT / MY / FEEDBACK 만 통과                  */
/* -------------------------------------------------------------------------- */
const DEFAULT_TAB = "MAP";
const USER_ONLY_TABS = new Set<string>(["COURSE", "MUSIC", "MATE"]);

/** 현재 세션에서 해당 탭에 진입할 수 있는가. */
function canAccessTab(tab: string, hasUser: boolean, isGuestActive: boolean): boolean {
  if (hasUser) return true;
  if (isGuestActive) return true; // 게스트는 7일 동안 모든 탭 자유 이용
  return !USER_ONLY_TABS.has(tab);
}

/** USER_ONLY 탭을 게스트 만료 / 비로그인 사용자가 노크했을 때 보여줄 안내 문구. */
function userOnlyTabHint(tab: string): string {
  if (tab === "COURSE") return "AI 코스 추천은 가입 후 이용해주세요.";
  if (tab === "MUSIC") return "음악 추천은 가입 후 이용해주세요.";
  if (tab === "MATE") return "메이트 기능은 가입 후 이용해주세요.";
  return "가입 후 이용해주세요.";
}

/* -------------------------------------------------------------------------- */
/* Main Page Component                                                        */
/* -------------------------------------------------------------------------- */
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 모드별 풀 배경 영상: 라이트=밝은 스카이라인(212404), 다크=생기있는 서울 야경(login-bg).
  // resolvedTheme 은 마운트 후에야 확정되므로 gate 로 SSR 불일치/깜빡임 방지(마운트 전엔 브랜드 단색만).
  const { resolvedTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => setThemeReady(true), []);
  // 라이트=매끄러운 루프(부메랑)로 재인코딩한 밝은 스카이라인(light-bg), 다크=서울 야경(login-bg).
  const bgVideoSrc = resolvedTheme === "dark" ? "/login-bg.mp4" : "/light-bg.mp4";
  // 라이트 영상은 도심 불빛 반짝임이 커서 0.5배속으로 차분하게. 다크(야경)는 원속도 유지.
  const bgVideoRate = resolvedTheme === "dark" ? 1 : 0.5;

  const [hotPopups, setHotPopups] = useState<PopupStore[]>([]);
  const [allPopups, setAllPopups] = useState<PopupStore[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  useGlobalSearchHotkey(setIsGlobalSearchOpen);

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
  /** 게스트 모드 활성 시 남은 일수. null = 비활성 (로그인 사용자거나 게스트 미시작). */
  const [guestRemainingDays, setGuestRemainingDays] = useState<number | null>(null);
  /** 서치존에서 팝업 선택 시 지도를 그 위치로 이동시킬 좌표. */
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  // 검색 결과 선택 시 지도가 그 팝업 마커로 이동하도록 신호(nonce 로 재검색도 매번 반응).
  const [searchFocus, setSearchFocus] = useState<{ id: string; nonce: number } | null>(null);
  // AI 검색 결과 id 목록 — 지도에 이 핀들만 표시(null=전체). 서치존의 'AI로 찾기'가 세팅.
  const [mapFilterIds, setMapFilterIds] = useState<string[] | null>(null);

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
          notifyWarning('먼저 AI 추천 코스를 생성해주세요.');
          return;
      }
      setMyCourseItems([...aiCourse]);
      handleTabChange("MY");
      notifySuccess('AI 추천 코스가 적용되었습니다.');
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
          notify('이미 코스에 추가된 장소입니다.');
          return;
      }
      setMyCourseItems([...myCourseItems, newItem]);
      setIsAddPlaceOpen(false); 
  };

  const handleCreateRoom = async () => {
    if (!user) {
        if (await confirmAction({
            title: '로그인이 필요합니다',
            text: '작전 회의실은 회원 전용 기능입니다.',
            confirmText: '로그인하기',
        })) {
            router.push("/login");
        }
        return;
    }
    try {
        const res = await apiFetch('/api/planning/create', { method: 'POST' });
        const roomId = await res.text();
        router.push(`/planning?room=${roomId}`);
    } catch (e) {
        notifyError('서버 연결 실패!');
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
          // [redesign/test 전용] 로컬(백엔드 없음)에서 '기록' 대시보드를 채우는 목업.
          if (process.env.NODE_ENV === "development") {
              setMyPageInfo({ likeCount: 12, stampCount: 5, reviewCount: 24, isPremium: false } as MyPageData);
          }
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
    } catch (e) {
        console.error("위시리스트 로드 실패:", e);
        // [redesign/test 전용] 로컬에서 찜한 팝업 카드를 채우는 목업.
        if (process.env.NODE_ENV === "development") {
            const { devMockPopups } = await import("@/lib/devMockPopups");
            setMyWishlist(
                devMockPopups().slice(0, 12).map((p) => ({
                    popupId: Number(p.id),
                    popupName: p.name,
                    location: p.location,
                    popupImage: p.imageUrl,
                } as WishlistItem)),
            );
        }
    }
  };

  const handleRemoveWishlist = async (e: React.MouseEvent, popupId: number) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return;
    const confirmed = await confirmAction({
        title: '찜 삭제',
        text: '목록에서 삭제하시겠습니까?',
        destructive: true,
    });
    if (!confirmed) return;
    try {
        const res = await apiFetch(`/api/wishlist/${user.userId}/${popupId}`, { method: "DELETE" });
        if (res.ok) {
            setMyWishlist(prev => prev.filter(item => item.popupId !== popupId));
            fetchMyPageData(user.userId);
            notifySuccess('삭제되었습니다.');
        }
    } catch (e) { console.error("찜 삭제 오류:", e); }
  };

  const handleLoadCourse = async (courseDataStr: string) => {
      const confirmed = await confirmAction({
          title: '코스 불러오기',
          text: '현재 편집 중인 내용은 사라집니다. 계속할까요?',
          icon: 'warning',
      });
      if (!confirmed) return;
      setMyCourseItems(JSON.parse(courseDataStr));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
      e.stopPropagation();
      const confirmed = await confirmAction({
          title: '코스 삭제',
          text: '정말 삭제하시겠습니까?',
          destructive: true,
      });
      if (!confirmed) return;
      try {
          const res = await apiFetch(`/api/my-courses/${courseId}`, { method: 'DELETE' });
          if (res.ok) {
              notifySuccess('삭제 완료');
              if (user) fetchMyCourses(user.userId);
          }
      } catch (err) { console.error(err); }
  };

  /**
   * USER_ONLY 탭을 게스트 만료 / 비로그인 사용자가 누르면 안내. v2.13.1 부터 게스트 활성 상태는
   * 모든 탭이 통과하므로 이 핸들러에 도달하지 않는다 (canAccessTab 단계에서 컷). 만료된 게스트는
   * 회원가입, 처음 보는 사용자는 로그인 유도.
   */
  const promptUpgradeOrLogin = async (tab: string) => {
    const guestExpiredOrInactive = !user; // canAccessTab 에서 hasUser=false 인 경우만 도달
    if (guestExpiredOrInactive) {
        if (await confirmAction({
            title: '회원 전용 기능',
            text: userOnlyTabHint(tab),
            confirmText: '회원가입',
        })) {
            router.push("/signup");
        }
        return;
    }
    if (await confirmAction({
        title: '로그인이 필요합니다',
        confirmText: '로그인',
    })) {
        router.push("/login");
    }
  };

  const handleTabChange = async (tab: string) => {
    const isGuestActive = guestRemainingDays != null && guestRemainingDays > 0;
    if (!canAccessTab(tab, !!user, isGuestActive)) {
        await promptUpgradeOrLogin(tab);
        return;
    }
    setCurrentTab(tab);
    sessionStorage.setItem("lastTab", tab);
    // 탭 전환 시 항상 상단부터 보이게 (아래로 스크롤한 상태에서 여권/동행 등을 누르면
    // 스크롤 위치가 유지돼 새 탭의 하단이 먼저 보이던 문제 수정).
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });

    if (tab === "MY" && user) {
        fetchMyPageData(user.userId);
        fetchMyCourses(user.userId);
        fetchWishlist(user.userId);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("aiCourseData");
    setUser(null);
    await notifySuccess('로그아웃 되었습니다.');
    window.location.reload();
  };

  /**
   * v2.17 — 회원 탈퇴. PIPA § 17 에 따라 사용자가 직접 자기 정보를 삭제할 권리 보장.
   *
   * 2 단계 확인:
   *  1. "정말 탈퇴할까요?" (destructive 확인)
   *  2. "되돌릴 수 없습니다 — 한 번 더 확인" (최종 확인)
   * 백엔드 DELETE /api/v1/users/me 호출 → 식별 정보 즉시 익명화 → 로그아웃 → 메인.
   */
  const handleDeleteAccount = async () => {
    if (!user) return;
    const firstOk = await confirmAction({
      title: "정말 탈퇴하시겠어요?",
      text:
        "탈퇴하면 본인 식별 정보 (이메일 / 닉네임 / 프로필 사진 / 휴대전화) 가 즉시 익명화되며 " +
        "다시는 같은 계정으로 로그인할 수 없습니다.",
      icon: "warning",
      destructive: true,
      confirmText: "다음 단계",
    });
    if (!firstOk) return;
    const finalOk = await confirmAction({
      title: "마지막 확인",
      text: "되돌릴 수 없습니다. 정말 탈퇴를 진행할까요?",
      icon: "warning",
      destructive: true,
      confirmText: "탈퇴 진행",
    });
    if (!finalOk) return;

    try {
      const res = await apiFetch("/api/v1/users/me", { method: "DELETE" });
      if (!res.ok) {
        const message = await res.text();
        notifyError(message || "탈퇴 처리에 실패했습니다.");
        return;
      }
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      sessionStorage.clear();
      setUser(null);
      await notifySuccess("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
      router.replace("/login");
    } catch {
      notifyError("탈퇴 처리 중 오류가 발생했습니다.");
    }
  };

  const handleAiRecommend = async (vibe: string) => {
    if (!vibe.trim()) {
      notify('분위기를 입력해주세요.');
      return;
    }
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
      // [redesign/test 전용] 백엔드 없을 때(로컬) 동선 지도·저장 버튼을 미리볼 수 있도록 목업 코스로 폴백.
      if (process.env.NODE_ENV === "development") {
        const { devMockCourse } = await import("@/lib/devMockPopups");
        const mock = devMockCourse(vibe);
        setAiCourse(mock);
        sessionStorage.setItem("aiCourseData", JSON.stringify({ vibe, course: mock }));
      } else {
        notifyError('AI 연결 실패');
      }
    } finally { setIsAiLoading(false); }
  };

  const handleResetCourse = () => {
    setAiCourse([]);
    setSelectedVibe("");
    sessionStorage.removeItem("aiCourseData");
  };

  /** AI 추천 코스(aiCourse)를 마이페이지에 저장. */
  const handleSaveAiCourse = async () => {
    if (aiCourse.length === 0) {
      notifyWarning('먼저 코스를 추천받아주세요.');
      return;
    }
    if (!user) {
      notify('로그인이 필요합니다.');
      router.push('/login');
      return;
    }
    try {
      const res = await apiFetch('/api/my-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          courseName: `${selectedVibe || '나만의'} 코스 (${new Date().toLocaleDateString()})`,
          courseData: JSON.stringify(aiCourse),
        }),
      });
      if (res.ok) {
        notifySuccess('코스가 마이페이지에 저장되었어요.');
        setMyCourseItems(aiCourse);
        fetchMyCourses(user.userId);
      } else {
        notifyError('저장 실패: 서버 오류가 발생했습니다.');
      }
    } catch {
      notifyError('저장 중 오류가 발생했습니다.');
    }
  };

  /** 이 코스를 작전지도(협업)로 넘겨 함께 편집. 방 접속 후 planningSeedCourse 를 마커로 시드(백엔드 필요). */
  const handleOpenCourseInPlanning = () => {
    if (aiCourse.length === 0) {
      notifyWarning('먼저 코스를 추천받아주세요.');
      return;
    }
    sessionStorage.setItem('planningSeedCourse', JSON.stringify(aiCourse));
    handleCreateRoom();
  };

  const handleSaveCourse = async () => {
    if (!user) {
      notify('로그인이 필요합니다.');
      return;
    }

    // v2.12: 모든 사용자가 코스를 무제한으로 저장 가능. 이전의 freemium 1개 제한은 폐지.

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
            notifySuccess('코스가 저장되었습니다.');
            fetchMyCourses(user.userId);
        } else {
            notifyError('저장 실패: 서버 오류가 발생했습니다.');
        }
    } catch (e) {
        notifyError('저장 중 오류가 발생했습니다.');
    }
  };

  const handleOpenModal = () => setIsModalOpen(true);

  const handleMarkerClickToDetail = (popupId: number | string) => {
      router.push(`/popup/${popupId}`);
  };

  /*
   * 보안 (v2.7): 옛 OAuth 흐름은 토큰뿐 아니라 isPremium / role / userId / nickname 까지 URL 쿼리에
   * 그대로 박아 보냈다. 클라이언트가 그 값을 받아 localStorage 에 저장 → role/isPremium 위조 위험 (IDOR
   * / 권한 상승). 현재 정식 OAuth 진입점은 {@code /oauth/callback} 이고, 그 페이지는 토큰만 받아
   * {@code GET /api/v1/auth/me} 로 서버에서 user 정보를 가져온다. 따라서 메인 페이지의 URL 신뢰
   * 코드는 dead-code 이자 보안 hole 이므로 통째로 제거했다.
   */

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
        .catch(err => {
            console.error("팝업 데이터 로딩 실패:", err);
            // [redesign/test 전용] 로컬(백엔드 없음)에서 재설계 홈을 채우는 개발용 목업.
            if (process.env.NODE_ENV === "development") {
                const mock = devMockPopups();
                setAllPopups(mock);
                setHotPopups(mock.slice(0, 8));
            }
        });

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

  /*
   * 메인 진입 게이트 (v2.7 재설계 → v2.13.1 mount-once 분리):
   *  - 로그인 사용자             → 통과
   *  - 게스트 활성 (시작 + 미만료) → 통과 + D-N 1회 계산
   *  - 게스트 만료              → /signup?reason=guest_expired
   *  - 게스트 미시작 + 비로그인    → /login
   *
   * v2.13.1: 이 effect 가 [searchParams, router] 를 deps 로 갖고 있어서 BottomDock 탭
   * 클릭이 router.replace 등을 유발할 때마다 게스트 D-N 이 다시 계산되어 사용자가 "매번
   * 새로 시작되는 듯한" 인상을 받았다. 진짜 startGuestMode 가 호출되는 것은 아니지만
   * setGuestRemainingDays 가 매번 호출되며 잔여일 표시가 깜빡일 수 있음. 인증/게스트
   * 초기화는 mount 시점 1회만 수행하도록 분리한다.
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      const firstVisit = getGuestFirstVisit();
      if (firstVisit == null) {
        // 첫 방문자도 로그인 없이 홈을 바로 보게 게스트 세션을 자동 시작한다.
        //
        // 이전엔 여기서 /login 으로 튕겼는데, 그 결과 검색·SEO 로 들어온 방문자가 서비스를
        // 구경도 못 하고 이탈했다(방문 로그에 `/` → `/login` 2회만 찍힌 세션이 다수).
        // 로그인은 저장·찜·채팅처럼 계정이 꼭 필요한 순간에 각 기능에서 유도한다.
        startGuestMode();
        setGuestRemainingDays(getRemainingGuestDays());
        return;
      }
      if (isGuestExpired(firstVisit)) {
        router.replace("/signup?reason=guest_expired");
        return;
      }
      setGuestRemainingDays(getRemainingGuestDays(firstVisit));
    } else {
      setGuestRemainingDays(null);
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
    // 의도적으로 mount 시점 1회만 — deps 비움. router 는 stable ref 라 누락해도 안전하지만,
    // ESLint 가 경고하면 inline 주석으로 의도 명시.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ?tab= 쿼리 또는 sessionStorage 의 lastTab 으로 초기 탭 복원. searchParams 변경 시마다
   * 다시 실행되지만 게스트/유저 상태에는 영향 없음 — setCurrentTab 한 번만 호출.
   */
  useEffect(() => {
    const hasUser = !!localStorage.getItem("user");
    const firstVisit = getGuestFirstVisit();
    const isGuestActive = firstVisit != null && !isGuestExpired(firstVisit);

    const tabParam = searchParams.get("tab");
    if (tabParam) {
      const requested = tabParam.toUpperCase();
      setCurrentTab(canAccessTab(requested, hasUser, isGuestActive) ? requested : DEFAULT_TAB);
      return;
    }
    const lastTab = sessionStorage.getItem("lastTab");
    if (lastTab) {
      setCurrentTab(canAccessTab(lastTab, hasUser, isGuestActive) ? lastTab : DEFAULT_TAB);
    }
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
    <main className="min-h-screen font-sans relative pb-32 lg:pb-16 overflow-x-hidden transition-colors duration-500 text-gray-900 dark:text-white">

      {/* 모드별 풀 배경 영상 — 라이트=밝은 스카이라인(212404), 다크=생기있는 서울 야경(login-bg).
          영상이 '실제로 보이도록' 스크림은 얕게(home-video-scrim). 콘텐츠는 불투명 카드 위라 가독성은 카드가 담당.
          마운트 전엔 브랜드 단색(cream/ink)만 → 깜빡임 없이 영상 페이드 인. 활성 모드 영상 한 개만 로드. */}
      <div className="fixed inset-0 -z-10 bg-cream-100 dark:bg-ink-900 overflow-hidden" aria-hidden>
        {themeReady && (
          <LoopingBgVideo key={bgVideoSrc} src={bgVideoSrc} rate={bgVideoRate} />
        )}
        <div className="home-video-scrim absolute inset-0"></div>
      </div>

      <div className="relative z-10 px-4 md:px-6 py-4 md:py-6 max-w-[1600px] mx-auto">
        
        <Header
          user={user}
          onLogout={handleLogout}
          onLogoClick={() => handleTabChange("MAP")}
          onReportClick={() => setIsReportPopupOpen(true)}
          onProfileClick={user ? () => setIsProfileEditOpen(true) : undefined}
          onSearchClick={() => setIsGlobalSearchOpen(true)}
          onBellClick={() => setIsNotificationsOpen(true)}
          activeTab={currentTab}
          onNavChange={(t) => handleTabChange(t)}
          className="mb-4 md:mb-6"
        />

        {/*
         * 게스트 D-N 안내 — 로그인 안 한 게스트 사용자에게 잔여일을 상시 노출.
         * "로그인하면 영구로 쓸 수 있어요" CTA 를 같이 제공해 자연스러운 가입 유도.
         * 만료 시점에는 mount useEffect 가 이미 /signup 으로 redirect 했으므로 여기서는 D-1 까지만 노출된다.
         */}
        {guestRemainingDays != null && (
          <div className="mb-4 md:mb-6 flex items-center justify-between gap-3 rounded-pill bg-lime-300/85 px-4 py-2 text-ink-900 ring-1 ring-ink-900/10 shadow-sm dark:bg-lime-400/95">
            <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold">
              <Clock className="size-3.5 md:size-4" aria-hidden />
              게스트 모드 · D-{guestRemainingDays}
            </span>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              className="text-[11px] md:text-xs font-semibold underline-offset-2 hover:underline"
            >
              지금 가입하기
            </button>
          </div>
        )}

        {/* TAB: MAP */}
        {currentTab === "MAP" && (
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
                
                {/* User Greeting Section */}
                <section aria-label="Welcome Banner" className="mb-6">
                    {user ? (
                        <div className="w-full border rounded-xl p-5 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200">
                             <div className="relative z-10 text-center md:text-left">
                                <h2 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">반가워요, <span className="text-lime-300 dark:text-lime-700">{user.nickname}</span>님!</h2>
                                <p className="text-xs md:text-base opacity-70">오늘 서울에 <span className="font-bold text-lime-400 dark:text-lime-700">{allPopups.length}개</span>의 팝업이 열려있어요.</p>
                             </div>
                             <button onClick={() => handleTabChange("PASSPORT")} className="relative z-10 w-full md:w-auto inline-flex px-5 py-3 bg-lime-300 hover:bg-lime-400 text-ink-900 font-semibold rounded-pill items-center justify-center gap-2 transition-colors text-sm md:text-base">
                                <Ticket size={18}/> 내 여권 확인
                             </button>
                        </div>
                    ) : (
                        <div className="relative w-full overflow-hidden rounded-2xl border p-6 md:p-8 bg-white border-gray-200 dark:bg-[#1c1c1e] dark:border-white/10">
                            {/* 은은한 라임 글로우 — 칙칙함 대신 활력. 밝지만 텍스트 대비는 유지. */}
                            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-lime-300/35 blur-3xl dark:bg-lime-400/20" />
                            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                <div className="text-center md:text-left">
                                    <span className="inline-block mb-3 rounded-pill bg-lime-300 px-3 py-1 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase text-ink-900">
                                        오늘의 서울 팝업
                                    </span>
                                    <h2 className="text-2xl md:text-4xl font-black leading-tight text-gray-900 dark:text-white">
                                        지금 서울에{" "}
                                        <span className="text-lime-600 dark:text-lime-300">{allPopups.length || "…"}개</span>의<br className="hidden md:block"/>{" "}
                                        팝업이 열렸어요
                                    </h2>
                                    <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-white/70">
                                        지도에서 사진으로 훑어보고, 마음에 드는 팝업을 저장하세요.
                                    </p>
                                    <div className="mt-5 flex flex-col sm:flex-row gap-2.5 justify-center md:justify-start">
                                        <button
                                            type="button"
                                            onClick={() => document.querySelector('[aria-label="서울 팝업 지도"]')?.scrollIntoView({ behavior: "smooth", block: "start" })}
                                            className="inline-flex items-center justify-center gap-2 rounded-pill bg-lime-300 px-6 py-3 text-sm md:text-base font-bold text-ink-900 transition hover:bg-lime-400"
                                        >
                                            지도에서 둘러보기 <ArrowRight size={16} />
                                        </button>
                                        <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-pill border border-gray-300 bg-white px-6 py-3 text-sm md:text-base font-bold text-gray-900 transition hover:bg-gray-100 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                                            회원가입
                                        </Link>
                                    </div>
                                </div>

                                {/* 팝업 사진 클러스터 — 들어오자마자 '볼 게 많다'는 첫인상 훅. 클릭 시 상세로. */}
                                {hotPopups.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 shrink-0 md:w-[280px]">
                                        {hotPopups.slice(0, 4).map((p, i) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => { handleTabChange("MAP"); router.push(`/popup/${p.id}`); }}
                                                aria-label={`${p.name} 상세 보기`}
                                                className={`aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10 transition hover:-translate-y-0.5 hover:shadow-lg ${i % 2 === 1 ? "sm:translate-y-3" : ""}`}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={popupCoverUrl(p, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* 지역 / 시점 / 카테고리 빠른 필터 (지도 위 진입점) */}
                <BrowseSection />

                {/* 서울 팝업 지도 — 홈의 주인공 (디자인 진단서 P0). 지도 전체폭·크게, 보조 정보는 아래 3열. */}
                <section aria-label="서울 팝업 지도" className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-10">
                    
                    {/* Search Zone */}
                    <div className="col-span-1 lg:col-span-12 relative z-50 order-1 lg:order-none">
                        <SearchZone
                            popups={allPopups}
                            onSelectPopup={(hit) => {
                                // AI 필터가 걸려 있으면 해제 — 그래야 고른 핀이 지도에 보인다.
                                setMapFilterIds(null);
                                // 1순위: 지도가 자기 마커에서 그 팝업을 찾아 이동+정보창 오픈(allPopups 의존 X).
                                setSearchFocus((prev) => ({ id: String(hit.objectID), nonce: (prev?.nonce ?? 0) + 1 }));
                                // 2순위(보조): allPopups 에 좌표가 있으면 중심도 같이 이동(마커가 아직 안 실렸을 때 대비).
                                const p = allPopups.find((x) => String(x.id) === String(hit.objectID));
                                if (p?.latitude && p?.longitude) {
                                    setMapCenter({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) });
                                }
                            }}
                            onAiFilter={(ids) => {
                                // AI 검색 결과 id → 지도에 그 핀만. null 이면 전체 복원.
                                setMapFilterIds(ids);
                                if (ids && typeof document !== "undefined") {
                                    document
                                        .querySelector('[aria-label="서울 팝업 지도"]')
                                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }
                            }}
                        />
                    </div>
                    
                    {/* Map Zone — 배경 분리를 위해 solid 배경 + shadow 로 카드 블록 강화. */}
                    <div className="col-span-1 lg:col-span-12 rounded-[2rem] relative overflow-hidden border border-gray-200 dark:border-white/10 group bg-white dark:bg-[#111] shadow-lg shadow-black/5 dark:shadow-black/30 h-[58vh] min-h-[420px] order-2 lg:order-none">
                        <InteractiveMap center={mapCenter} focusReq={searchFocus} onMarkerClick={handleMarkerClickToDetail} filterIds={mapFilterIds} />
                        <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex gap-2 z-20">
                            <span className="backdrop-blur px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 bg-white/80 border-gray-200 text-gray-900 dark:bg-black/60 dark:border-white/10 dark:text-white">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"/> 실시간
                            </span>
                        </div>
                    </div>

                </section>

                {/* 지도 아래 유틸리티 2열 — 실시간 혼잡도(공간) + 팝업 캘린더(시간). 각각 누르면 모달. */}
                <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* 실시간 혼잡도 */}
                    <button
                        type="button"
                        onClick={() => setIsReportOpen(true)}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm transition hover:border-primary hover:shadow-md dark:border-white/10 dark:bg-[#111]"
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-current ${congestionData ? getCongestionColor(congestionData.level) : "text-green-500"}`} aria-hidden />
                            <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">실시간 혼잡도</span>
                            {congestionData ? (
                                <span className="truncate text-sm text-gray-500 dark:text-white/60">
                                    · 성수 <span className={`font-bold ${getCongestionColor(congestionData.level)}`}>{congestionData.level}</span>
                                </span>
                            ) : (
                                <span className="hidden truncate text-sm text-gray-500 dark:text-white/60 sm:inline">· 지역별 분석</span>
                            )}
                        </div>
                        <span className="shrink-0 text-sm font-bold text-lime-600 dark:text-lime-400 group-hover:underline">지역별 보기 →</span>
                    </button>

                    {/* 팝업 캘린더 */}
                    <button
                        type="button"
                        onClick={() => setIsCalendarOpen(true)}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm transition hover:border-primary hover:shadow-md dark:border-white/10 dark:bg-[#111]"
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            <Calendar size={16} className="shrink-0 text-primary" aria-hidden />
                            <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">팝업 캘린더</span>
                            <span className="hidden truncate text-sm text-gray-500 dark:text-white/60 sm:inline">· 언제 뭐가 열리나</span>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-lime-600 dark:text-lime-400 group-hover:underline">달력 보기 →</span>
                    </button>
                </div>

                {/* 홈 하단 발견 존 — 1a안 (랭킹 히어로 + 나의 기록 + 같이 갈 사람). 혼잡도는 위 바로, 캘린더·음악은 이 존 제외. */}
                <HomeBento1a
                    popups={hotPopups}
                    total={allPopups.length}
                    onOpenRanking={handleOpenModal}
                    onNavigate={handleTabChange}
                />

                {/* 지금 뜨는 팝업 — 사진 카드 레일 (디자인 진단서 P0: 팝업 사진 카드로 코어 뷰잉 강화). */}
                <motion.section
                    aria-label="지금 뜨는 팝업"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                    variants={sectionVariants}
                    className="mb-16"
                >
                    <header className="mb-5 flex items-end justify-between gap-3">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-foreground">지금 뜨는 팝업</h2>
                            <p className="mt-1 text-xs md:text-sm text-muted-foreground">서울에서 가장 많이 찾는 팝업을 사진으로 훑어보세요.</p>
                        </div>
                        <button type="button" onClick={handleOpenModal} className="shrink-0 text-xs font-semibold text-primary hover:underline">전체 보기</button>
                    </header>
                    {hotPopups.length > 0 ? (
                        <div className="custom-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
                            {hotPopups.map((p) => (
                                <div key={p.id} className="snap-start">
                                    <PopupCard
                                        popup={p}
                                        onClick={() => { handleTabChange("MAP"); router.push(`/popup/${p.id}`); }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex gap-4 overflow-hidden">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-[320px] w-[220px] shrink-0 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
                            ))}
                        </div>
                    )}
                </motion.section>

                {/* OOTD Section */}
                <motion.section aria-label="Style Recommendation" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="mb-16">
                    <header className="flex flex-col md:flex-row items-center md:items-end justify-between mb-8 md:mb-12 text-center md:text-left">
                        <SectionLogo name="pop-look" label="POP-LOOK" className="h-10 md:h-16 relative z-10 text-foreground" />
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
                            <article className="flex-1 rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-10 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/5 flex flex-col justify-center items-start relative overflow-hidden">
                                <Shirt size={80} className="lg:w-[120px] lg:h-[120px] absolute -right-4 -bottom-4 lg:-right-6 lg:-bottom-6 text-gray-100 dark:text-white/5 rotate-[-15deg]"/>
                                <span className="text-lime-700 dark:text-lime-300 font-bold tracking-wide text-xs lg:text-sm mb-3 lg:mb-4 border border-lime-500/40 bg-lime-50 dark:bg-lime-300/10 px-2.5 py-1 lg:px-3 lg:py-1 rounded-full">오늘의 스타일</span>
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

                {/* v2.34 — 기능 소개 개별 섹션 (코스·음악·여권·동행). 각각 다른 무드+비주얼+좌우 교차. */}
                <FeatureSections onNavigate={handleTabChange} />

                {/* (구) 협업 프로모 — FeatureSections 로 대체됨(주석 유지 시 아래 미사용 블록 제거 필요) */}
                <motion.section aria-label="Feature Promotion" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="hidden py-12 px-6 lg:py-20 lg:px-12 bg-ink-900 text-cream-200 relative overflow-hidden rounded-xl lg:rounded-2xl shadow-pop">
                                        
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
                        className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 shadow-md">
              {/* 여권은 게스트/비로그인도 열람 가능(빈 여권으로). 스탬프 적립은 방문 인증 시 로그인 유도. */}
              <PassportView />
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
                <MusicTab
                    popups={allPopups}
                    onOpenPopup={(id) => { handleTabChange("MAP"); router.push(`/popup/${id}`); }}
                />
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

                                {/* 동선 지도 — 카카오맵 링크 대신 앱 안에서 경로(showPath)를 그려 보여준다. */}
                                <div className="mb-6 h-[280px] overflow-hidden rounded-2xl border border-[var(--color-border)] lg:h-[340px]">
                                    <InteractiveMap
                                        places={aiCourse}
                                        showPath
                                        center={aiCourse[0] ? { lat: aiCourse[0].lat, lng: aiCourse[0].lng } : undefined}
                                    />
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
                                
                                <div className="mt-4 flex flex-col gap-2 lg:mt-6 lg:flex-row">
                                    <button
                                        onClick={handleSaveAiCourse}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-lime-300 py-3.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-lime-400 lg:text-base"
                                    >
                                        <Ticket size={16} /> 마이페이지에 저장
                                    </button>
                                    <button
                                        onClick={handleOpenCourseInPlanning}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-pill border border-[var(--color-border-strong)] py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-foreground/5 lg:text-base"
                                    >
                                        <MapIcon size={16} /> 작전지도에서 함께 짜기
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.section>
        )}

        {/* TAB: MY */}
        {currentTab === "MY" && (
            <motion.section aria-label="내 기록" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        className="mx-auto mb-16 max-w-3xl">

                {/* '기록' 대시보드 — 개선안: 코스 지도 제거, 전체폭 세로 대시보드(프로필·통계·등급·찜·최근 방문). */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface text-surface-foreground shadow-md">

                    {/* v2.15.3 — 내 계정: 회원이름 / 이메일 / 프로필 사진 노출. 네이버/카카오/구글
                        OAuth 검수 활용처 증명에 사용되며, 사용자도 "내 정보" 를 한 눈에 확인.
                        v2.17 — 회원 탈퇴 버튼 추가 (PIPA 의무). */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <UserIcon size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> 내 계정
                        </h3>
                        <div className="flex items-center gap-4 p-3 lg:p-4 rounded-md border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800">
                            {user?.picture ? (
                                <Image
                                    src={user.picture}
                                    alt="프로필 사진"
                                    width={56}
                                    height={56}
                                    className="rounded-full object-cover w-14 h-14 border border-[var(--color-border)]"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-lime-300/20 flex items-center justify-center border border-[var(--color-border)]">
                                    <UserIcon size={24} className="text-lime-500" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm lg:text-base font-bold text-foreground truncate">
                                    {user?.nickname || "회원"}
                                </p>
                                <p className="text-xs lg:text-sm text-muted-foreground truncate mt-0.5">
                                    {user?.email || "이메일 정보 없음"}
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => handleTabChange("FEEDBACK")}
                                className="text-xs font-semibold text-lime-600 dark:text-lime-400 underline-offset-2 hover:underline transition-colors"
                            >
                                의견·문의 보내기
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAccount}
                                className="text-xs text-muted-foreground hover:text-danger underline-offset-2 hover:underline transition-colors"
                            >
                                회원 탈퇴
                            </button>
                        </div>
                    </div>

                    {/* Activity Dashboard */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <UserIcon size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> 활동 기록
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

                    {/* v2.18 — 최근 본 팝업 (localStorage 기반, 최대 10개). 게스트/회원 무관. */}
                    <RecentVisitsCard />

                    {/* 옛 inventory 컨테이너 — 보존 (혹시 후속 카드 추가 시 재사용) */}
                    <div className="hidden">
                    </div>

                    {/* Wishlist */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                            <Heart size={16} className="lg:w-[18px] lg:h-[18px] text-hot-400"/> 찜한 팝업
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
                                            <Image
                                                src={popupCoverUrl({ id: item.popupId, imageUrl: item.popupImage })}
                                                alt={item.popupName}
                                                fill
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                unoptimized
                                            />
                                            
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
                            <FolderOpen size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> 저장한 코스
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
                                {/* v2.12: 무료 회원 1개 제한 폐지 — 모든 사용자가 무제한 저장 */}
                            </div>
                        )}
                    </div>

                    {/* 내가 보낸 의견 — 최근 3건만 노출. 전체는 FEEDBACK 탭으로 이동. */}
                    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base lg:text-lg font-bold flex items-center gap-2 text-foreground">
                                <MessageCircle size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500"/> 내가 보낸 의견
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleTabChange("FEEDBACK")}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                전체 보기
                            </button>
                        </div>
                        <MyFeedbackList
                            userId={user?.userId ?? null}
                            limit={3}
                            emptyText="아직 보낸 의견이 없습니다. 자유롭게 의견을 남겨 주세요."
                        />
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

                    <AddPlaceModal
                        open={isAddPlaceOpen}
                        onClose={() => setIsAddPlaceOpen(false)}
                        popups={allPopups}
                        onSelect={handleAddPlace}
                    />
                </div>
            </motion.section>
        )}

        {/* TAB: MATE */}
        {currentTab === "MATE" && (
            <motion.section aria-label="Mate Board" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 relative overflow-hidden shadow-md">
                <MateBoard user={user} />
            </motion.section>
        )}

        {/* TAB: FEEDBACK (v2.12) — 게스트도 진입 가능. /feedback 페이지와 동일 컴포넌트 재사용. */}
        {currentTab === "FEEDBACK" && (
            <motion.section
                aria-label="Feedback"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 p-4 lg:p-6 shadow-md"
            >
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-foreground">의견 보내기</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        서비스를 쓰면서 느낀 점, 버그, 제안을 운영팀에 전달할 수 있습니다.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <div className="lg:col-span-3">
                        <div className="rounded-lg border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 p-5">
                            <h3 className="mb-4 text-base font-semibold text-foreground">새 의견</h3>
                            <FeedbackForm userId={user?.userId ?? null} />
                        </div>
                    </div>
                    <aside className="lg:col-span-2">
                        <div className="rounded-lg border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 p-5">
                            <h3 className="mb-4 text-base font-semibold text-foreground">
                                내가 보낸 의견
                            </h3>
                            <MyFeedbackList userId={user?.userId ?? null} />
                        </div>
                    </aside>
                </div>
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
      <GlobalSearchModal
        open={isGlobalSearchOpen}
        onOpenChange={setIsGlobalSearchOpen}
        popups={allPopups}
      />
      <OnboardingModal />
      <NotificationCenter
        open={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
      />
      <TermsReconsentModal enabled={!!user} onDecline={handleLogout} />
      {user && (
        <ProfileEditModal
          open={isProfileEditOpen}
          onOpenChange={setIsProfileEditOpen}
          user={user}
          onSaved={(next) => {
            const updated = {
              ...user,
              nickname: next.nickname,
              picture: next.picture ?? undefined,
            };
            setUser(updated);
            localStorage.setItem("user", JSON.stringify(updated));
          }}
        />
      )}
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

/**
 * v2.18 — 최근 본 팝업 카드. localStorage 기반이라 회원/게스트 무관 표시.
 *
 * <p>본 컴포넌트는 mount 시점에 localStorage 를 한 번만 읽어 가벼움. 다른 페이지에서 팝업 상세 진입하면
 * 자동으로 기록되고, 사용자가 MY 탭으로 돌아오면 다음 mount 에 갱신.
 */
function RecentVisitsCard() {
  const [visits, setVisits] = useState<
    Array<{ popupId: number; popupName: string; popupImage?: string }>
  >([]);

  useEffect(() => {
    import("@/lib/recentVisits")
      .then(({ readVisits }) => setVisits(readVisits()))
      .catch(() => setVisits([]));
  }, []);

  if (visits.length === 0) return null;

  return (
    <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
      <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
        <Clock size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" /> 최근 본 팝업
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {visits.slice(0, 6).map((v) => (
          <Link
            key={v.popupId}
            href={`/popup/${v.popupId}`}
            className="group block rounded-md overflow-hidden border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800 aspect-square relative"
          >
            <Image
              src={popupCoverUrl({ id: v.popupId, imageUrl: v.popupImage })}
              alt={v.popupName}
              fill
              sizes="(max-width: 768px) 33vw, 15vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/85 to-transparent p-1.5">
              <span className="text-cream-200 text-[10px] font-semibold truncate block">
                {v.popupName}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
