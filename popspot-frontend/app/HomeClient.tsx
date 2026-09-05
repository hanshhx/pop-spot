'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  MapPin,
  Flame,
  Calendar,
  Users,
  X,
  Route,
  Ticket,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  RefreshCw,
  PlusCircle,
  MessageCircle,
  Heart,
  Star,
  FolderOpen,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Camera,
  Coffee,
  Clock,
  Store,
} from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import {
  localizedLabel,
  localizedRegionLabel,
  useLocale,
  type Locale,
  type MessageKey,
} from '@/lib/i18n';
import { REGIONS, type RegionCode } from '@/lib/regions';
import { localizedPath } from '@/lib/localePath';
import { visitedAgo, type VisitedAgo } from '@/lib/visitedAgo';
import { PRIORITY_LANDING_LINKS } from '@/lib/priorityLandingLinks';

/**
 * 소개 화면에 고정으로 박혀 있는 지역명.
 *
 * <p>실제 데이터가 아니라 예시지만 표기는 지역 페이지와 같아야 한다 — 같은 동네를 한쪽은
 * {@code Seongsu}, 다른 쪽은 {@code 성수} 로 쓰면 같은 곳인지 알 수 없다.
 */
/** 홈의 지도 구획. "지도에서 둘러보기" 버튼이 이 id 로 찾아 스크롤한다. */
const HOME_MAP_ID = 'home-map';

function fixedRegionLabel(code: RegionCode, locale: Locale): string {
  const region = REGIONS.find((r) => r.code === code);
  return region ? localizedRegionLabel(region, locale) : code;
}
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { FeaturedPopupBanner } from '@/components/main/FeaturedPopupBanner';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import { useDragScroll } from '@/hooks/useDragScroll';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import InteractiveMap from '../src/components/Map/DeferredInteractiveMap';
import PassportView from '../src/components/Passport/PassportView';
import AIReportModal from '../src/components/AIReportModal';
import LiveChatTicker from '../src/components/LiveChatTicker';
import { SortableItem } from '../src/components/SortableItem';
import { apiFetch, AUTH_EXPIRED_EVENT } from '../src/lib/api';
import { clearAuthToken } from '../src/lib/authStorage';
import {
  isOpenNow,
  kstTodayStart,
  classifyCategory,
  categoryLabel,
  CATEGORIES,
  getPeriods,
  parseDate,
  type CategoryCode,
} from '../src/lib/popupSlices';
import { groupSameEvent } from '@/lib/groupSameEvent';
import { homeSurfaces } from '@/lib/homeSurfaces';
import { popAllPreviewRows } from '@/lib/popAllPreview';
import { Header } from '../src/components/layout/Header';
import { Footer } from '../src/components/layout/Footer';
import { BottomDock, type DockTab } from '../src/components/layout/BottomDock';
import { MySchedule } from '../src/features/schedule/MySchedule';
import MusicTab from '@/components/music/MusicTab';
import RankCard from '@/components/rank/RankCard';
import LoopingBgVideo from '@/components/LoopingBgVideo';
import { notify, notifySuccess, notifyError, notifyWarning, confirmAction } from '@/lib/notify';
import {
  getGuestFirstVisit,
  getRemainingGuestDays,
  isGuestExpired,
  startGuestMode,
} from '@/lib/guestMode';
import { readGuestWishlist, removeGuestWishlist } from '@/lib/guestWishlist';
import {
  GUEST_WISHLIST_MIGRATED_EVENT,
  retryGuestWishlistMigration,
} from '@/lib/migrateGuestWishlist';
import { canAccessTab } from '@/lib/tabAccess';
import {
  HOME_RETURN_STATE_KEY,
  isPopupDetailPath,
  resolveHomeReturnScroll,
  saveHomeReturnState,
} from '@/lib/homeReturnScroll';
import { SearchZone } from '@/features/popup/SearchBox';
import { SectionLogo } from '@/components/layout/BrandLogos';
import { ReportPopupModal } from '@/features/popup/ReportPopupModal';
import { PopupCalendarModal } from '@/features/popup/PopupCalendarModal';
import { PopupCalendar } from '@/features/popup/PopupCalendar';
import { AllTrendingModal } from '@/features/popup/AllTrendingModal';
import { PopAllModal } from '@/features/popup/PopAllModal';
import { AddPlaceModal } from '@/features/popup/AddPlaceModal';
import { GlobalSearchModal, useGlobalSearchHotkey } from '@/features/popup/GlobalSearchModal';
import { OnboardingModal, ONBOARDING_TRIGGER_EVENT } from '@/features/onboarding/OnboardingModal';
import { NotificationCenter } from '@/features/notifications/NotificationCenter';
import { MyFeedbackList } from '@/features/feedback/MyFeedbackList';
import { FeedbackForm } from '@/features/feedback/FeedbackForm';
import { ProfileEditModal } from '@/features/profile/ProfileEditModal';
import BrowseSection from '@/components/main/BrowseSection';
import { PopupCard } from '@/components/main/PopupCard';
import SeasonBanner from '@/components/main/SeasonBanner';
import { seasonBackground } from '@/lib/seasonVideo';
import { useSeason } from '@/lib/seasonContext';
import { devMockPopups } from '@/lib/devMockPopups';
import type { PublicMapMarker } from '@/lib/mapMarkers';
import FeatureSections from '@/components/main/FeatureSections';
import HomeBento1a from '@/components/main/HomeBento1a';
import PopAllPreview from '@/components/main/PopAllPreview';
import type {
  User,
  PopupStore,
  CongestionData,
  MyPageData,
  WishlistItem,
  CourseItem,
  SavedCourse,
} from '@/types/popup';

const INITIAL_MY_COURSE: CourseItem[] = [];
const EMPTY_POPUPS: PopupStore[] = [];

function popupToMapMarker(popup: PopupStore): PublicMapMarker {
  return {
    id: popup.id,
    name: popup.name,
    nameEn: popup.nameEn,
    nameJa: popup.nameJa,
    location: popup.location ?? null,
    locationEn: popup.locationEn,
    locationJa: popup.locationJa,
    latitude: popup.latitude ?? null,
    longitude: popup.longitude ?? null,
    category: popup.category ?? null,
    startDate: popup.startDate ?? null,
    endDate: popup.endDate ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* 탭 접근 정책 — 한 곳에서 관리해 게이트 / sessionStorage 복원 / ?tab= 쿼리 어디서든   */
/* 동일 규칙이 적용된다. 규칙 자체(USER_ONLY_TABS · canAccessTab)는 src/lib/tabAccess.ts */
/* 로 옮겼다 — 상세 페이지(PopupDetailClient)의 "AI 코스 만들기" 버튼도 같은 COURSE 탭   */
/* 접근 여부를 판정해야 하는데, 여기서만 정의하면 상세 페이지가 규칙을 베껴 두 곳이 어긋날  */
/* 위험이 생긴다.                                                                */
/* -------------------------------------------------------------------------- */
const DEFAULT_TAB = 'MAP';

/**
 * 홈이 한 번에 보여 주는 팝업 수.
 *
 * <p><b>왜 늘렸나.</b> 2026-08-05 실측 — 수집된 팝업이 1,040개인데 인기 자리에 노출되는 것은
 * 다섯이었다. 정렬을 어떻게 고치든 <b>칸이 다섯이면 다섯만 보인다.</b> 조회수 0 인 팝업이 28.4%,
 * 2회 이하가 63.5% 인 상태라 순위 알고리즘보다 노출 폭이 먼저 병목이었다.
 *
 * <p>무한정 늘리지는 않는다. 카드가 많아지면 첫 화면이 무거워지고, 아래로 갈수록 아무도 안 본다 —
 * 노출은 늘었는데 실제로 보이지는 않는 상태가 된다. 목록(RAIL)이 그 아래를 받는다.
 *
 * <p>여기서 정한 수가 <b>실제 노출 폭이 되려면 렌더 쪽에서 또 자르지 않아야 한다.</b> 예전에는 이
 * 목록을 5로 만들어 놓고 화면에서 다시 {@code slice(0, 4)} · {@code slice(1, 4)} 해서, 정작 보이는
 * 것은 넷이었다 — 목록 크기를 늘려도 화면은 그대로였을 것이다.
 *
 * <p>다만 게스트 히어로 안의 미리보기 격자만은 넷으로 남긴다. 280px 카드 안의 2×2 배치라 늘리면
 * 그 카드가 무너진다. 그 자리는 "이런 게 있다" 를 보여 주는 곳이고, 폭은 아래 추천 목록과 레일이 낸다.
 */
const HOT_POPUP_COUNT = 8;

/**
 * 게스트 히어로 2×2 미리보기 칸 수. 위 문단대로 280px 카드 안에 고정된 격자라 이 값을 늘리면
 * 카드가 무너진다. 내용은 POP-LOOK(랭킹)과 겹치지 않는 <b>마감 임박</b> — {@link homeSurfaces}
 * 가 랭킹이 먼저 가져간 곳을 뺀 나머지에서 고른다.
 */
const GUEST_HERO_COUNT = 4;

/** 목록 레일이 보여 주는 수. 카테고리·정렬을 바꿔 가며 훑는 자리라 인기 자리보다 넉넉하게. */
const RAIL_POPUP_COUNT = 30;

/** 벤토 히어로 — 850곳으로 들어가는 문 수. 격자·카드 크기가 이 값(4)에 맞춰져 있다. */

/**
 * 검색엔진과 사용자가 함께 쓰는 랜딩 디렉터리.
 *
 * <p>예전에는 같은 링크를 {@code sr-only} 영역에만 넣어 사용자에게는 숨겼다. 네이버는 숨긴 키워드
 * 묶음보다 실제로 탐색할 수 있는 표준 링크를 권장한다. 접힌 상태에서도 사용자가 직접 열 수 있는
 * {@code details} 로 바꿔 지역·일정·카테고리 페이지를 정직하게 연결한다.
 */
function SeoLandingDirectory() {
  const { locale } = useLocale();
  const periods = getPeriods();
  const title =
    locale === 'en'
      ? 'Browse pop-ups by area, date, or category'
      : locale === 'ja'
        ? 'エリア・日程・カテゴリーから探す'
        : '지역·일정·카테고리로 팝업 찾기';

  const groups = [
    { key: 'region', items: REGIONS },
    { key: 'period', items: periods },
    { key: 'category', items: CATEGORIES },
  ];

  return (
    <section className="mx-auto max-w-[1600px] px-4 md:px-6" aria-label={title}>
      {/* 카드가 아니라 푸터의 앞머리처럼 보이게 한다. 테두리·그림자·흰 배경을 빼면 본문에서
          경쟁하지 않으면서도 링크는 그대로 남아 크롤 경로가 유지된다. */}
      <details className="border-t border-[var(--color-border)] py-4 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-muted-foreground transition-colors hover:text-foreground">
          {title}
        </summary>
        <div className="mt-4 space-y-4">
          <nav className="flex flex-wrap gap-2" aria-label="priority">
            {PRIORITY_LANDING_LINKS.map((item) => (
              <Link
                key={item.slug}
                href={localizedPath(`/popups/${item.slug}`, locale)}
                className="rounded-full border border-lime-300/60 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-800 transition hover:bg-lime-100 dark:bg-lime-300/10 dark:text-lime-300"
              >
                {localizedLabel(item, locale)}
              </Link>
            ))}
          </nav>
          {groups.map((group) => (
            <nav key={group.key} className="flex flex-wrap gap-2" aria-label={group.key}>
              {group.items.map((item) => (
                <Link
                  key={item.slug}
                  href={localizedPath(`/popups/${item.slug}`, locale)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-lime-300 hover:bg-lime-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:border-lime-300/40"
                >
                  {localizedLabel(item, locale)}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </details>
    </section>
  );
}

/**
 * 홈 목록·랭킹에 지금 문이 열려 있는 팝업만 남긴다. 판정은 지도와 공유하는 {@link isOpenNow} —
 * 화면마다 날짜 해석이 다르면 "홈엔 있는데 지도엔 없는" 불일치가 생긴다(그 함수 주석에 경위).
 *
 * <p>{@code /api/map/markers} 는 만료를 걸러 주지만 {@code /api/popups} 는 그렇지 않아, 백엔드 만료
 * 스케줄러가 지연·실패하면 홈 목록·랭킹에 어제 마감된 팝업이 그대로 남는다. 화면에서 한 겹 더 막는다.
 *
 * <p>기준 시각은 KST 자정이다. 사용자의 브라우저 시간대가 어디든 "한국에서 오늘" 이 기준이어야
 * 자정 경계에서 하루가 어긋나지 않는다.
 */
function keepOpenNow(list: PopupStore[]): PopupStore[] {
  if (!Array.isArray(list)) return [];
  const today = kstTodayStart();
  return list.filter((p) => p && isOpenNow(p.startDate, p.endDate, today));
}

/**
 * 한 좌표에 이보다 많이 뭉치면 '진짜 위치가 아니라 지역 중심점(가짜 위치)' 으로 보고 지도 표시·개수·
 * 검색 이동에서 제외한다. InteractiveMap 의 같은 이름 상수와 값을 맞춘다(수백 개가 링처럼 뭉치던 문제).
 */
const FALLBACK_CLUSTER_MIN = 40;

/**
 * USER_ONLY 탭을 게스트 만료 / 비로그인 사용자가 노크했을 때 보여줄 안내 문구의 <b>키</b>.
 *
 * <p>문구가 아니라 키를 돌려주는 이유는 이 함수가 컴포넌트 밖이라 훅({@link useLocale})을 쓸 수
 * 없기 때문이다. 번역은 호출하는 쪽에서 t() 로 꺼낸다.
 */
function userOnlyTabHintKey(tab: string): MessageKey {
  if (tab === 'COURSE') return 'home.hintCourse';
  if (tab === 'MUSIC') return 'home.hintMusic';
  return 'home.hintDefault';
}

/* -------------------------------------------------------------------------- */
/* Main Page Component                                                        */
/* -------------------------------------------------------------------------- */
interface HomeProps {
  /**
   * 서버가 미리 받아 둔 팝업 목록. 실패했거나 아직 없으면 빈 배열이 온다.
   *
   * <p>이 값이 있으면 첫 렌더부터 목록이 보인다 — 예전처럼 빈 화면을 그린 뒤 마운트해서
   * 백엔드를 기다리지 않는다. 자세한 배경은 {@code app/homeData.ts} 주석에 있다.
   */
  initialPopups?: PopupStore[];
}

export default function Home({ initialPopups = EMPTY_POPUPS }: HomeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 모드별 풀 배경 영상: 라이트=밝은 스카이라인(light-bg), 다크=생기있는 서울 야경(login-bg).
  // resolvedTheme 은 마운트 후에야 확정되므로 gate 로 SSR 불일치/깜빡임 방지(마운트 전엔 브랜드 단색만).
  const { resolvedTheme } = useTheme();
  const season = useSeason();
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => setThemeReady(true), []);
  // 라이트=매끄러운 루프(부메랑)로 재인코딩한 밝은 스카이라인(light-bg), 다크=서울 야경(login-bg-v2).
  // v2 = 1080p/7.9Mbps 원본(16.3MB)을 720p/CRF28 로 재인코딩한 것(2.8MB, SSIM 0.947). 스크림 두 겹
  // 뒤에 깔리는 배경이라 체감 차이는 없고 모바일 첫 방문 전송량만 83% 줄었다. 파일명을 바꾼 건
  // 캐시에 남은 옛 16MB 파일을 확실히 버리게 하려는 것.
  //
  // 계절 영상이 들어오면 그 계절 편으로 갈아탄다. 아직 안 넣은 칸은 위 두 편으로 떨어진다 —
  // 넣는 방법과 이유는 lib/seasonVideo.ts 주석 참고.
  const {
    src: bgSrc,
    rate: bgRate,
    still: bgStill,
  } = seasonBackground(season, resolvedTheme === 'dark');

  // 화면 문구 언어. 첫 렌더는 항상 한국어이고(서버 HTML 과 맞춰 깜빡임 방지),
  // 브라우저에서 저장값·브라우저 언어를 읽어 반영한다.
  const { locale, t } = useLocale();
  const defaultCourseName =
    locale === 'en' ? 'My route' : locale === 'ja' ? 'マイコース' : '나만의 코스';

  /*
   * 서버가 준 목록으로 시작한다. 비어 있으면 예전과 같이 빈 배열에서 출발하고 아래 effect 가
   * 로컬 캐시 → 네트워크 순으로 채운다.
   *
   * keepOpenNow 를 여기서 한 번 걸어 준다 — 서버 응답에는 이미 끝난 팝업이 섞여 있을 수 있고,
   * 그것을 거르는 책임은 이 화면에 있다(클라이언트 경로도 같은 함수를 통과한다).
   */
  const [allPopups, setAllPopups] = useState<PopupStore[]>(() => keepOpenNow(initialPopups));
  /**
   * 달력 전용 — 걸러지지 않은 전체 카탈로그.
   *
   * <p>{@link keepOpenNow} 는 홈 목록·랭킹을 위해 "오늘 문이 열려 있는 것" 만 남긴다. 그건 그
   * 화면들에는 맞지만 달력에는 틀리다: 다음 주에 여는 팝업이 통째로 빠지므로 <b>오늘이 아닌
   * 날짜의 '오픈' 은 언제나 0</b> 이 되고, 다음 달로 넘기면 격자가 빈다(실측 1,167곳 중 92곳이
   * 아직 시작 전, 543곳이 이미 종료).
   *
   * <p>SSR 이 성공하면 이 값은 첫 렌더부터 완전하다. 실패했을 때만 아래 효과가 채우는데, 그
   * 경로의 localStorage 캐시는 이미 걸러진 목록이라 네트워크 응답이 올 때까지는 달력도 걸러진
   * 상태다 — 비어 보이는 것보다 낫고, 응답이 오면 온전해진다.
   */
  const [catalogPopups, setCatalogPopups] = useState<PopupStore[]>(initialPopups);
  const initialMapMarkers = useMemo(() => initialPopups.map(popupToMapMarker), [initialPopups]);
  /*
   * 레일 정렬/필터. 전체(allPopups)에서 파생한다.
   *
   * 기본값은 최신순이다 — 예전엔 인기순이 기본이라 이 30칸의 상위 8곳이 POP-LOOK·벤토와
   * 그대로 겹쳤다(같은 viewCount desc). 칩은 그대로 셋 다 남아 있어 인기순으로 되돌릴 수
   * 있다. 왜 '지금 뜨는' 이라는 이름을 쓰지 않는지는 section.trending 자리를 보라 — 진짜
   * 트렌딩 신호(visit_event)는 아직 공개 API가 없다.
   */
  const [railSort, setRailSort] = useState<'popular' | 'deadline' | 'latest'>('latest');
  const [railCat, setRailCat] = useState<CategoryCode | 'all'>('all');
  /* 계절 한정 필터 — 계절에만 존재하는 칩이다. 없던 버튼이 생기는 것이 색보다 세게 걸린다. */
  const rail = useDragScroll<HTMLDivElement>();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  useGlobalSearchHotkey(setIsGlobalSearchOpen);

  const [currentTab, setCurrentTab] = useState('MAP');
  const [user, setUser] = useState<User | null>(null);
  const [myPageInfo, setMyPageInfo] = useState<MyPageData | null>(null);
  const [savedCourses, setSavedCourses] = useState<SavedCourse[]>([]);
  const [myWishlist, setMyWishlist] = useState<WishlistItem[]>([]);
  const [aiCourse, setAiCourse] = useState<CourseItem[]>([]);
  const [myCourseItems, setMyCourseItems] = useState<CourseItem[]>(INITIAL_MY_COURSE);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState('');
  const [customVibeInput, setCustomVibeInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [congestionData, setCongestionData] = useState<CongestionData | null>(null);
  /** 게스트 모드 활성 시 남은 일수. null = 비활성 (로그인 사용자거나 게스트 미시작). */
  const [guestRemainingDays, setGuestRemainingDays] = useState<number | null>(null);
  /** {@code ?tab=} 이 잠긴 탭을 지목했을 때 그 이름. 안내창을 띄우고 나면 다시 null 로 돌린다. */
  const [pendingLockedTab, setPendingLockedTab] = useState<string | null>(null);
  /** 서치존에서 팝업 선택 시 지도를 그 위치로 이동시킬 좌표. */
  // setter 는 쓰지 않는다 — 지도 이동은 좌표를 직접 넘기는 fitReq 가 전담한다(mapFit).
  // center 는 지도 초기 진입점으로만 남겨 둔다.
  const [mapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  // 검색 결과 선택 시 지도가 그 팝업 마커로 이동하도록 신호(nonce 로 재검색도 매번 반응).
  const [searchFocus, setSearchFocus] = useState<{ id: string; nonce: number } | null>(null);
  // AI 검색 결과 id 목록 — 지도에 이 핀들만 표시(null=전체). 서치존의 'AI로 찾기'가 세팅.
  const [mapFilterIds, setMapFilterIds] = useState<string[] | null>(null);
  // 검색 결과 좌표 → 지도를 그 위치로 맞춤(한 곳=확대, 여러 곳=다 보이게 축소). InteractiveMap 의 fitReq 로 전달.
  // allPopups 는 모든 팝업 좌표를 가지므로, 지도 마커 로딩 여부와 무관하게 확실히 이동한다.
  const [mapFit, setMapFit] = useState<{ pts: [number, number][]; nonce: number } | null>(null);

  /**
   * "최근 오픈한 팝업" 레일에 실제로 렌더할 목록 — 전체(allPopups)에 카테고리 필터 + 정렬 적용.
   * POP-LOOK 랭킹은 아래에서 지도 노출 가능 팝업만 다시 거르므로, 이 레일과 목록 범위가 다를 수 있다.
   */
  /**
   * 같은 행사가 여러 줄로 쪼개진 것을 한 줄로 묶는다.
   *
   * <p><b>왜 필요했나.</b> 2026-08-05 실측에서 조회수 상위 12칸 중 8칸이 사실상 3개 행사였다 —
   * "스트릿 레스토랑 파이터" 가 이름만 조금씩 다른 4줄로 상위를 차지했고, 짱구·미니브도 2줄씩이었다.
   * 노출 칸이 몇 개든 <b>같은 행사가 그 칸을 나눠 먹으면</b> 사용자가 보는 다양성은 거기서 끝난다.
   *
   * <p>랜딩({@code /popups/[slug]})은 이미 같은 함수로 묶고 있었는데 홈만 빠져 있었다.
   *
   * <p><b>조회수는 합산한다.</b> 대표 하나만 남기고 나머지를 버리면, 4줄로 쪼개졌던 행사가 67 로만
   * 평가돼 오히려 손해를 본다. 실제로는 그 행사를 224번 본 것이므로 합쳐야 사실에 가깝다.
   */
  const dedupedPopups = useMemo(
    () =>
      groupSameEvent(allPopups).map((g) => {
        if (g.duplicates.length === 0) return g.lead;
        const merged = g.duplicates.reduce(
          (sum, d) => sum + (d.viewCount || 0),
          g.lead.viewCount || 0,
        );
        return { ...g.lead, viewCount: merged };
      }),
    [allPopups],
  );

  const railPopups = useMemo(() => {
    /*
     * 병합본을 쓴다. 같은 행사가 이름만 다른 여러 줄로 들어와 목록을 채우면, 스크롤을 내려도
     * 새로운 것이 안 나온다 — 실측에서 상위 12칸 중 8칸이 3개 행사였다.
     */
    const base =
      railCat === 'all'
        ? dedupedPopups
        : dedupedPopups.filter((p) => classifyCategory(p.category) === railCat);
    const list = [...base];
    if (railSort === 'deadline') {
      // 마감임박순 — endDate 없는 건 뒤로(Infinity). parseDate 로 달력 실재성까지 검증(이월 방지).
      const end = (p: PopupStore) => {
        const d = parseDate(p.endDate);
        return d ? d.getTime() : Infinity;
      };
      list.sort((a, b) => end(a) - end(b) || (b.viewCount || 0) - (a.viewCount || 0));
    } else if (railSort === 'latest') {
      // 최신순 — startDate desc, 없으면 id desc(auto-increment 라 항상 존재해 안정적 tie-break).
      const start = (p: PopupStore) => {
        const d = parseDate(p.startDate);
        return d ? d.getTime() : -Infinity;
      };
      list.sort((a, b) => start(b) - start(a) || b.id - a.id);
    } else {
      // 인기순 — viewCount desc, 동점은 id desc 로 안정화(크롤 팝업 다수가 viewCount=0).
      list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0) || b.id - a.id);
    }
    return list.slice(0, RAIL_POPUP_COUNT);
  }, [dedupedPopups, railSort, railCat]);

  /** 필터 칩 노출 대상 — 전체 목록에 실제로 존재하는 카테고리만(카운트 0 은 숨김). */
  const railCategories = useMemo(() => {
    const present = new Set(allPopups.map((p) => classifyCategory(p.category)));
    return CATEGORIES.filter((c) => present.has(c.code));
  }, [allPopups]);

  /**
   * '진짜 위치가 아니라 지역 중심점(카카오가 모호한 주소를 그 동네 한가운데로 찍은 값)' 에 비정상적으로
   * 몰린 좌표 집합. 지도(InteractiveMap)의 FALLBACK_CLUSTER_MIN 과 같은 기준으로 판정해, 개수·검색
   * 이동에서 함께 제외한다(한 점에 수백 개가 링처럼 뭉치던 문제).
   */
  const fallbackCoordKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allPopups) {
      if (p.latitude && p.longitude) {
        const k = `${p.latitude},${p.longitude}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const keys = new Set<string>();
    for (const [k, n] of counts) if (n > FALLBACK_CLUSTER_MIN) keys.add(k);
    return keys;
  }, [allPopups]);

  /** 지도에 실제로 찍히는(진짜 위치 있는) 팝업인가 — 개수/검색 이동 공용 판정. */
  const hasRealMapLocation = (p: { latitude?: string | null; longitude?: string | null }) => {
    const lat = parseFloat(p.latitude ?? '');
    const lng = parseFloat(p.longitude ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    return !fallbackCoordKeys.has(`${p.latitude},${p.longitude}`);
  };

  /**
   * 홈 인사말의 팝업 개수 — 지도(하단 'Total N Locations')와 숫자를 맞추기 위해 '지도에 실제로 찍히는
   * (진짜 위치 있는) 활성 팝업'만 센다. 좌표 없는 것 + 지역 중심점에 몰린 가짜 위치는 제외.
   */
  const mappablePopups = useMemo(
    () => allPopups.filter(hasRealMapLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPopups, fallbackCoordKeys],
  );

  /**
   * POP-ALL 이 보여주는 목록 — <b>갈 수 있고, 같은 행사를 한 번만 세는</b> 것.
   *
   * <p>{@code mappablePopups} 를 {@link groupSameEvent} 로 한 번 더 묶는다. 안 묶으면 같은 행사가
   * 이름만 조금씩 다른 여러 줄로 들어와 24칸짜리 한 페이지에서 여러 칸을 혼자 먹는다. 몇백 곳을
   * 다양하게 보여주는 것이 이 화면의 목적인데 정반대가 된다.
   *
   * <p>조회수는 합산한다 — 네 줄로 쪼개졌던 행사를 대표 한 줄의 조회수로만 평가하면 인기순에서
   * 부당하게 밀린다(레일이 쓰는 {@code dedupedPopups} 와 같은 이유).
   *
   * <p><b>한계.</b> {@link groupSameEvent} 는 이름을 정규화해 묶으므로 표현이 아주 다른 두 줄
   * (예: "빅뱅 20주년 팝업스토어" 와 "빅뱅의 20주년을 직접 만나보는 시간")은 못 잡는다. 실측으로
   * 확인한 사실이다 — 이름이 아니라 장소·기간까지 보는 판정이 필요한데, 그건 이 화면이 아니라
   * 수집 단계의 일이다.
   */
  const popAllPopups = useMemo(
    () =>
      groupSameEvent(mappablePopups).map((g) => {
        if (g.duplicates.length === 0) return g.lead;
        const merged = g.duplicates.reduce(
          (sum, d) => sum + (d.viewCount || 0),
          g.lead.viewCount || 0,
        );
        return { ...g.lead, viewCount: merged };
      }),
    [mappablePopups],
  );

  /**
   * 화면이 말하는 팝업 수는 <b>이 하나</b>다.
   *
   * <p>세 번 걸러낸 값이다 — <b>오늘 열려 있고</b>({@code allPopups}), <b>지도에서 찾을 수 있고</b>
   * ({@code mappablePopups}), <b>같은 행사를 한 번만 센</b>({@code popAllPopups}) 것.
   *
   * <p>두 번째 조건은 갈 수 없는 곳을 세지 않기 위해서다 — 좌표가 없거나 지역 중심점에 뭉쳐
   * 있으면 눌러도 지도에서 찾을 수 없다. 세 번째는 v2.55 에 더했다. 같은 행사가 이름만 다른 여러
   * 줄로 들어와 있으면 "갈 수 있는 곳" 을 여러 곳으로 세는 셈인데, 실제로 갈 수 있는 곳은 한 곳이다.
   *
   * <p>그래서 이 숫자는 예전보다 작다. <b>셀 수 있는 것이 아니라 갈 수 있는 것을 센다</b>는
   * 원칙의 연장이다.
   */
  const mappablePopupCount = popAllPopups.length;

  /**
   * 벤토 히어로 — POP-ALL 미리보기의 카테고리별 줄({@link popAllPreviewRows}).
   *
   * <p>{@code mappablePopupCount} 와 <b>같은 풀</b>({@code mappablePopups})에서 뽑는다 — 다른
   * 풀을 쓰면 미리보기에 보인 팝업이 「전체 보기」 안에 없는 일이 생긴다.
   *
   * <p>아래 랭킹·레일과 겹쳐도 된다. 이 자리는 특정 팝업을 미는 곳이 아니라 <b>얼마나 다양한지를
   * 보여주는</b> 곳이라, 인기 팝업이 여기 한 번 더 나오는 것은 자연스럽다. 세 자리가 같은
   * "인기 팝업 8곳" 을 나눠 먹던 예전 중복과는 다른 종류다.
   */
  const previewRows = useMemo(
    () =>
      popAllPreviewRows(popAllPopups, kstTodayStart(), {
        rowCount: CATEGORIES.length,
        // 한 줄에 열여덟 곳. 넓은 화면에서도 다 들어가지 않는 수라야 줄 화살표가 할 일이 있다.
        perRow: 18,
      }),
    [popAllPopups],
  );

  const [popAllOpen, setPopAllOpen] = useState(false);
  const [popAllCategory, setPopAllCategory] = useState<CategoryCode | null>(null);

  /**
   * 「전체 보기」를 연다. 분야를 주면 그 조건이 걸린 채로 열린다(미리보기의 줄 제목에서 온다).
   *
   * <p>랭킹 모달({@link AllTrendingModal})과 다른 모달이다 — 그쪽은 POP-LOOK 의 조회수 순위를
   * 보여주는 자리이고, 이쪽은 <b>전부를 검색·필터로 훑는</b> 자리다.
   */
  const openPopAll = useCallback((category?: CategoryCode) => {
    setPopAllCategory(category ?? null);
    setPopAllOpen(true);
  }, []);

  /**
   * 이미 상세를 열어 본 팝업들 — POP-ALL 카드에 「본 팝업」을 덮는 데 쓴다.
   *
   * <p>{@code localStorage} 는 서버에 없다. 렌더 중에 읽으면 서버가 그린 HTML(빈 집합)과
   * 하이드레이션 뒤가 어긋나므로 effect 에서 읽는다. 모듈을 동적으로 부르는 것은 이 파일의
   * {@code RecentVisitsCard} 가 이미 쓰는 방식이다 — 첫 번들에 방문 기록 코드를 싣지 않는다.
   */
  const [seenPopupIds, setSeenPopupIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  useEffect(() => {
    let alive = true;
    import('@/lib/recentVisits')
      .then(({ readVisits }) => {
        if (alive) setSeenPopupIds(new Set(readVisits().map((v) => v.popupId)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /**
   * POP-LOOK(랭킹)과 게스트 히어로(마감 임박) — 서로 겹치지 않게 한 번에 나눈다({@link homeSurfaces}).
   *
   * <p>POP-LOOK 은 상세 페이지가 실제로 열린 횟수(viewCount) 순이다. 상세 API가 열릴 때마다
   * 서버에서 1씩 증가하므로 고정 추천이나 이름순이 아니다. 지도에 핀이 없는 팝업은 사용자가
   * 순위에서 눌러도 지도에서 찾을 수 없으므로 랭킹과 전체 목록 양쪽에서 제외한다. 동점은 새로
   * 수집된 팝업(id가 큰 것)을 먼저 보여준다.
   *
   * <p>게스트 히어로는 마감 임박이고, 랭킹이 이미 가져간 곳은 다시 넣지 않는다 — 로그아웃
   * 첫 화면에서 POP-LOOK 과 같은 팝업을 두 번 보여주지 않기 위해서다. 레일(RAIL_POPUP_COUNT)은
   * 여기 안 낀다 — 레일은 카테고리·정렬 칩으로 몇백 곳을 직접 훑는 자리라 고정 목록을 먹이면
   * 그 힘이 죽는다. 랭킹·마감임박과 겹쳐도 되는 유일한 자리다.
   */
  const { ranking, closing } = useMemo(
    () =>
      homeSurfaces(dedupedPopups.filter(hasRealMapLocation), kstTodayStart(), {
        ranking: HOT_POPUP_COUNT,
        closing: GUEST_HERO_COUNT,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dedupedPopups, fallbackCoordKeys],
  );

  // pop-look → "오늘의 추천 팝업": 실제 인기순 상위(랜덤 아님). ranking 이 이미 viewCount desc 정렬.
  const featuredPopup = ranking[0];
  /*
   * 1위를 뺀 나머지 전부. 예전에는 여기서 다시 3개로 잘라, 목록을 늘려도 화면은 그대로였다.
   * 세로로 쌓이는 행 목록이라 늘어나도 배치가 무너지지 않는다.
   */
  const featuredRunnerUps = ranking.slice(1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
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

  const handleAddPlace = (popup: PopupStore) => {
    const newItem = {
      id: popup.id.toString(),
      name: popup.name,
      lat: parseFloat(popup.latitude || '37.5445'),
      lng: parseFloat(popup.longitude || '127.0560'),
      category: popup.category || 'POPUP',
      // 화면 문구가 아니라 코스와 함께 서버에 저장되는 값이다 — 저장한 순간의 화면 언어를
      // 굳혀 버리면 나중에 다른 언어로 열었을 때 남의 말이 섞여 나온다. AI가 채우는 reason 도
      // 한국어라 표기가 갈리지 않게 그대로 둔다.
      reason: '사용자 추가 장소',
    };

    if (myCourseItems.find((item) => item.id === newItem.id)) {
      notify(t('home.coursePlaceDup'));
      return;
    }
    setMyCourseItems([...myCourseItems, newItem]);
    setIsAddPlaceOpen(false);
  };

  const handleCreateRoom = async () => {
    if (!user) {
      if (
        await confirmAction({
          title: t('home.loginRequired'),
          text: t('home.roomMemberOnly'),
          confirmText: t('nav.login'),
        })
      ) {
        router.push(localizedPath('/login', locale));
      }
      return;
    }
    try {
      const res = await apiFetch('/api/planning/create', { method: 'POST' });
      const roomId = await res.text();
      router.push(localizedPath(`/planning?room=${roomId}`, locale));
    } catch (e) {
      notifyError(t('home.serverFail'));
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
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (e) {
      console.error('마이페이지 로드 실패', e);
      // [redesign/test 전용] 로컬(백엔드 없음)에서 '기록' 대시보드를 채우는 목업.
      if (process.env.NODE_ENV === 'development') {
        setMyPageInfo({
          likeCount: 12,
          stampCount: 5,
          reviewCount: 24,
          isPremium: false,
        } as MyPageData);
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
    } catch (e) {
      console.error('코스 불러오기 실패:', e);
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
      console.error('위시리스트 로드 실패:', e);
      // [redesign/test 전용] 로컬에서 찜한 팝업 카드를 채우는 목업.
      if (process.env.NODE_ENV === 'development') {
        const { devMockPopups } = await import('@/lib/devMockPopups');
        setMyWishlist(
          devMockPopups()
            .slice(0, 12)
            .map(
              (p) =>
                ({
                  popupId: Number(p.id),
                  popupName: p.name,
                  location: p.location,
                  popupImage: p.imageUrl,
                }) as WishlistItem,
            ),
        );
      }
    }
  };

  /**
   * 비회원이 브라우저에 담아 둔 찜을 MY 탭에 채운다.
   *
   * <p><b>탭 전환 핸들러가 아니라 효과로 두는 이유.</b> MY 탭에는 두 갈래로 들어온다 — 탭을 누르는
   * 길과 {@code ?tab=MY} 주소로 바로 오는 길이다. 핸들러에만 넣으면 뒤쪽에서 빈 화면이 나온다
   * (실제로 그렇게 만들었다가 확인했다). 그리고 카탈로그가 늦게 도착해도 여기서 다시 채워진다.
   *
   * <p>저장소에는 id 만 있다. 이름·사진은 <b>이미 받아 둔 카탈로그</b>에서 찾는다 — 서버를 다시
   * 부르면 찜 한 건당 요청 하나가 나간다.
   *
   * <p>카탈로그에 없는 id 는 화면에서만 뺀다. 담아 둔 사이에 끝나 목록에서 빠진 팝업이다.
   * 저장소에는 남겨 둔다 — 로그인하면 서버로 옮겨지고, 그쪽에는 지난 팝업도 남는다.
   */
  /**
   * 로그인했는데 저장소에 아직 남아 있는 게스트 찜의 개수.
   *
   * <p><b>왜 이걸 세는가.</b> 이전은 AuthGuard 에서 도는데 서버 왕복이 끼어 있어 홈이 먼저
   * 그려진다. 그동안, 그리고 이전이 <b>실패했을 때</b>, MY 탭은 서버 목록(비어 있음)만 보고
   * "아직 찜한 팝업스토어가 없습니다" 를 띄운다. 저장소에는 멀쩡히 남아 있는데 화면이 없다고
   * 단언하는 것이고, 그게 이 작업 전체가 고치려던 바로 그 화면이다.
   */
  const [guestLeftover, setGuestLeftover] = useState(0);
  /** 이전이 한 바퀴 돌았는가. 안 돌았으면 "옮기는 중", 돌았는데도 남았으면 "못 옮김" 이다. */
  const [migrationSettled, setMigrationSettled] = useState(false);

  /** "다시 시도" 를 누른 직후. 버튼을 잠가 같은 이전을 연타로 밀어 넣지 않게 한다. */
  const [retryingMigration, setRetryingMigration] = useState(false);

  useEffect(() => {
    if (!user) {
      setGuestLeftover(0);
      setMigrationSettled(false);
      return;
    }
    setGuestLeftover(readGuestWishlist().length);
  }, [user]);

  /**
   * 사용자가 직접 이전을 다시 시도한다.
   *
   * <p>쿨다운을 우회하는 문({@link retryGuestWishlistMigration})을 쓴다 — 그 쿨다운은 "아무도 안
   * 시켰는데 배경에서 나가는" 요청을 막으려는 것이고, 사람이 버튼을 눌렀다면 그 이유가 없다.
   * 결과 반영은 이전이 쏘는 완료 알림이 하므로 여기서는 잠금만 풀어 준다.
   */
  const handleRetryMigration = async () => {
    const userId = user?.userId;
    if (!userId || retryingMigration) return;
    setRetryingMigration(true);
    try {
      await retryGuestWishlistMigration(userId);
    } finally {
      setRetryingMigration(false);
    }
  };

  useEffect(() => {
    if (currentTab !== 'MY' || user) return;
    const byId = new Map(catalogPopups.map((p) => [Number(p.id), p]));
    setMyWishlist(
      readGuestWishlist()
        .map((id) => byId.get(id))
        .filter((p): p is PopupStore => Boolean(p))
        .map((p) => ({
          // 게스트에게는 서버가 준 wishlistId 가 없다. 화면에서 키로만 쓰므로 팝업 id 로 대신한다.
          wishlistId: Number(p.id),
          popupId: Number(p.id),
          popupName: p.name,
          popupImage: p.imageUrl ?? '',
          location: p.location ?? '',
          startDate: p.startDate ?? '',
          endDate: p.endDate ?? '',
        })),
    );
  }, [currentTab, user, catalogPopups]);

  const handleRemoveWishlist = async (e: React.MouseEvent, popupId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = await confirmAction({
      title: t('home.wishRemove'),
      text: t('home.wishRemoveText'),
      destructive: true,
    });
    if (!confirmed) return;

    // 비회원은 브라우저에서 뺀다. 토글이 아니라 제거를 쓰는 이유는 guestWishlist.ts 주석 참고.
    if (!user) {
      removeGuestWishlist(popupId);
      setMyWishlist((prev) => prev.filter((item) => item.popupId !== popupId));
      notifySuccess(t('home.removed'));
      return;
    }
    try {
      const res = await apiFetch(`/api/wishlist/${user.userId}/${popupId}`, { method: 'DELETE' });
      if (res.ok) {
        setMyWishlist((prev) => prev.filter((item) => item.popupId !== popupId));
        fetchMyPageData(user.userId);
        notifySuccess(t('home.removed'));
      }
    } catch (e) {
      console.error('찜 삭제 오류:', e);
    }
  };

  const handleLoadCourse = async (courseDataStr: string) => {
    const confirmed = await confirmAction({
      title: t('home.courseLoadTitle'),
      text: t('home.courseLoadText'),
      icon: 'warning',
    });
    if (!confirmed) return;
    setMyCourseItems(JSON.parse(courseDataStr));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCourse = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation();
    const confirmed = await confirmAction({
      title: t('home.courseDeleteTitle'),
      text: t('home.courseDeleteText'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/api/my-courses/${courseId}`, { method: 'DELETE' });
      if (res.ok) {
        notifySuccess(t('home.deleted'));
        if (user) fetchMyCourses(user.userId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * 잠긴 탭(USER_ONLY_TABS)을 눌렀을 때의 안내. 게스트가 <b>활성</b>이면 canAccessTab 단계에서
   * 이미 통과하므로 여기 오지 않는다. 도달하는 경우는 셋뿐이고, 각각 갈 곳이 다르다.
   *
   * <ol>
   *   <li><b>아직 게스트를 시작하지 않음</b> — 여기서 바로 게스트를 시작하고 <b>누른 탭으로 보낸다.</b>
   *   <li><b>게스트 7일 만료</b> — 이미 다 써 봤으니 가입.
   *   <li><b>로그인은 했는데 못 쓰는 탭</b> — 로그인 유도(현재 도달 경로 없음, 방어).
   * </ol>
   *
   * <p>1번을 가입으로 보내면 안 된다. 게스트 시작 버튼은 홈 상단에만 있어서, 그것을 지나쳐 탭부터
   * 누른 사람에게 가입 창을 띄우면 <b>둘러볼 방법이 없는 것처럼</b> 보인다. 그냥 구경하러 온
   * 사람에게 가입은 막다른 길이다.
   *
   * <p><b>1번과 2번을 {@code guestRemainingDays} 로 가르지 않는다.</b> 그 state 는 마운트 뒤
   * effect 에서 채워지는데, {@code ?tab=} 처리는 그보다 먼저 돌 수 있다. 아직 초기값 {@code null}
   * 인 순간에 판정하면 <b>만료된 게스트가 "게스트로 둘러보기" 를 다시 제안받아</b> 7일이 무한히
   * 갱신된다. localStorage 원본을 직접 읽으면 렌더 타이밍과 무관해진다.
   *
   * @return 이제 그 탭을 열어도 되면 {@code true} (게스트를 방금 시작한 경우).
   */
  const promptUpgradeOrLogin = async (tab: string): Promise<boolean> => {
    const guestNeverStarted = getGuestFirstVisit() == null;
    if (!user && guestNeverStarted) {
      if (
        await confirmAction({
          title: t('home.guestLockedTitle'),
          // 여기서 userOnlyTabHintKey 를 쓰면 안 된다 — 그 문구는 전부 "가입 후 이용해주세요" 다.
          // 버튼은 "게스트로 둘러보기" 인데 본문이 가입을 말하면 서로 어긋난다.
          text: t('home.guestStartHint'),
          confirmText: t('home.guestStart'),
        })
      ) {
        startGuestMode();
        setGuestRemainingDays(getRemainingGuestDays());
        return true;
      }
      return false;
    }
    if (!user) {
      if (
        await confirmAction({
          title: t('home.memberOnlyTitle'),
          text: t(userOnlyTabHintKey(tab)),
          confirmText: t('auth.signup'),
        })
      ) {
        router.push(localizedPath('/signup', locale));
      }
      return false;
    }
    if (
      await confirmAction({
        title: t('home.loginRequired'),
        confirmText: t('nav.login'),
      })
    ) {
      router.push(localizedPath('/login', locale));
    }
    return false;
  };

  const handleTabChange = async (tab: string) => {
    const isGuestActive = guestRemainingDays != null && guestRemainingDays > 0;
    if (!canAccessTab(tab, !!user, isGuestActive) && !(await promptUpgradeOrLogin(tab))) {
      return;
    }
    setCurrentTab(tab);
    sessionStorage.setItem('lastTab', tab);
    // 탭 전환 시 항상 상단부터 보이게 (아래로 스크롤한 상태에서 여권/동행 등을 누르면
    // 스크롤 위치가 유지돼 새 탭의 하단이 먼저 보이던 문제 수정).
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });

    // 비회원의 찜은 위 useEffect 가 채운다 — 주소로 바로 들어오는 길도 덮어야 하기 때문이다.
    if (tab === 'MY' && user) {
      fetchMyPageData(user.userId);
      fetchMyCourses(user.userId);
      fetchWishlist(user.userId);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('user');
    clearAuthToken();
    sessionStorage.removeItem('aiCourseData');
    setUser(null);
    await notifySuccess(t('home.loggedOut'));
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
      title: t('home.withdrawTitle'),
      text: t('home.withdrawText'),
      icon: 'warning',
      destructive: true,
      confirmText: t('home.withdrawNext'),
    });
    if (!firstOk) return;
    const finalOk = await confirmAction({
      title: t('home.withdrawFinalTitle'),
      text: t('home.withdrawFinalText'),
      icon: 'warning',
      destructive: true,
      confirmText: t('home.withdrawConfirm'),
    });
    if (!finalOk) return;

    try {
      const res = await apiFetch('/api/v1/users/me', { method: 'DELETE' });
      if (!res.ok) {
        const message = await res.text();
        // 서버 메시지는 한국어로 오지만 그대로 보여준다 — 사유(제재·미납 등)를 화면에서 지우면
        // 사용자는 왜 막혔는지 알 길이 없다. 메시지가 비었을 때만 번역된 기본 문구로 대체.
        notifyError(message || t('home.withdrawFail'));
        return;
      }
      localStorage.removeItem('user');
      clearAuthToken();
      sessionStorage.clear();
      setUser(null);
      await notifySuccess(t('home.withdrawDone'));
      router.replace('/login');
    } catch {
      notifyError(t('home.withdrawError'));
    }
  };

  const handleAiRecommend = async (vibe: string) => {
    if (!vibe.trim()) {
      notify(t('home.vibeRequired'));
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
      sessionStorage.setItem('aiCourseData', JSON.stringify({ vibe: vibe, course: result }));
    } catch (e) {
      // [redesign/test 전용] 백엔드 없을 때(로컬) 동선 지도·저장 버튼을 미리볼 수 있도록 목업 코스로 폴백.
      if (process.env.NODE_ENV === 'development') {
        const { devMockCourse } = await import('@/lib/devMockPopups');
        const mock = devMockCourse(vibe);
        setAiCourse(mock);
        sessionStorage.setItem('aiCourseData', JSON.stringify({ vibe, course: mock }));
      } else {
        notifyError(t('home.aiFail'));
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleResetCourse = () => {
    setAiCourse([]);
    setSelectedVibe('');
    sessionStorage.removeItem('aiCourseData');
  };

  /** AI 추천 코스(aiCourse)를 마이페이지에 저장. */
  const handleSaveAiCourse = async () => {
    if (aiCourse.length === 0) {
      notifyWarning(t('home.courseNeeded'));
      return;
    }
    if (!user) {
      notify(t('home.loginRequired'));
      router.push(localizedPath('/login', locale));
      return;
    }
    try {
      const res = await apiFetch('/api/my-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          // AI 검색에 쓰는 한국어 분위기 값은 저장명에 섞지 않고, 사용자가 보는 언어의 기본 이름을 쓴다.
          courseName: `${defaultCourseName} (${new Date().toLocaleDateString()})`,
          courseData: JSON.stringify(aiCourse),
        }),
      });
      if (res.ok) {
        notifySuccess(t('home.courseSavedMy'));
        setMyCourseItems(aiCourse);
        fetchMyCourses(user.userId);
      } else {
        notifyError(t('home.saveFail'));
      }
    } catch {
      notifyError(t('home.saveError'));
    }
  };

  const handleSaveCourse = async () => {
    if (!user) {
      notify(t('home.loginRequired'));
      return;
    }

    // v2.12: 모든 사용자가 코스를 무제한으로 저장 가능. 이전의 freemium 1개 제한은 폐지.

    try {
      const res = await apiFetch('/api/my-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          courseName: `${defaultCourseName} (${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString().slice(0, 5)})`,
          courseData: JSON.stringify(myCourseItems),
        }),
      });

      if (res.ok) {
        notifySuccess(t('home.courseSaved'));
        fetchMyCourses(user.userId);
      } else {
        notifyError(t('home.saveFail'));
      }
    } catch (e) {
      notifyError(t('home.saveError'));
    }
  };

  const handleOpenModal = () => setIsModalOpen(true);

  const handleMarkerClickToDetail = (popupId: number | string) => {
    saveHomeReturnState();
    router.push(localizedPath(`/popup/${popupId}`, locale));
  };

  /**
   * 홈 → 상세로 가는 링크(<a href>) 클릭을 전부 잡아서 스크롤 위치를 저장한다.
   *
   * <p><b>왜 캡처 단계 document 리스너인가.</b> 홈에서 상세로 가는 실제 경로 중 상당수는
   * {@code router.push} 가 아니라 순수 {@code <Link href>}다 — 레일·POP-LOOK·최근 본 팝업뿐
   * 아니라 벤토 랭킹(HomeBento1a)·캘린더(PopupCalendar, 화면·모달 양쪽)·라이브 티커·일정
   * 탭(MySchedule)처럼 <b>이 파일 밖의 자식 컴포넌트</b>가 그리는 링크도 있다. 그 컴포넌트마다
   * 저장 함수를 prop 으로 꽂아 넣으면 놓치는 곳이 반드시 생긴다 — 실제로 이 조사 중에도 처음
   * 계획에 없던 두 경로(PopupCalendar, HomeBento1a)를 찾았다. 클릭을 캡처 단계에서 한 번만
   * 가로채면 앞으로 새 링크가 추가돼도 따로 손댈 필요가 없다.
   *
   * <p>캡처 단계라 Link 자신의 클릭 처리보다 먼저 실행되고, {@code preventDefault}·
   * {@code stopPropagation} 을 하지 않으므로 실제 이동은 그대로 Link 가 처리한다 — 여기서는
   * 관찰만 한다.
   *
   * <p>{@code router.push} 로 직접 이동하는 곳(버튼 onClick 등, 실제 <a> 가 없는 곳)은 이
   * 리스너로 못 잡는다 — 그런 곳은 각 호출부에서 {@link saveHomeReturnState} 를 직접 부른다.
   */
  useEffect(() => {
    const onAnchorClickCapture = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (el instanceof HTMLAnchorElement && isPopupDetailPath(el.pathname)) {
        saveHomeReturnState();
      }
    };
    document.addEventListener('click', onAnchorClickCapture, true);
    return () => document.removeEventListener('click', onAnchorClickCapture, true);
  }, []);

  useEffect(() => {
    let raw: unknown = null;
    try {
      raw = JSON.parse(window.sessionStorage.getItem(HOME_RETURN_STATE_KEY) ?? 'null');
    } catch {
      return;
    }
    const scrollY = resolveHomeReturnScroll(raw, window.location.search, Date.now());
    if (scrollY === null) return;
    // 지우는 시점은 스크롤을 <b>실제로 적용한 뒤</b>다 — 검증만 마친 시점에 바로 지우면(예전
    // 버그이자, 고치는 과정에서 실측으로 다시 걸린 버그) 두 가지가 같은 증상을 낸다.
    //   1) locale 전환·React StrictMode 재마운트로 이 effect 가 한 번 더 돌 때, 아직 유효한
    //      항목을 먼저 지워 버려서 그 뒤에 오는 진짜 뒤로가기가 아무것도 못 찾는다.
    //   2) StrictMode 개발 모드는 이 effect 를 (마운트 → 정리 → 재마운트) 순서로 두 번 부른다.
    //      검증 직후 지우면 <b>첫 번째</b> 실행이 이미 지워 버리고, cleanup 이 그 타이머를
    //      취소한 뒤 <b>두 번째</b> 실행은 항목이 없어 아무 것도 예약하지 못한다 — 스크롤이
    //      영영 안 걸린다(실제로 이 순서로 재현해서 확인했다).
    // 지우기를 setTimeout 콜백 안으로 옮기면, 취소된 실행은 아무것도 지우지 않고 그대로
    // 살아남은 마지막 실행만 지우면서 스크롤한다 — 두 문제 다 같은 수정으로 없어진다.
    const timer = window.setTimeout(() => {
      window.sessionStorage.removeItem(HOME_RETURN_STATE_KEY);
      window.scrollTo({ top: scrollY });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  /*
   * 보안 (v2.7): 옛 OAuth 흐름은 토큰뿐 아니라 isPremium / role / userId / nickname 까지 URL 쿼리에
   * 그대로 박아 보냈다. 클라이언트가 그 값을 받아 localStorage 에 저장 → role/isPremium 위조 위험 (IDOR
   * / 권한 상승). 현재 정식 OAuth 진입점은 {@code /oauth/callback} 이고, 그 페이지는 토큰만 받아
   * {@code GET /api/v1/auth/me} 로 서버에서 user 정보를 가져온다. 따라서 메인 페이지의 URL 신뢰
   * 코드는 dead-code 이자 보안 hole 이므로 통째로 제거했다.
   */

  useEffect(() => {
    /*
     * 로컬 캐시는 서버가 아무것도 못 준 경우에만 쓴다.
     *
     * 예전엔 무조건 덮어썼는데, 이제는 서버가 ISR 로 받아 둔 더 새 목록을 갖고 시작할 수 있다.
     * 그것을 지난 방문의 localStorage 로 덮으면 <b>새 데이터를 헌 데이터로 바꾸는</b> 셈이다.
     */
    if (initialPopups.length > 0) {
      /*
       * 서버가 2분 ISR 캐시로 이미 받은 800여 건을 마운트 직후 다시 받지 않는다. 예전 코드는 같은
       * 600KB 안팎 JSON을 연달아 두 번 받고, 파싱·필터·정렬·카드 렌더까지 두 번 돌렸다. 서버 목록은
       * 이미 첫 렌더에 들어왔으므로 캐시만 최신화하면 충분하다.
       */
      try {
        localStorage.setItem('cached_popups', JSON.stringify(keepOpenNow(initialPopups)));
      } catch {
        // 저장공간이 막혀도 서버 목록으로 화면은 이미 정상이다.
      }
    } else {
      let cachedPopups: string | null = null;
      try {
        cachedPopups = localStorage.getItem('cached_popups');
      } catch {
        // 저장소가 차단된 브라우저도 아래 네트워크 경로로 계속 진행한다.
      }
      if (cachedPopups) {
        try {
          const parsed = JSON.parse(cachedPopups);
          setAllPopups(keepOpenNow(parsed));
          setCatalogPopups(Array.isArray(parsed) ? parsed : []);
        } catch {
          localStorage.removeItem('cached_popups');
        }
      }

      apiFetch('/api/popups')
        .then((res) => {
          if (!res.ok) throw new Error(`popups ${res.status}`);
          return res.json();
        })
        .then((raw) => {
          const data = keepOpenNow(raw);
          setAllPopups(data);
          setCatalogPopups(Array.isArray(raw) ? raw : []);
          try {
            localStorage.setItem('cached_popups', JSON.stringify(data));
          } catch {
            // 캐시 저장 실패가 화면 데이터 로딩 실패로 바뀌면 안 된다.
          }
        })
        .catch((err) => {
          console.error('팝업 데이터 로딩 실패:', err);
          // [redesign/test 전용] 로컬(백엔드 없음)에서 재설계 홈을 채우는 개발용 목업.
          if (process.env.NODE_ENV === 'development') {
            const mock = devMockPopups();
            setAllPopups(mock);
            setCatalogPopups(mock);
          }
        });
    }

    let cachedCongestion: string | null = null;
    try {
      cachedCongestion = localStorage.getItem('cached_congestion');
    } catch {
      // 저장소 없이도 혼잡도 API를 요청한다.
    }
    if (cachedCongestion) {
      try {
        setCongestionData(JSON.parse(cachedCongestion));
      } catch {
        localStorage.removeItem('cached_congestion');
      }
    }

    apiFetch('/api/congestion')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.level) {
          setCongestionData(data);
          try {
            localStorage.setItem('cached_congestion', JSON.stringify(data));
          } catch {
            // 혼잡도 표시는 성공했으므로 캐시 실패는 무시한다.
          }
        }
      })
      .catch((err) => console.error('혼잡도 데이터 실패:', err));
  }, [initialPopups]);

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
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      const firstVisit = getGuestFirstVisit();
      if (firstVisit == null) {
        // 게스트 세션을 <b>자동으로 시작하지 않는다.</b>
        //
        // 예전엔 홈에 들어오기만 하면 startGuestMode() 가 돌아 7일 카운터가 시작됐다. 사용자는
        // 자기가 무엇을 시작했는지 모르는 채였고, guestMode.ts 의 설계 문서가 적어 둔
        // "명시적으로 눌러야 시작" 과도 어긋났다.
        //
        // 그렇다고 /login 으로 튕기지도 않는다. 예전에 그랬다가 검색·SEO 로 들어온 방문자가
        // 서비스를 구경도 못 하고 이탈했다(방문 로그에 `/` → `/login` 2회만 찍힌 세션이 다수).
        // 지도는 그대로 열어 두고, 나머지 탭만 잠근다(USER_ONLY_TABS).
        setGuestRemainingDays(null);
        return;
      }
      // 만료돼도 홈은 계속 열람 가능 — 강제 회원가입 리다이렉트 제거.
      // 예전엔 7일 뒤 홈 진입 시 /signup 으로 튕겨, 검색·SEO 재방문자까지 하드월에 막혀 이탈했다.
      // 이제 getRemainingGuestDays 가 만료 시 0 을 반환해 상단 배너가 소프트 가입 유도로 바뀌고,
      // 참여형 탭(COURSE/MUSIC/MATE)만 canAccessTab 이 계속 가입을 유도한다(하드월 아님).
      setGuestRemainingDays(getRemainingGuestDays(firstVisit));
    } else {
      setGuestRemainingDays(null);
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      fetchMyCourses(parsedUser.userId, true);
      fetchWishlist(parsedUser.userId);

      if (sessionStorage.getItem('lastTab') === 'MY') {
        fetchMyPageData(parsedUser.userId);
      }
    }

    const savedCourse = sessionStorage.getItem('aiCourseData');
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
   * 토큰 만료 시 헤더의 이름·프로필을 즉시 내린다.
   *
   * apiFetch 가 401 을 받으면 토큰과 user 캐시를 지우고 AUTH_EXPIRED_EVENT 를 쏘지만, 홈은
   * 위 mount effect 에서 localStorage 를 한 번 읽어 user 를 React state 로 들고 있어서
   * 새로고침 전까지 "로그인된 것처럼 보이는데 내 데이터는 0건" 인 상태가 그대로 남았다.
   * 사용자에게는 '데이터가 사라진' 것으로 보이던 증상의 마지막 조각이라 여기서 state 도 비운다.
   */
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setMyCourseItems([]);
      setMyWishlist([]);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  /*
   * 비회원 때 담아 둔 찜이 방금 이 계정으로 옮겨졌다.
   *
   * 이전은 AuthGuard(루트 레이아웃)에서 도는데, 그 전에 /api/v1/auth/me 왕복을 한 번 기다린다.
   * 홈의 mount effect 는 그보다 먼저 끝나 서버 목록(=아직 비어 있는)을 state 로 들고 있으므로,
   * 알려 주지 않으면 새로고침 전까지 MY 탭이 0건으로 보인다 — "로그인했더니 찜이 사라졌다" 로
   * 읽히는 바로 그 화면이다. 위 AUTH_EXPIRED_EVENT 와 같은 방식으로 서버 값을 다시 읽는다.
   * 찜 개수(likeCount)는 서버가 세므로 마이페이지도 함께 다시 부른다.
   */
  useEffect(() => {
    const handleMigrated = () => {
      const userId = user?.userId;
      if (!userId) return;
      fetchWishlist(userId);
      fetchMyPageData(userId);
      // 이전이 한 바퀴 돌았다. 남은 것이 있으면 그것은 "아직 진행 중" 이 아니라 "못 옮긴 것" 이다.
      setGuestLeftover(readGuestWishlist().length);
      setMigrationSettled(true);
    };
    window.addEventListener(GUEST_WISHLIST_MIGRATED_EVENT, handleMigrated);
    return () => window.removeEventListener(GUEST_WISHLIST_MIGRATED_EVENT, handleMigrated);
    // fetchWishlist/fetchMyPageData 는 매 렌더 새로 만들어지지만 인자는 userId 뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  /*
   * ?tab= 쿼리 또는 sessionStorage 의 lastTab 으로 초기 탭 복원. searchParams 변경 시마다
   * 다시 실행되지만 게스트/유저 상태에는 영향 없음 — setCurrentTab 한 번만 호출.
   */
  useEffect(() => {
    const hasUser = !!localStorage.getItem('user');
    const firstVisit = getGuestFirstVisit();
    const isGuestActive = firstVisit != null && !isGuestExpired(firstVisit);

    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const requested = tabParam.toUpperCase();
      if (canAccessTab(requested, hasUser, isGuestActive)) {
        setCurrentTab(requested);
        return;
      }
      /*
       * 잠긴 탭을 지목한 딥링크는 <b>조용히 지도로 떨어뜨리지 않는다.</b>
       *
       * <p>{@code /music} 은 8줄짜리 리다이렉트 파일이라 {@code /?tab=music} 으로 오고,
       * 여기서 MUSIC 이 잠긴 탭이라 DEFAULT_TAB 으로 대체됐다. 북마크를 눌렀는데 아무 말 없이
       * 다른 화면이 뜨는 것은 <b>고장으로 읽힌다</b> — 사용자는 자기가 뭘 잘못 눌렀는지 모른다.
       *
       * <p>화면은 지도로 두되, 무엇이 막혔는지 알리고 게스트를 시작하면 그 탭으로 보낸다.
       */
      setCurrentTab(DEFAULT_TAB);
      setPendingLockedTab(requested);
      return;
    }
    const lastTab = sessionStorage.getItem('lastTab');
    if (lastTab) {
      setCurrentTab(canAccessTab(lastTab, hasUser, isGuestActive) ? lastTab : DEFAULT_TAB);
    }
  }, [searchParams]);

  /*
   * 잠긴 탭 딥링크 안내. 위 effect 와 나눠 둔 이유는 confirmAction 이 await 를 요구해서다 —
   * effect 콜백 자체를 async 로 만들면 정리 함수를 돌려줄 수 없다.
   *
   * cancelled 플래그: 안내창이 떠 있는 동안 사용자가 다른 곳으로 가면 setState 를 하지 않는다.
   */
  useEffect(() => {
    if (!pendingLockedTab) return;
    let cancelled = false;
    void (async () => {
      const opened = await promptUpgradeOrLogin(pendingLockedTab);
      if (cancelled) return;
      if (opened) {
        setCurrentTab(pendingLockedTab);
        sessionStorage.setItem('lastTab', pendingLockedTab);
      }
      setPendingLockedTab(null);
    })();
    return () => {
      cancelled = true;
    };
    // promptUpgradeOrLogin 은 매 렌더 새로 만들어지므로 deps 에 넣으면 안내창이 무한히 다시 뜬다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLockedTab]);

  /* Utilities */
  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  const getCongestionColor = (level: string) => {
    switch (level) {
      case '여유':
        return 'text-green-500';
      case '보통':
        return 'text-yellow-500';
      case '약간 붐빔':
        return 'text-orange-500';
      case '붐빔':
        return 'text-red-500';
      default:
        return 'text-gray-400';
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

  return (
    <main className="relative min-h-screen overflow-x-clip pb-28 font-sans text-gray-900 transition-colors duration-500 dark:text-white lg:pb-16">
      {/* 모드별 풀 배경 영상 — 라이트=밝은 스카이라인(light-bg), 다크=생기있는 서울 야경(login-bg).
          영상이 '실제로 보이도록' 스크림은 얕게(home-video-scrim). 콘텐츠는 불투명 카드 위라 가독성은 카드가 담당.
          마운트 전엔 브랜드 단색(cream/ink)만 → 깜빡임 없이 영상 페이드 인. 활성 모드 영상 한 개만 로드. */}
      {/* 이 층이 화면 전체를 덮으므로 여기가 크림/잉크로 고정돼 있으면 계절 배경은 어디에도
          안 보인다 — body 의 --color-background 까지 전부 가린다. 계절 토큰으로 바꾼다. */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden"
        style={{ background: 'var(--s-bg)' }}
        aria-hidden
      >
        {/* 영상만 따로 감싼다. 테마가 바뀌면 파일이 통째로 갈려 툭 끊기는데, 색처럼 흐르게 할
            방법이 없어 따로 페이드한다(globals.css 의 theme-bg-fade). 바탕색·스크림까지 같이
            감싸면 그 둘은 이미 색으로 부드럽게 흐르는 중이라 두 번 흔들린 것처럼 보인다. */}
        <div className="theme-bg-fade absolute inset-0">
          {themeReady &&
            (bgStill ? (
              /* 정지 배경은 영상 감시자·크로스페이드가 필요 없다. 좁은 화면에서 안 그리는 것만
                 LoopingBgVideo 와 맞춘다(그 아래는 home-flat-bg 가 덮는다). 움직임을 줄이도록
                 설정한 사람에게도 그린다 — 움직이지 않으니 가릴 이유가 없다. */
              // eslint-disable-next-line @next/next/no-img-element -- 화면을 채우는 장식 배경이라 next/image 의 레이아웃·최적화가 필요 없다
              <img
                key={bgSrc}
                src={bgSrc}
                alt=""
                aria-hidden
                className="absolute inset-0 hidden h-full w-full object-cover md:block"
              />
            ) : (
              <LoopingBgVideo key={bgSrc} src={bgSrc} rate={bgRate} />
            ))}
        </div>
        {/* 좁은 화면 전용 배경 보강. 영상이 없는 구간에서만 그려지고 CSS 만 쓴다 — 규칙은
            globals.css 의 .home-flat-bg 주석 참고. 넓은 화면에서는 display:none 이라
            영상 위에 아무것도 얹지 않는다. */}
        <div className="home-flat-bg"></div>
        <div className="home-flat-grain"></div>
        <div className="home-video-scrim absolute inset-0"></div>
      </div>

      <div className="relative z-10 px-4 md:px-6 py-4 md:py-6 max-w-[1600px] mx-auto">
        <Header
          user={user}
          onLogout={handleLogout}
          onLogoClick={() => handleTabChange('MAP')}
          onReportClick={() => setIsReportPopupOpen(true)}
          onProfileClick={user ? () => setIsProfileEditOpen(true) : undefined}
          onBellClick={() => setIsNotificationsOpen(true)}
          activeTab={currentTab}
          onNavChange={(t) => handleTabChange(t)}
          mobileLocaleControl={<LocaleSwitcher locale={locale} />}
          className="mb-4 md:mb-6"
        />

        {/* 계절 전환 배너 — 재방문자에게 계절당 한 번, 2주 뒤 접힘. 자세한 규칙은 컴포넌트 주석. */}
        <SeasonBanner
          /*
           * 예전에는 "계절 한정" 필터를 켰다. 그 필터가 실제로 고르던 것은 이번 계절 안에
           * 마감하는 팝업이었으므로, 같은 목록을 정직한 이름으로 보여 주는 마감임박 정렬로
           * 옮긴다 — 배너가 말하는 "곧 닫힌다" 와도 이쪽이 맞는다.
           */
          onExplore={() => {
            setRailSort('deadline');
            handleTabChange('MAP');
            document
              .getElementById('trending-rail')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {/*
         * 게스트 안내 배너 — 로그인 안 한 게스트에게 상시 노출.
         * 유예 중(D-N)엔 잔여일을, 만료(0) 후엔 하드월 대신 "가입하면 계속" 소프트 유도만 띄운다.
         * 실제 가입 강제는 찜·코스·메이트 같은 참여형 액션(canAccessTab)에서만.
         */}
        {/* 게스트 시작 안내 — 아직 게스트도 회원도 아닌 사람에게만.
            잠그기만 하고 여는 버튼이 없으면 막다른 길이 된다. 로그인 페이지에도 같은 버튼이
            있지만, 거기까지 가려면 이 화면을 떠나야 한다. */}
        {!user && guestRemainingDays == null && (
          <div className="mb-4 hidden flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--color-border)] bg-surface px-4 py-3 shadow-sm md:mb-6 md:flex">
            <span className="text-xs font-bold md:text-sm">{t('home.guestLockedTitle')}</span>
            <button
              type="button"
              onClick={() => {
                startGuestMode();
                setGuestRemainingDays(getRemainingGuestDays());
              }}
              className="shrink-0 rounded-pill bg-lime-300 px-4 py-1.5 text-xs font-black text-ink-900 transition-colors hover:bg-lime-400 md:text-sm"
            >
              {t('home.guestStart')}
            </button>
          </div>
        )}

        {guestRemainingDays != null && (
          <div className="mb-4 hidden items-center justify-between gap-3 rounded-pill bg-lime-300/85 px-4 py-2 text-ink-900 ring-1 ring-ink-900/10 shadow-sm md:mb-6 md:flex dark:bg-lime-400/95">
            <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold">
              <Clock className="size-3.5 md:size-4 shrink-0" aria-hidden />
              {guestRemainingDays > 0
                ? `${t('home.guestMode')} · D-${guestRemainingDays}`
                : t('home.guestExpired')}
            </span>
            <button
              type="button"
              onClick={() => router.push(localizedPath('/signup', locale))}
              className="shrink-0 text-[11px] md:text-xs font-semibold underline-offset-2 hover:underline"
            >
              {t('cta.signup')}
            </button>
          </div>
        )}

        {/* TAB: MAP */}
        {currentTab === 'MAP' && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={sectionVariants}
          >
            {/* 주목 팝업 — 제휴로 들어온 건을 홈 맨 위 한 줄로 알린다. 띄울 것이 없거나 이미
                끝났으면 스스로 아무것도 그리지 않는다(featuredBanner.activeFeatured).
                자기 소개(아래 히어로)보다 위에 두되 한 줄로 얇게 둔다 — 두껍게 두면 좁은 화면에서
                "오늘 서울에 N곳" 이 화면 밖으로 밀려 홈이 광고판처럼 읽힌다. */}
            <FeaturedPopupBanner />

            {/* 언어 전환 — 히어로 <b>밖</b>, 자기 줄에 둔다.
                예전엔 히어로 카드 안에 absolute right-4 top-4 로 띄웠는데 두 가지가 깨졌다.
                (1) 좁은 화면에서 "오늘의 서울 팝업" 배지와 겹쳤다. 카드 폭이 줄어도 배지는
                    왼쪽에서 자라고 언어 칩은 오른쪽에 고정이라 가운데서 만난다.
                (2) 그 카드는 비로그인일 때만 그려진다. 로그인하면 언어 전환이 통째로 사라져,
                    외국인 회원은 한 번 로그인한 뒤 언어를 못 바꿨다.
                흐름 안에 두면 겹칠 수가 없고, 로그인 여부와 무관하게 늘 같은 자리에 있다. */}
            <div className="mb-4 hidden justify-end md:flex">
              <LocaleSwitcher locale={locale} />
            </div>

            {/* User Greeting Section */}
            <section aria-label="Welcome Banner" className="mb-6">
              {user ? (
                <div className="w-full border rounded-xl p-5 md:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200">
                  <div className="relative z-10 text-center md:text-left">
                    <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">
                      {t('greet.hello')}{' '}
                      <span className="text-lime-300 dark:text-lime-700">{user.nickname}</span>
                      {t('greet.suffix')}
                    </h1>
                    <p className="text-xs md:text-base opacity-70">
                      {t('greet.countPrefix')}
                      <span className="font-bold text-lime-400 dark:text-lime-700">
                        {mappablePopupCount}
                        {t('count.unit')}
                      </span>
                      {t('greet.countSuffix')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleTabChange('PASSPORT')}
                    className="relative z-10 w-full md:w-auto inline-flex px-5 py-3 bg-lime-300 hover:bg-lime-400 text-ink-900 font-semibold rounded-pill items-center justify-center gap-2 transition-colors text-sm md:text-base"
                  >
                    <Ticket size={18} /> {t('greet.passport')}
                  </button>
                </div>
              ) : (
                <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#1c1c1e] md:p-8">
                  {/* 은은한 라임 글로우 — 칙칙함 대신 활력. 밝지만 텍스트 대비는 유지. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-lime-300/35 blur-3xl dark:bg-lime-400/20"
                  />
                  <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 text-left">
                      <span className="inline-block mb-3 rounded-pill bg-lime-300 px-3 py-1 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase text-ink-900">
                        {locale === 'ko' ? '오늘의 서울 팝업' : t('stat.open')}
                      </span>
                      <h1 className="text-2xl md:text-4xl font-black leading-tight text-gray-900 dark:text-white">
                        {locale === 'ko' ? (
                          <>
                            {t('hero.openedPrefix')}
                            <span className="text-lime-600 dark:text-lime-300">
                              {mappablePopupCount || '…'}
                              {t('count.unit')}
                            </span>
                            {/* 조사는 개수 쪽에 붙인다 — 줄이 바뀌어도 "123개의 / 팝업이" 로 끊긴다. */}
                            {t('hero.openedJoin')}
                            <br className="hidden md:block" /> {t('hero.openedSuffix')}
                          </>
                        ) : (
                          <>
                            <span className="text-lime-600 dark:text-lime-300">
                              {mappablePopupCount || '…'}
                            </span>{' '}
                            {t('hero.title')}
                          </>
                        )}
                      </h1>
                      <p className="mt-2 text-sm md:text-base text-gray-600 dark:text-white/70">
                        {locale === 'ko'
                          ? '지도에서 일정과 장소를 확인하고, 마음에 드는 팝업을 저장하세요.'
                          : t('hero.subtitle')}
                      </p>
                      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row md:justify-start">
                        <button
                          type="button"
                          onClick={() => {
                            // 예전에는 aria-label 의 한국어 문구로 찾았다 — 그 문구를 번역하는 순간
                            // 영어·일본어에서 이 버튼이 조용히 아무 일도 안 하게 된다. id 로 찾는다.
                            document
                              .getElementById(HOME_MAP_ID)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            window.dispatchEvent(new Event(ONBOARDING_TRIGGER_EVENT));
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-pill bg-lime-300 px-6 py-3 text-sm md:text-base font-bold text-ink-900 transition hover:bg-lime-400"
                        >
                          {t('cta.browseMap')} <ArrowRight size={16} />
                        </button>
                        <Link
                          href="/signup"
                          className="hidden items-center justify-center gap-2 rounded-pill border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-100 sm:inline-flex md:text-base dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                        >
                          {t('auth.signup')}
                        </Link>
                      </div>
                    </div>

                    {/* 팝업 정보 클러스터 — 실제 사진이 없으면 이름·장소를 우선 표시.
                        마감 임박(closing) — POP-LOOK 이 가져간 곳과 겹치지 않는다. */}
                    {closing.length > 0 && (
                      <div className="grid w-full min-w-0 shrink-0 grid-cols-2 gap-2 md:w-[280px]">
                        {closing.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              // handleTabChange 가 스크롤을 맨 위로 되돌리므로, 저장은 반드시 그 전에.
                              saveHomeReturnState();
                              handleTabChange('MAP');
                              router.push(localizedPath(`/popup/${p.id}`, locale));
                            }}
                            aria-label={`${p.name} ${t('common.viewDetail')}`}
                            className={`aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-black/5 dark:ring-white/10 transition hover:-translate-y-0.5 hover:shadow-lg ${i % 2 === 1 ? 'sm:translate-y-3' : ''}`}
                          >
                            <PopupCoverVisual popup={p} name={p.name} location={p.location} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 지역 / 시점 / 카테고리 빠른 필터 (지도 위 진입점) */}
            <BrowseSection initialMarkers={initialMapMarkers} />

            {/* 서울 팝업 지도 — 홈의 주인공 (디자인 진단서 P0). 지도 전체폭·크게, 보조 정보는 아래 3열. */}
            <section
              id={HOME_MAP_ID}
              aria-label={t('map.aria')}
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-10"
            >
              {/* Search Zone */}
              <div className="relative z-50 col-span-1 lg:col-span-12">
                <SearchZone
                  popups={allPopups}
                  onSelectPopup={(hit) => {
                    // AI 필터가 걸려 있으면 해제 — 그래야 고른 핀이 지도에 보인다.
                    setMapFilterIds(null);
                    // 그 팝업 정보 카드를 연다(지도 이동은 아래 좌표로 확실히 처리).
                    setSearchFocus((prev) => ({
                      id: String(hit.objectID),
                      nonce: (prev?.nonce ?? 0) + 1,
                    }));
                    // 그 팝업 좌표로 지도를 확대 이동. 단 진짜 위치가 있는 팝업만 — 지역 중심점(가짜 위치)에
                    // 몰린 팝업은 지도에 안 찍히므로 그쪽으로 확대하면 빈 곳/링만 보인다.
                    const p = allPopups.find((x) => String(x.id) === String(hit.objectID));
                    if (p && hasRealMapLocation(p)) {
                      setMapFit((prev) => ({
                        pts: [[parseFloat(p.longitude ?? ''), parseFloat(p.latitude ?? '')]],
                        nonce: (prev?.nonce ?? 0) + 1,
                      }));
                    }
                  }}
                  onAiFilter={(ids) => {
                    // AI 검색 결과 id → 지도에 그 핀만. null 이면 전체 복원.
                    setMapFilterIds(ids);
                    if (ids) {
                      // 결과 팝업들의 좌표를 모아 지도를 맞춘다 — 한 곳이면 확대, 여러 곳이면 다 보이게 축소.
                      const idSet = new Set(ids.map(String));
                      const pts = allPopups
                        .filter((x) => idSet.has(String(x.id)) && hasRealMapLocation(x))
                        .map(
                          (x) =>
                            [parseFloat(x.longitude ?? ''), parseFloat(x.latitude ?? '')] as [
                              number,
                              number,
                            ],
                        );
                      if (pts.length > 0) {
                        setMapFit((prev) => ({ pts, nonce: (prev?.nonce ?? 0) + 1 }));
                      }
                      if (typeof document !== 'undefined') {
                        document
                          .getElementById(HOME_MAP_ID)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }
                  }}
                />
              </div>

              {/* Map Zone — 배경 분리를 위해 solid 배경 + shadow 로 카드 블록 강화. */}
              <div className="group relative col-span-1 h-[min(62svh,560px)] min-h-[430px] overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-lg shadow-black/5 dark:border-white/10 dark:bg-[#111] dark:shadow-black/30 sm:rounded-[2rem] lg:col-span-12 lg:h-[58vh]">
                <InteractiveMap
                  initialMarkers={initialMapMarkers}
                  center={mapCenter}
                  focusReq={searchFocus}
                  onMarkerClick={handleMarkerClickToDetail}
                  filterIds={mapFilterIds}
                  fitReq={mapFit}
                />
                <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 flex gap-2 z-20">
                  <span className="backdrop-blur px-3 py-1.5 md:px-4 md:py-2 rounded-full border text-[10px] md:text-xs font-bold flex items-center gap-1.5 md:gap-2 bg-white/80 border-gray-200 text-gray-900 dark:bg-black/60 dark:border-white/10 dark:text-white">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />{' '}
                    {t('bento.live')}
                  </span>
                </div>
              </div>
            </section>

            {/* 지도 아래 지름길 — 실시간 혼잡도(공간) + 팝업 캘린더(시간). 누르면 모달이 열린다.
                최근 본 팝업은 바로 아래 자기 줄에 둔다(같은 묶음이지만 폭이 다르다 — 아래 주석). */}
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 실시간 혼잡도 */}
              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm transition hover:border-primary hover:shadow-md dark:border-white/10 dark:bg-[#111]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-current ${congestionData ? getCongestionColor(congestionData.level) : 'text-green-500'}`}
                    aria-hidden
                  />
                  <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                    {t('tile.congestion')}
                  </span>
                  {congestionData ? (
                    <span className="truncate text-sm text-gray-500 dark:text-white/60">
                      · {fixedRegionLabel('seongsu', locale)}{' '}
                      <span className={`font-bold ${getCongestionColor(congestionData.level)}`}>
                        {congestionData.level}
                      </span>
                    </span>
                  ) : (
                    <span className="hidden truncate text-sm text-gray-500 dark:text-white/60 sm:inline">
                      {t('tile.congestionSub')}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold text-lime-600 dark:text-lime-400 group-hover:underline">
                  {t('tile.congestionCta')}
                </span>
              </button>

              {/* 팝업 캘린더 */}
              <button
                type="button"
                onClick={() => setIsCalendarOpen(true)}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 shadow-sm transition hover:border-primary hover:shadow-md dark:border-white/10 dark:bg-[#111]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Calendar size={16} className="shrink-0 text-primary" aria-hidden />
                  <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
                    {t('tile.calendar')}
                  </span>
                  <span className="hidden truncate text-sm text-gray-500 dark:text-white/60 sm:inline">
                    {t('tile.calendarSub')}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold text-lime-600 dark:text-lime-400 group-hover:underline">
                  {t('tile.calendarCta')}
                </span>
              </button>
            </div>

            {/* 최근 본 팝업 — 위 두 칸과 같은 묶음이지만 <b>줄을 따로 쓴다.</b>
                한 칸에 넣었더니 두 가지가 깨졌다(2026-08-21).
                  1) 펼치면 그리드가 형제 칸 높이를 같이 늘려 혼잡도·캘린더가 빈 상자가 됐다.
                  2) 펼친 목록이 lg:grid-cols-3 인데 부모가 화면의 1/3 이라 항목 하나가 130px 로
                     좁아졌고, 썸네일 68px 를 빼면 글자 자리가 30px 뿐이라 세로로 쪼개졌다.
                접힌 높이는 옆 칸과 같아 한 묶음으로 읽히고, 펼치면 전체 폭을 쓴다.
                본 적이 없으면 스스로 아무것도 그리지 않는다. */}
            <div className="mb-10">
              <RecentVisitsCard standalone />
            </div>

            {/* 홈 하단 발견 존 — POP-ALL 미리보기 + 나의 기록 + 언제 갈까.
                혼잡도는 위 바로, 캘린더·음악은 이 존 제외. */}
            {/* total 은 히어로·POP-LOOK 과 같은 mappablePopupCount 를 쓴다. 예전엔 여기만
                allPopups.length 라 한 화면에서 "전체" 가 1,002 와 850 두 숫자로 나왔고, 정작
                전체보기가 여는 모달은 850 짜리(mappablePopups)였다 — 광고한 수와 여는 수가
                달랐다. */}
            {/* POP-ALL — 폭을 다 쓰는 제 섹션(시안 「POP-ALL 1c 확정」). 줄 진입 애니메이션을
                제 안에서 줄마다 70ms 씩 늦춰 부르므로 여기서 sectionVariants 로 한 번 더 감싸지
                않는다. 두 겹으로 걸면 안쪽 애니메이션이 바깥의 opacity 전환에 묻힌다. */}
            <PopAllPreview
              rows={previewRows}
              total={mappablePopupCount}
              seenIds={seenPopupIds}
              onOpenAll={openPopAll}
              onOpenPopup={(id: number) => {
                saveHomeReturnState();
                router.push(localizedPath(`/popup/${id}`, locale));
              }}
            />

            <HomeBento1a onNavigate={handleTabChange} />

            {/* 최근 오픈한 팝업 — 사진 카드 레일 (디자인 진단서 P0: 팝업 사진 카드로 코어 뷰잉 강화).
                기본 정렬은 최신순(startDate desc) — 정렬 칩으로 인기순·마감임박순도 고를 수 있다. */}
            <motion.section
              id="trending-rail"
              aria-label={t('section.trending')}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={sectionVariants}
              className="mb-16 scroll-mt-24"
            >
              <header className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    {t('section.trending')}
                  </h2>
                  <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                    {t('trending.desc')}
                  </p>
                </div>
                {/* 이 레일의 「전체보기」는 <b>POP-ALL</b> 을 연다. 예전엔 랭킹 모달을 열었는데,
                    레일 제목은 「최근 오픈한 팝업」이고 열리는 화면은 조회수 순위라 이름과 내용이
                    달랐다. 레일이 정렬 칩으로 훑던 것이 바로 전체이므로 이쪽이 이름과 맞는다. */}
                <button
                  type="button"
                  onClick={() => openPopAll()}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  {t('common.viewAll')}
                </button>
              </header>

              {/* 정렬 세그먼트 + 카테고리 필터 (전체 목록 기준) */}
              <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex shrink-0 rounded-full border border-gray-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/5">
                  {(
                    [
                      ['popular', t('sort.popular')],
                      ['deadline', t('sort.deadline')],
                      ['latest', t('sort.latest')],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setRailSort(key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${railSort === key ? 'bg-lime-300 text-ink-900' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {railCategories.length > 0 && (
                  <div className="custom-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {/* 여기 "가을 한정" 칩이 있었다. 판정 기준이 <b>종료일이 이번 계절에 드는가</b>
                        뿐이라, 가을과 아무 상관 없는 팝업도 9월에 끝나면 가을 한정이 됐다 —
                        화면에 적힌 사실 주장이 자주 거짓이었다.

                        고른 목록도 사실상 "이번 계절 안에 마감"이라 옆의 마감임박 정렬과 크게
                        다르지 않았다. 이름만 정직하게 고치면 중복 기능이 하나 남는 셈이라 걷어낸다.
                        진짜 계절 행사 분류는 팝업 이름에서 근거를 찾을 수 있을 때 따로 만든다. */}
                    <button
                      type="button"
                      onClick={() => setRailCat('all')}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${railCat === 'all' ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/60'}`}
                    >
                      {t('filter.all')}
                    </button>
                    {railCategories.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setRailCat(c.code)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${railCat === c.code ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-white/60'}`}
                      >
                        {localizedLabel(c, locale)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {allPopups.length === 0 ? (
                <div className="flex gap-4 overflow-hidden">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-[320px] w-[220px] shrink-0 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5"
                    />
                  ))}
                </div>
              ) : railPopups.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-muted-foreground dark:border-white/10">
                  {t('rail.empty')}
                </p>
              ) : (
                <div className="relative md:px-16">
                  {rail.hasOverflow && (
                    <>
                      <button
                        type="button"
                        aria-label={t('home.railPrev')}
                        onClick={() => rail.scrollByPage(-1)}
                        disabled={rail.atStart}
                        className={`absolute left-1 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-ink-900/90 transition hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/10 md:grid ${rail.atStart ? 'pointer-events-none opacity-0' : ''}`}
                      >
                        <ChevronLeft size={30} strokeWidth={2.5} className="drop-shadow-md" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('home.railNext')}
                        onClick={() => rail.scrollByPage(1)}
                        disabled={rail.atEnd}
                        className={`absolute right-1 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-ink-900/90 transition hover:bg-black/5 dark:text-white/90 dark:hover:bg-white/10 md:grid ${rail.atEnd ? 'pointer-events-none opacity-0' : ''}`}
                      >
                        <ChevronRight size={30} strokeWidth={2.5} className="drop-shadow-md" />
                      </button>
                    </>
                  )}
                  <div
                    ref={rail.ref}
                    {...rail.dragBind}
                    // 좁은 화면에서도 가로로 넘긴다. 예전에는 여기서 1열 세로 목록이었는데,
                    // 30장을 세로로 쌓으면 아래 내용까지 내려가기 전에 스크롤이 너무 길어진다.
                    // 가로 레일이면 한 화면에 두 장 남짓 보이면서 "더 있다" 는 것이 드러난다.
                    className="-mx-1 flex cursor-grab snap-x select-none gap-3 overflow-x-auto px-1 pb-3 sm:gap-4 active:cursor-grabbing"
                  >
                    {railPopups.map((p) => (
                      // flex 자식은 <b>카드가 아니라 이 감싸개</b>다. shrink-0 가 없으면 감싸개가
                      // 눌리는데, 카드는 제 폭을 지키므로 눌린 감싸개 밖으로 삐져나와 서로 겹친다
                      // (2026-08-21에 실제로 발생). 폭도 여기서 정한다 — 카드 안쪽은 w-full 이라
                      // 감싸개를 그대로 따라오고, PopupCard 를 쓰는 다른 화면은 건드리지 않는다.
                      // 168px 은 390px 화면에서 두 장 조금 넘게 보이는 폭이다.
                      <div key={p.id} className="w-[168px] shrink-0 snap-start sm:w-[220px]">
                        <PopupCard
                          popup={p}
                          /*
                           * 이동은 앵커가 한다. 예전엔 onClick 안의 router.push 가 전부였는데,
                           * 그러면 화면은 똑같이 동작해도 <b>주소가 HTML 에 없다</b> — 실측
                           * (2026-08-29) 홈이 내보내는 HTML 의 href="/popup/숫자" 가 0개였다.
                           * 사이트에서 가장 강한 페이지가 상세로 권한을 한 방울도 안 흘렸다.
                           */
                          href={localizedPath(`/popup/${p.id}`, locale)}
                          onClick={() => {
                            // handleTabChange 가 스크롤을 맨 위로 되돌리므로, 저장은 반드시 그 전에.
                            // 여기서 router.push 를 또 하면 앵커와 겹쳐 두 번 이동한다.
                            saveHomeReturnState();
                            handleTabChange('MAP');
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>

            {/* 오늘의 추천 팝업 (구 pop-look) — 랜덤 스톡 영상이 아니라 실제 인기(조회수) 상위를 추천한다. */}
            {featuredPopup && (
              <motion.section
                aria-label={t('home.featuredAria')}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={sectionVariants}
                className="mb-16"
              >
                <header className="flex flex-col md:flex-row items-center md:items-end justify-between mb-6 md:mb-8 text-center md:text-left">
                  <SectionLogo
                    name="pop-look"
                    label="POP-LOOK"
                    className="h-10 md:h-16 relative z-10 text-foreground"
                  />
                  <div className="mt-2 flex flex-col items-center gap-3 md:mt-0 md:items-end">
                    <p className="text-gray-500 dark:text-white/60 max-w-md relative z-10 text-xs md:text-base">
                      {t('poplook.lead')}
                      <br />
                      {t('poplook.sub')}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-foreground shadow-sm transition hover:border-lime-300 hover:bg-lime-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-lime-300/10"
                    >
                      <Store size={14} /> {t('poplook.all')} {mappablePopupCount}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </header>
                {/*
                  높이를 고정하지 않고 <b>최소값</b>으로 둔다.
                  예전엔 lg:h-[440px] 였는데, 그 값은 순위 목록이 3행이던 시절에 맞춘 것이다.
                  행을 7개로 늘리자 내용이 674px 이 되어 234px 이 카드 밖으로 튀어나왔고,
                  아래 섹션 글자와 겹쳐 보였다. 고정 높이는 내용이 늘면 <b>잘리는 게 아니라
                  넘쳐서</b> 다른 것을 덮는다 — overflow 가 visible 이라 잘림 경고도 안 뜬다.
                  1위 카드의 이미지는 object-cover 라 높이가 늘어도 비율이 깨지지 않는다.
                */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 h-auto lg:min-h-[440px]">
                  {/* 1위 히어로 */}
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      // handleTabChange 가 스크롤을 맨 위로 되돌리므로, 저장은 반드시 그 전에.
                      saveHomeReturnState();
                      handleTabChange('MAP');
                      router.push(localizedPath(`/popup/${featuredPopup.id}`, locale));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        saveHomeReturnState();
                        handleTabChange('MAP');
                        router.push(localizedPath(`/popup/${featuredPopup.id}`, locale));
                      }
                    }}
                    className="lg:col-span-1 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-gray-200 dark:border-white/10 group cursor-pointer h-[320px] lg:h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
                  >
                    {popupCoverUrl(featuredPopup) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={popupCoverUrl(featuredPopup) as string}
                        alt={featuredPopup.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-lime-100 via-cream-200 to-amber-100 dark:from-lime-950 dark:via-ink-900 dark:to-amber-950">
                        <Store size={44} className="text-lime-700/40 dark:text-lime-200/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
                    <span className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full bg-hot-400 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                      <Flame size={12} /> {t('poplook.first')}
                    </span>
                    <PhotoDisclosure popup={featuredPopup} className="absolute top-4 right-4" />
                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-pill bg-white/20 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">
                          {categoryLabel(classifyCategory(featuredPopup.category))}
                        </span>
                        {(() => {
                          const d = getDday(featuredPopup.endDate ?? null);
                          return d !== null ? (
                            <span className="rounded-pill bg-lime-300 px-2.5 py-0.5 text-[11px] font-bold text-ink-900">
                              {d === 0 ? t('card.today') : `D-${d}`}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <h3 className="text-2xl lg:text-3xl font-black leading-tight">
                        {featuredPopup.name}
                      </h3>
                      <p className="mt-1.5 flex items-center gap-1 text-sm text-white/85">
                        <MapPin size={14} className="shrink-0" />{' '}
                        {(featuredPopup.location || '').split(' ').slice(0, 2).join(' ') ||
                          t('home.seoul')}
                      </p>
                    </div>
                  </article>
                  {/* 인기 급상승 TOP (2~4위) */}
                  <div className="lg:col-span-2 rounded-[2rem] lg:rounded-[2.5rem] p-5 lg:p-8 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/5 flex flex-col">
                    <p className="mb-3 lg:mb-4 text-sm lg:text-base font-bold text-foreground">
                      {t('poplook.rising')} <span className="text-lime-500">TOP</span>
                    </p>
                    {featuredRunnerUps.length > 0 ? (
                      <div className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
                        {featuredRunnerUps.map((p, i) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              // handleTabChange 가 스크롤을 맨 위로 되돌리므로, 저장은 반드시 그 전에.
                              saveHomeReturnState();
                              handleTabChange('MAP');
                              router.push(localizedPath(`/popup/${p.id}`, locale));
                            }}
                            className="flex items-center gap-3 py-3 -mx-2 rounded-xl px-2 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                          >
                            <span className="w-5 shrink-0 text-center text-lg font-black text-ink-400 dark:text-cream-200/40">
                              {i + 2}
                            </span>
                            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-lime-100 to-amber-100 dark:from-lime-950 dark:to-amber-950">
                              {popupCoverUrl(p) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={popupCoverUrl(p) as string}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Store
                                  size={18}
                                  className="text-lime-700/40 dark:text-lime-200/40"
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <strong className="block truncate text-sm lg:text-base font-bold text-foreground">
                                {p.name}
                              </strong>
                              <span className="block truncate text-xs text-muted-foreground">
                                {(p.location || '').split(' ').slice(0, 2).join(' ') ||
                                  t('home.seoul')}{' '}
                                · {categoryLabel(classifyCategory(p.category))}
                              </span>
                            </div>
                            <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="flex-1 grid place-items-center text-sm text-muted-foreground">
                        {t('poplook.loading')}
                      </p>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Live Chat Ticker Section */}
            <motion.section
              aria-label="Live Community Updates"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={sectionVariants}
              className="mb-16 relative"
            >
              <LiveChatTicker />
              <div className="text-center mt-6 lg:mt-8">
                <p className="text-[10px] lg:text-sm text-gray-500 dark:text-white/40">
                  {t('congestion.note')}
                </p>
              </div>
            </motion.section>

            {/* v2.34 — 기능 소개 개별 섹션 (코스·음악·여권·동행). 각각 다른 무드+비주얼+좌우 교차. */}
            <FeatureSections onNavigate={handleTabChange} />

            {/* 의견 보내기 진입점은 푸터의 '제보하기 · 의견 보내기' 짝으로 옮겼다(2026-08-21).
                v2.28 에서 여기에 전체폭 카드를 놓은 이유는 게스트가 의견 낼 곳을 못 찾아서였는데,
                그 해결책이 하단에 성격이 다른 카드 세 장(의견·최근 본 팝업·탐색 링크)을 쌓는
                결과를 낳았다. 푸터에서 제보와 나란히 두면 "사용자가 우리에게 보내는 것" 두 개가
                한자리에 모여 찾기도 쉽고 하단도 정리된다. */}

            {/* (구) 협업 프로모 — FeatureSections 로 대체됨(주석 유지 시 아래 미사용 블록 제거 필요) */}
            <motion.section
              aria-label="Feature Promotion"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={sectionVariants}
              className="hidden py-12 px-6 lg:py-20 lg:px-12 bg-ink-900 text-cream-200 relative overflow-hidden rounded-xl lg:rounded-2xl shadow-pop"
            >
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 relative z-10">
                <div className="flex-1 text-center lg:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-lime-300/15 border border-lime-300/40 text-lime-300 text-[10px] lg:text-xs font-semibold tracking-wide mb-4 lg:mb-6">
                    <Users size={12} className="lg:w-4 lg:h-4" /> {t('collab.badge')}
                  </div>
                  <h2 className="text-2xl md:text-4xl lg:text-5xl font-black mb-4 lg:mb-6 leading-tight">
                    {t('collab.lead')}
                    <br />
                    <span className="text-lime-300">{t('collab.title')}</span>
                  </h2>
                  <p className="text-gray-400 text-xs lg:text-lg mb-6 lg:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
                    {t('collab.desc1')}
                    <br />
                    {t('collab.desc2')}
                    <br className="hidden lg:block" />
                  </p>
                  <button
                    onClick={handleCreateRoom}
                    className="group relative inline-flex items-center justify-center px-6 py-3 lg:px-8 lg:py-4 font-semibold text-ink-900 transition-colors bg-lime-300 hover:bg-lime-400 rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-sm lg:text-base w-full lg:w-auto"
                  >
                    <span className="mr-2">{t('collab.cta')}</span>
                    <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 transition-transform group-hover:translate-x-1" />
                    <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                  </button>
                </div>

                <div className="flex-1 w-full max-w-sm lg:max-w-md hidden md:block">
                  <div className="relative bg-ink-800 border border-ink-700 rounded-xl p-5 lg:p-6 shadow-pop">
                    {/* 협업 도구 미리보기: 점선 경로 + 실제 지명 핀 */}
                    <div
                      className="relative w-full h-48 lg:h-56 rounded-lg overflow-hidden bg-ink-900 border border-ink-700"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle, rgba(245,243,238,0.06) 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                      }}
                      aria-hidden
                    >
                      {/* 점선 SVG 경로: 성수 → 한남 → 압구정 */}
                      <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 320 224"
                        preserveAspectRatio="none"
                      >
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
                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">
                          {fixedRegionLabel('seongsu', locale)}
                        </span>
                      </div>

                      {/* 핀 2 — 한남 (현재 편집 중인 위치) */}
                      <div className="absolute top-[44%] left-[48%] flex items-center gap-1.5">
                        <span className="relative flex items-center justify-center">
                          <span className="absolute w-5 h-5 rounded-full bg-hot-400/40 animate-ping" />
                          <span className="relative w-3 h-3 rounded-full bg-hot-400 ring-2 ring-ink-900" />
                        </span>
                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">
                          {fixedRegionLabel('hannam', locale)}
                        </span>
                      </div>

                      {/* 핀 3 — 압구정 */}
                      <div className="absolute bottom-[12%] right-[8%] flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-cream-200 bg-ink-900/80 px-1.5 py-0.5 rounded">
                          {fixedRegionLabel('apgujeong', locale)}
                        </span>
                        <span className="w-3 h-3 rounded-full bg-cream-200 ring-2 ring-ink-900" />
                      </div>

                      {/* 친구의 동시 편집 커서 */}
                      <div className="absolute top-[35%] left-[55%] pointer-events-none">
                        <svg
                          width="14"
                          height="18"
                          viewBox="0 0 14 18"
                          fill="none"
                          className="drop-shadow-md"
                        >
                          <path
                            d="M0 0 L 0 14 L 4 11 L 7 17 L 9 16 L 6 10 L 11 10 Z"
                            fill="#FFC107"
                            stroke="#0a0a0a"
                            strokeWidth="0.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="ml-3 mt-0 px-1.5 py-0.5 bg-amber-400 text-ink-900 text-[9px] font-bold rounded whitespace-nowrap">
                          {locale === 'en' ? 'Minji' : locale === 'ja' ? 'ミンジ' : '민지'}
                        </div>
                      </div>
                    </div>

                    {/* 하단: 다음 후보지 메타 */}
                    <div className="mt-4 flex items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
                        <span className="text-[11px] text-cream-200/70">{t('collab.editing')}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cream-200/40">
                        3 stops · 1.2km
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {/* TAB: PASSPORT */}
        {currentTab === 'PASSPORT' && (
          <motion.section
            aria-label="Digital Passport"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 shadow-md"
          >
            {/* 여권은 게스트/비로그인도 열람 가능(빈 여권으로). 스탬프 적립은 방문 인증 시 로그인 유도. */}
            <PassportView />
          </motion.section>
        )}

        {/* TAB: MUSIC */}
        {currentTab === 'MUSIC' && (
          <motion.section
            aria-label="Music to Popup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16 rounded-xl border border-[var(--color-border)] bg-surface p-4 lg:p-6"
          >
            <MusicTab
              popups={allPopups}
              onOpenPopup={(id) => {
                // handleTabChange 가 스크롤을 맨 위로 되돌리므로, 저장은 반드시 그 전에.
                saveHomeReturnState();
                handleTabChange('MAP');
                router.push(localizedPath(`/popup/${id}`, locale));
              }}
            />
          </motion.section>
        )}

        {/* TAB: COURSE */}
        {currentTab === 'COURSE' && (
          <motion.section
            aria-label="AI Course Generator"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-[60vh] flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 p-4 lg:p-6 relative overflow-hidden"
          >
            <header className="text-center mb-8 lg:mb-10 z-10 mt-6 lg:mt-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill border border-lime-300/40 bg-lime-300/10 text-lime-500 text-[10px] lg:text-xs font-semibold tracking-wide mb-4">
                <Sparkles size={10} className="lg:w-3 lg:h-3" /> AI CURATION · BETA
              </div>
              <h2 className="font-display-en text-2xl md:text-4xl lg:text-5xl font-extrabold tracking-tighter mb-2 text-foreground">
                POP<span className="text-lime-300">-</span>COURSE
              </h2>
              <p className="text-muted-foreground text-sm">{t('course.moodHint')}</p>
            </header>

            <div className="w-full max-w-3xl z-10 mb-8 lg:mb-12 flex flex-col gap-3 lg:gap-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 px-2 lg:px-0">
                {/* val 은 AI 에 그대로 넘어가는 검색어라 한국어로 고정한다 — 화면 문구만 옮긴다. */}
                {[
                  { val: '핫플', no: '01', label: 'mood.hot', icon: Flame },
                  { val: '데이트', no: '02', label: 'mood.date', icon: Heart },
                  { val: '사진', no: '03', label: 'mood.photo', icon: Camera },
                  { val: '힐링', no: '04', label: 'mood.heal', icon: Coffee },
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
                                            ? 'bg-lime-300 border-lime-400 text-ink-900 shadow-md'
                                            : 'bg-cream-100 dark:bg-ink-600 text-foreground border-[var(--color-border)] hover:border-lime-300/60'
                                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`font-mono text-[11px] tracking-[0.2em] ${active ? 'text-ink-900/60' : 'text-muted-foreground'}`}
                        >
                          No. {item.no}
                        </span>
                        <Icon
                          className={`size-5 transition-colors ${active ? 'text-ink-900' : 'text-foreground/40 group-hover:text-lime-500'}`}
                          aria-hidden
                          strokeWidth={1.6}
                        />
                      </div>

                      <div>
                        <div
                          className={`text-base lg:text-lg font-bold leading-tight ${active ? 'text-ink-900' : 'text-foreground'}`}
                        >
                          {t(`${item.label}Label` as MessageKey)}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${active ? 'text-ink-900/70' : 'text-muted-foreground'}`}
                        >
                          {t(`${item.label}Desc` as MessageKey)}
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
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="text-sm flex items-center gap-2 transition-colors border-b border-transparent pb-1 text-muted-foreground hover:text-lime-500 hover:border-lime-500"
                  >
                    <Sparkles size={12} className="lg:w-3.5 lg:h-3.5" /> {t('course.customAsk')}
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex w-full max-w-md gap-2"
                  >
                    <input
                      type="text"
                      value={customVibeInput}
                      onChange={(e) => setCustomVibeInput(e.target.value)}
                      placeholder={t('home.vibePlaceholder')}
                      className="flex-1 h-11 rounded-md px-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-surface border border-[var(--color-border-strong)] text-foreground placeholder:text-muted-foreground text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleAiRecommend(customVibeInput)}
                    />
                    <button
                      onClick={() => handleAiRecommend(customVibeInput)}
                      className="bg-lime-300 hover:bg-lime-400 text-ink-900 px-4 lg:px-6 rounded-pill font-semibold transition-colors text-xs lg:text-sm whitespace-nowrap"
                    >
                      {t('course.recommend')}
                    </button>
                    <button
                      onClick={() => setShowCustomInput(false)}
                      className="size-11 inline-flex items-center justify-center rounded-md transition-colors bg-cream-300 dark:bg-ink-700 hover:bg-cream-400 dark:hover:bg-ink-600 text-muted-foreground flex-shrink-0"
                    >
                      <X size={16} className="lg:w-[18px] lg:h-[18px]" />
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="w-full max-w-3xl z-10 min-h-[300px] px-2 lg:px-0">
              <header className="flex items-center justify-between mb-4 lg:mb-6">
                <h3 className="font-bold text-base lg:text-lg flex items-center gap-2 text-foreground">
                  {isAiLoading ? (
                    <Loader2 className="animate-spin text-lime-500 w-4 h-4 lg:w-5 lg:h-5" />
                  ) : (
                    <Route size={16} className="text-lime-500 lg:w-5 lg:h-5" />
                  )}
                  {isAiLoading
                    ? t('home.aiBuilding')
                    : aiCourse.length > 0
                      ? 'AI RECOMMENDED COURSE'
                      : t('home.pickMood')}
                </h3>
                {aiCourse.length > 0 && !isAiLoading && (
                  <button
                    onClick={handleResetCourse}
                    className="text-xs flex items-center gap-1 transition-colors text-muted-foreground hover:text-danger"
                  >
                    <RefreshCw size={10} className="lg:w-3 lg:h-3" /> {t('course.reset')}
                  </button>
                )}
              </header>

              {!isAiLoading && aiCourse.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-5 lg:p-8 border border-[var(--color-border)] relative overflow-hidden bg-surface shadow-md"
                >
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6 lg:mb-8">
                      <div>
                        <span className="text-[9px] lg:text-xs font-bold tracking-wider text-ink-900 bg-lime-300 px-2.5 py-1 rounded-pill mb-2 lg:mb-3 inline-block">
                          FOR YOU
                        </span>
                        <h4 className="text-xl lg:text-2xl font-bold text-foreground">
                          {t('home.seoul')} <span className="text-hot-500">{selectedVibe}</span>{' '}
                          {t('course.title')}
                        </h4>
                        <p className="text-muted-foreground text-sm mt-1">{t('course.desc')}</p>
                      </div>
                    </div>

                    {/* 동선 지도 — 카카오맵 링크 대신 앱 안에서 경로(showPath)를 그려 보여준다. */}
                    <div className="mb-6 h-[280px] overflow-hidden rounded-2xl border border-[var(--color-border)] lg:h-[340px]">
                      <InteractiveMap
                        places={aiCourse}
                        showPath
                        center={
                          aiCourse[0] ? { lat: aiCourse[0].lat, lng: aiCourse[0].lng } : undefined
                        }
                      />
                    </div>

                    <div className="space-y-4 lg:space-y-6">
                      {aiCourse.map((item, idx) => (
                        <article key={idx} className="flex gap-3 lg:gap-4 group/item">
                          <div className="flex flex-col items-center">
                            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-pill bg-ink-900 dark:bg-cream-200 flex items-center justify-center text-xs lg:text-sm font-bold text-cream-200 dark:text-ink-900 z-10">
                              {idx + 1}
                            </div>
                            {idx < aiCourse.length - 1 && (
                              <div className="w-px flex-1 my-1 lg:my-2 bg-[var(--color-border-strong)]" />
                            )}
                          </div>
                          <button
                            type="button"
                            className="flex-1 pb-4 text-left lg:pb-6"
                            onClick={() => {
                              saveHomeReturnState();
                              router.push(localizedPath(`/popup/${item.id}`, locale));
                            }}
                          >
                            <div className="p-4 rounded-md border border-[var(--color-border)] transition-colors bg-cream-300 dark:bg-ink-800 hover:border-lime-300/60">
                              <div className="flex justify-between items-center mb-1">
                                <h5 className="font-bold text-sm lg:text-base text-foreground">
                                  {item.name}
                                </h5>
                                <ArrowRight
                                  size={14}
                                  className="lg:w-4 lg:h-4 text-muted-foreground"
                                />
                              </div>
                              <p className="text-sm mb-2 text-muted-foreground line-clamp-2 italic">
                                &ldquo;{item.reason}&rdquo;
                              </p>
                              <div className="flex gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-pill bg-surface border border-[var(--color-border)] text-muted-foreground">
                                  POP-UP
                                </span>
                              </div>
                            </div>
                          </button>
                        </article>
                      ))}
                    </div>

                    <div className="mt-4 lg:mt-6">
                      <button
                        onClick={handleSaveAiCourse}
                        className="flex w-full items-center justify-center gap-2 rounded-pill bg-lime-300 py-3.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-lime-400 lg:text-base"
                      >
                        <Ticket size={16} /> {t('course.save')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.section>
        )}

        {/* TAB: MY */}
        {currentTab === 'MY' && (
          <motion.section
            aria-label={t('home.myTabAria')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mb-16 max-w-3xl"
          >
            {/* '기록' 대시보드 — 개선안: 코스 지도 제거, 전체폭 세로 대시보드(프로필·통계·등급·찜·최근 방문). */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface text-surface-foreground shadow-md">
              {/* v2.15.3 — 내 계정: 회원이름 / 이메일 / 프로필 사진 노출. 네이버/카카오/구글
                        OAuth 검수 활용처 증명에 사용되며, 사용자도 "내 정보" 를 한 눈에 확인.
                        v2.17 — 회원 탈퇴 버튼 추가 (PIPA 의무). */}
              <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <UserIcon size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" />{' '}
                  {t('my.account')}
                </h3>
                <div className="flex items-center gap-4 p-3 lg:p-4 rounded-md border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800">
                  {user?.picture ? (
                    <Image
                      src={user.picture}
                      alt={t('home.profilePhotoAlt')}
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
                      {user?.nickname || t('home.memberFallback')}
                    </p>
                    <p className="text-xs lg:text-sm text-muted-foreground truncate mt-0.5">
                      {user?.email || t('home.noEmail')}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleTabChange('FEEDBACK')}
                    className="text-xs font-semibold text-lime-600 dark:text-lime-400 underline-offset-2 hover:underline transition-colors"
                  >
                    {t('my.feedback')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="text-xs text-muted-foreground hover:text-danger underline-offset-2 hover:underline transition-colors"
                  >
                    {t('my.withdraw')}
                  </button>
                </div>
              </div>

              {/* Activity Dashboard */}
              <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <UserIcon size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" />{' '}
                  {t('my.activity')}
                </h3>
                <div className="grid grid-cols-3 gap-2 lg:gap-3">
                  <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                    <Heart size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-red-500" />
                    <div className="text-2xl font-extrabold text-foreground">
                      {/* 비회원의 찜은 서버가 모른다(myPageInfo 는 로그인해야 채워진다).
                          아래 목록에는 2개가 떠 있는데 여기만 0 이면 화면이 스스로 모순된다. */}
                      {(user ? myPageInfo?.likeCount : myWishlist.length) || 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('my.wishlist')}</div>
                  </div>
                  <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                    <Ticket size={16} className="lg:w-5 lg:h-5 mx-auto mb-1 text-lime-500" />
                    <div className="text-2xl font-extrabold text-foreground">
                      {myPageInfo?.stampCount || 0}
                      <span className="text-sm text-muted-foreground font-normal">/12</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('my.stamps')}</div>
                  </div>
                  <div className="bg-cream-300 dark:bg-ink-800 p-4 rounded-md text-center border border-[var(--color-border)]">
                    <MessageCircle
                      size={16}
                      className="lg:w-5 lg:h-5 mx-auto mb-1 text-green-500"
                    />
                    <div className="text-2xl font-extrabold text-foreground">
                      {myPageInfo?.reviewCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t('my.reviews')}</div>
                  </div>
                </div>
              </div>

              {/* 등급 진열 카드 — 스탬프 누적량에 따른 등급 + 다음 단계 진행도 */}
              <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <Star size={16} className="lg:w-[18px] lg:h-[18px] text-amber-500" />{' '}
                  {t('my.grade')}
                </h3>
                <RankCard
                  stampCount={myPageInfo?.stampCount || 0}
                  nickname={user?.nickname}
                  onSeeAll={() => handleTabChange('PASSPORT')}
                />
              </div>

              {/* v2.18 — 최근 본 팝업 (localStorage 기반, 최대 30개). 게스트/회원 무관. */}
              <RecentVisitsCard />

              {/* 옛 inventory 컨테이너 — 보존 (혹시 후속 카드 추가 시 재사용) */}
              <div className="hidden"></div>

              {/* Wishlist */}
              <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <Heart size={16} className="lg:w-[18px] lg:h-[18px] text-hot-400" />{' '}
                  {t('my.wishlist')}
                </h3>
                {myWishlist.length === 0 && guestLeftover > 0 ? (
                  /*
                   * 목록은 비었는데 저장소에는 남아 있다 — "없습니다" 는 거짓말이다.
                   *
                   * 여기서 두 가지를 구분한다. 이전이 아직 한 바퀴도 안 돌았으면 진행 중이고,
                   * 돌았는데도 남았으면 못 옮긴 것이다. 뒤쪽에는 다시 시도할 방법을 준다 —
                   * 자동 재시도는 경로가 바뀔 때만 오는데 로그인 착지점인 홈에서는 탭을 아무리
                   * 눌러도 경로가 안 바뀌어, 버튼이 없으면 사용자가 할 수 있는 것이 없다.
                   */
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-[var(--color-border-strong)] rounded-md">
                    {!migrationSettled ? (
                      t('wish.migrating')
                    ) : (
                      <>
                        {t('wish.stuck').replace('{count}', String(guestLeftover))}
                        <br />
                        {t('wish.stuckHint')}
                        <br />
                        <button
                          type="button"
                          onClick={handleRetryMigration}
                          className="mt-3 px-3 py-1.5 rounded-md border border-[var(--color-border-strong)] text-foreground text-xs font-semibold hover:bg-[var(--color-surface-2)] disabled:opacity-50"
                          disabled={retryingMigration}
                        >
                          {t('wish.retry')}
                        </button>
                      </>
                    )}
                  </div>
                ) : myWishlist.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-[var(--color-border-strong)] rounded-md">
                    {t('wish.empty')}
                    <br />
                    {t('wish.emptyHint')}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 lg:gap-3">
                    {myWishlist.map((item, i) => (
                      <div
                        key={i}
                        className="relative rounded-md overflow-hidden aspect-video group cursor-pointer border border-[var(--color-border)] bg-cream-300 dark:bg-ink-800"
                      >
                        <PopupCoverVisual
                          popup={{ id: item.popupId, imageUrl: item.popupImage }}
                          name={item.popupName}
                          location={item.location}
                          compact
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/30 to-transparent flex flex-col justify-end p-3">
                          <span className="text-cream-200 text-xs font-semibold truncate">
                            {item.popupName}
                          </span>
                          <span className="text-cream-200/70 text-[10px] truncate mt-0.5">
                            {item.location}
                          </span>
                        </div>

                        <button
                          onClick={(e) => handleRemoveWishlist(e, item.popupId)}
                          className="absolute top-2 right-2 bg-ink-900/60 backdrop-blur rounded-pill p-1.5 text-hot-400 hover:bg-hot-400 hover:text-white transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          title={t('home.wishRemove')}
                        >
                          <Heart size={10} className="lg:w-3 lg:h-3 fill-current" />
                        </button>

                        <Link
                          href={localizedPath(`/popup/${item.popupId}`, locale)}
                          className="absolute inset-0 z-0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Saved Courses History */}
              <div className="p-4 lg:p-6 border-b border-[var(--color-border)]">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <FolderOpen size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" />{' '}
                  {t('course.saved')}
                </h3>

                {savedCourses.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    {t('course.empty')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedCourses.map((course: SavedCourse, idx: number) => (
                      <article
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-md border bg-cream-300 dark:bg-ink-800 border-[var(--color-border)] hover:border-lime-300/60 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        onClick={() => handleLoadCourse(course.courseData)}
                      >
                        <div className="flex items-center gap-2 lg:gap-3">
                          <div className="w-8 h-8 rounded-pill bg-lime-300/15 flex items-center justify-center text-lime-700 dark:text-lime-300 font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              {course.courseName}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t('course.loadHint')}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteCourse(e, course.id)}
                          className="p-2 text-muted-foreground hover:text-danger transition-colors rounded-pill hover:bg-hot-400/10"
                          title={t('home.delete')}
                        >
                          <Trash2 size={14} className="lg:w-4 lg:h-4" />
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
                    <MessageCircle size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" />{' '}
                    {t('feedback.mine')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange('FEEDBACK')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('feedback.viewAll')}
                  </button>
                </div>
                <MyFeedbackList
                  userId={user?.userId ?? null}
                  limit={3}
                  emptyText={t('home.feedbackEmpty')}
                />
              </div>

              {/* Current Editing Course (DND) */}
              <div className="p-4 lg:p-6">
                <h3 className="text-base lg:text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
                  <Route size={16} className="lg:w-[18px] lg:h-[18px] text-lime-500" /> Current Plan
                </h3>

                {myCourseItems.length === 0 && (
                  <div className="text-center text-muted-foreground py-6 border border-dashed border-[var(--color-border-strong)] rounded-md mb-4 text-sm">
                    {t('course.editingEmpty')}
                    <br />
                    {t('course.editingHint')}
                  </div>
                )}

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={myCourseItems} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {myCourseItems.map((place, index) => (
                        <div key={place.id} className="relative group">
                          <SortableItem id={place.id} place={place} index={index} />
                          <button
                            aria-label={t('home.placeRemove')}
                            onClick={() => {
                              const newItems = myCourseItems.filter((i) => i.id !== place.id);
                              setMyCourseItems(newItems);
                            }}
                            className="absolute -top-2 -right-2 bg-hot-400 text-white p-1 rounded-pill opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-md"
                            title={t('home.delete')}
                          >
                            <X size={10} className="lg:w-3 lg:h-3" />
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
                  <PlusCircle size={14} className="lg:w-4 lg:h-4" /> {t('course.addPlace')}
                </button>

                <button
                  onClick={handleSaveCourse}
                  className="w-full py-3 lg:py-4 mt-4 bg-ink-900 hover:bg-ink-700 text-cream-200 font-semibold rounded-pill shadow-md transition-colors active:scale-[0.98] flex items-center justify-center gap-2 dark:bg-cream-200 dark:text-ink-900 dark:hover:bg-cream-300 text-sm lg:text-base"
                >
                  <Save size={14} className="lg:w-[18px] lg:h-[18px]" />{' '}
                  <span>{t('course.saveCurrent')}</span>
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

        {/* TAB: SCHEDULE — 동행이 있던 자리. 전체 팝업 달력이라 비로그인도 그대로 쓴다. */}
        {currentTab === 'SCHEDULE' && (
          <motion.section
            aria-label={t('dock.schedule')}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface p-4 text-surface-foreground mb-16 relative overflow-hidden shadow-md md:p-6"
          >
            <MySchedule popups={allPopups} />
            <h3 className="mb-3 text-base font-bold text-foreground lg:text-lg">
              {t('sched.allTitle')}
            </h3>
            <PopupCalendar popups={catalogPopups} />
          </motion.section>
        )}

        {/* TAB: FEEDBACK (v2.12) — 게스트도 진입 가능. /feedback 페이지와 동일 컴포넌트 재사용. */}
        {currentTab === 'FEEDBACK' && (
          <motion.section
            aria-label="Feedback"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-[60vh] rounded-xl border border-[var(--color-border)] bg-surface text-surface-foreground mb-16 p-4 lg:p-6 shadow-md"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-foreground">{t('feedback.title')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('feedback.desc')}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="rounded-lg border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 p-5">
                  <h3 className="mb-4 text-base font-semibold text-foreground">
                    {t('feedback.new')}
                  </h3>
                  <FeedbackForm userId={user?.userId ?? null} />
                </div>
              </div>
              <aside className="lg:col-span-2">
                <div className="rounded-lg border border-[var(--color-border-strong)] bg-cream-300 dark:bg-ink-800 p-5">
                  <h3 className="mb-4 text-base font-semibold text-foreground">
                    {t('feedback.mine')}
                  </h3>
                  <MyFeedbackList userId={user?.userId ?? null} />
                </div>
              </aside>
            </div>
          </motion.section>
        )}
      </div>

      {currentTab === 'MAP' && <SeoLandingDirectory />}

      <Footer onReportClick={() => setIsReportPopupOpen(true)} />

      {/* Navigation Dock */}
      <BottomDock currentTab={currentTab as DockTab} onTabChange={(t) => handleTabChange(t)} />

      {/* Modals — 새 Dialog 컴포넌트(Radix) 사용. 포커스 트랩·ESC·스크롤 잠금 자동. */}
      {/* 랭킹 모달도 같은 풀({@code popAllPopups})을 쓴다 — 이걸 여는 POP-LOOK 버튼이
          {@code mappablePopupCount} 를 광고하기 때문이다. 다른 풀을 넘기면 "전체 N곳" 이라고
          적힌 버튼이 N보다 많은 카드를 여는 옛 버그가 그대로 되살아난다. */}
      <AllTrendingModal open={isModalOpen} onOpenChange={setIsModalOpen} popups={popAllPopups} />

      <PopAllModal
        open={popAllOpen}
        onOpenChange={setPopAllOpen}
        popups={popAllPopups}
        initialCategory={popAllCategory}
      />
      <ReportPopupModal open={isReportPopupOpen} onOpenChange={setIsReportPopupOpen} />
      <GlobalSearchModal
        open={isGlobalSearchOpen}
        onOpenChange={setIsGlobalSearchOpen}
        popups={allPopups}
      />
      <OnboardingModal />
      <NotificationCenter open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen} />
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
            localStorage.setItem('user', JSON.stringify(updated));
          }}
        />
      )}
      <PopupCalendarModal
        open={isCalendarOpen}
        onOpenChange={setIsCalendarOpen}
        popups={catalogPopups}
      />

      {/* AI Report — 기존 컴포넌트는 자체 모달 구조 유지 */}
      <AnimatePresence>
        {isReportOpen && congestionData && (
          <AIReportModal data={congestionData} onClose={() => setIsReportOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}

/**
 * v2.18 — 최근 본 팝업 카드. localStorage 기반이라 회원/게스트 무관 표시.
 *
 * <p>본 컴포넌트는 mount 시점에 localStorage 를 한 번만 읽어 가벼움. 다른 페이지에서 팝업 상세 진입하면
 * 자동으로 기록되고, 사용자가 홈이나 MY 탭으로 돌아오면 다음 mount 에 갱신.
 */
/**
 * 최근 본 팝업 한 장에 몇 개를 놓을지.
 *
 * <p>여섯이면 넓은 화면에서 3열 × 2줄, 좁은 화면에서 6줄이라 지금까지 보이던 분량과 같다.
 * 기록은 이제 밀려나지 않고 쌓이므로 장 수는 본 만큼 늘어난다.
 */
const RECENT_PAGE_SIZE = 6;

/**
 * "언제 봤는지" 를 화면 언어로 옮긴다.
 *
 * <p>판단은 {@link visitedAgo} 가 이미 끝냈고 여기서는 말만 고른다. 이 카드가 사전 대신 인라인
 * 삼항으로 문구를 고르는 파일이라 그 관례를 따른다 — 알약 하나 때문에 사전에 키 넉 장을 세 언어로
 * 심는 것보다, 판단과 표기를 갈라 둔 편이 읽기 쉽다.
 */
function visitedAgoLabel(ago: VisitedAgo | null, locale: Locale): string | null {
  if (!ago) return null;
  if (ago.kind === 'today') return locale === 'en' ? 'Today' : locale === 'ja' ? '今日' : '오늘';
  if (ago.kind === 'yesterday')
    return locale === 'en' ? 'Yesterday' : locale === 'ja' ? '昨日' : '어제';
  if (ago.kind === 'days')
    return locale === 'en'
      ? `${ago.days} days ago`
      : locale === 'ja'
        ? `${ago.days}日前`
        : `${ago.days}일 전`;
  return locale === 'en'
    ? `${ago.month}/${ago.day}`
    : locale === 'ja'
      ? `${ago.month}月${ago.day}日`
      : `${ago.month}월 ${ago.day}일`;
}

function RecentVisitsCard({ standalone = false }: { standalone?: boolean } = {}) {
  const { t, locale } = useLocale();
  /**
   * 홈에서는 접은 채로 시작한다.
   *
   * <p>MY 탭은 자기 기록을 보러 오는 화면이라 펼쳐 두는 것이 맞다. 홈은 <b>새 팝업을 찾는</b>
   * 화면인데, 방문자의 75.7% 가 쓰는 좁은 화면에서 썸네일 여섯 장이 펼쳐지면 그만큼 아래 내용이
   * 밀린다. 홈에서는 "최근 본 것이 있다" 는 사실만 한 줄로 알리고, 볼 사람이 펼치게 한다.
   */
  const [isExpanded, setIsExpanded] = useState(!standalone);
  const [page, setPage] = useState(0);
  const [visits, setVisits] = useState<
    Array<{ popupId: number; popupName: string; popupImage?: string; visitedAt: string }>
  >([]);

  useEffect(() => {
    import('@/lib/recentVisits')
      .then(({ readVisits }) => setVisits(readVisits()))
      .catch(() => setVisits([]));
  }, []);

  /**
   * 지운 뒤에는 <b>여기서 다시 읽는다.</b>
   *
   * <p>{@code recentVisits} 는 알림({@code notifications.ts})과 달리 바뀌었다는 신호를 쏘지 않는다.
   * 그래서 지우기만 하고 상태를 그대로 두면 저장소에서는 사라진 항목이 화면에는 남는다. 지운
   * 결과를 되읽는 것이 이 모듈과 약속된 방식이다.
   */
  const handleRemove = (popupId: number) => {
    import('@/lib/recentVisits')
      .then(({ removeVisit, readVisits }) => {
        removeVisit(popupId);
        setVisits(readVisits());
      })
      .catch(() => {
        /* 지우기 실패는 무시 — 목록은 그대로 남는다 */
      });
  };

  const handleClearAll = () => {
    // 되돌릴 수 없는 데다 한 번의 오조작으로 몇 달치가 사라진다. 네이티브 확인창이 투박해도
    // 이 자리에서는 맞다 — 없는 것보다 낫고, 이것 때문에 별도 모달을 들일 만한 일도 아니다.
    const question =
      locale === 'en'
        ? 'Delete all recently viewed pop-ups? This cannot be undone.'
        : locale === 'ja'
          ? '最近見たポップアップをすべて削除しますか？元に戻せません。'
          : '최근 본 팝업을 모두 지울까요? 되돌릴 수 없습니다.';
    if (typeof window !== 'undefined' && !window.confirm(question)) return;
    import('@/lib/recentVisits')
      .then(({ clearVisits, readVisits }) => {
        clearVisits();
        setVisits(readVisits());
      })
      .catch(() => {
        /* 지우기 실패는 무시 */
      });
  };

  if (visits.length === 0) return null;

  /*
   * 개수는 <b>저장된 전부</b>를 센다.
   *
   * 예전에는 여섯 개로 자른 뒤 그 자른 목록의 길이를 적었다. 그래서 여섯을 넘긴 사람에게는
   * 아무리 더 봐도 "6개" 로 굳어, 기록이 안 되는 것처럼 보였다 — 실제로는 최신 항목이 맨 앞으로
   * 잘 들어오고 있었고 숫자만 거짓말을 하고 있었다. 나머지는 이제 장을 넘겨 본다.
   */
  const pageCount = Math.ceil(visits.length / RECENT_PAGE_SIZE);
  // 목록이 줄어든 뒤에도 예전 page 가 남아 빈 장을 그리지 않게 막는다.
  const safePage = Math.min(page, pageCount - 1);
  const visibleVisits = visits.slice(
    safePage * RECENT_PAGE_SIZE,
    (safePage + 1) * RECENT_PAGE_SIZE,
  );
  const itemCountLabel =
    locale === 'en'
      ? `${visits.length} viewed`
      : locale === 'ja'
        ? `${visits.length}件`
        : `${visits.length}개`;
  const toggleLabel = isExpanded
    ? locale === 'en'
      ? 'Collapse recently viewed pop-ups'
      : locale === 'ja'
        ? '最近見たポップアップを閉じる'
        : '최근 본 팝업 접기'
    : locale === 'en'
      ? 'Expand recently viewed pop-ups'
      : locale === 'ja'
        ? '最近見たポップアップを開く'
        : '최근 본 팝업 펼치기';

  const handleToggle = () => {
    setIsExpanded((current) => !current);
    // 접었다 다시 펴면 첫 장부터. 세 번째 장을 보다 접은 사람이 다시 열었을 때 거기서
    // 시작하면, 맨 앞에 있어야 할 최신 항목이 안 보인다.
    setPage(0);
  };

  return (
    <div
      // standalone 은 세로 여백을 최소로 둔다. 안쪽 토글이 이미 min-h-11(44px) 로 손가락 목표를
      // 확보하고 있어서, 바깥에서 여백을 더 주면 옆 타일(50px)보다 혼자 커진다.
      className={`${standalone ? 'px-5 py-1' : 'px-4 py-3 lg:px-6 lg:py-4'} ${
        standalone
          ? 'rounded-2xl border border-[var(--color-border)] bg-white/90 shadow-sm dark:bg-[#111]/90'
          : 'border-b border-[var(--color-border)]'
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={toggleLabel}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left outline-none transition-colors hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-lime-500/70 dark:hover:bg-white/[0.05] ${
          isExpanded ? 'mb-3' : ''
        }`}
      >
        {/* 홈(standalone)에서는 옆 타일(혼잡도·캘린더)과 같은 한 줄 꼴로 맞춘다. 두 줄짜리 제목에
            동그란 아이콘까지 쓰면 좁은 화면에서 이 칸만 40% 높아져 혼자 튄다. 넓은 화면은 그리드가
            높이를 맞춰 주므로 차이가 안 보이지만, 세로로 쌓이는 모바일에서는 그대로 드러난다.
            MY 탭은 자기 기록을 보는 화면이라 기존의 큰 제목을 유지한다. */}
        {standalone ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Clock size={16} className="shrink-0 text-lime-500" aria-hidden />
            <span className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
              {t('recent.title')}
            </span>
            <span className="truncate text-sm text-gray-500 dark:text-white/60">
              · {itemCountLabel}
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2.5 text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-500/10">
              <Clock size={17} className="text-lime-500" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold leading-tight lg:text-lg">
                {t('recent.title')}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                {itemCountLabel}
              </span>
            </span>
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1.5 pr-1 text-xs font-semibold text-muted-foreground">
          <span>
            {isExpanded
              ? locale === 'en'
                ? 'Hide'
                : locale === 'ja'
                  ? '閉じる'
                  : '접기'
              : locale === 'en'
                ? 'Show'
                : locale === 'ja'
                  ? '開く'
                  : '펼치기'}
          </span>
          <ChevronRight
            size={18}
            aria-hidden="true"
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </span>
      </button>

      {isExpanded && (
        <div
          className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${standalone ? 'lg:grid-cols-3' : ''}`}
        >
          {visibleVisits.map((v) => (
            // 지우기 버튼은 링크 <b>안</b>에 넣을 수 없다 — a 안의 button 은 잘못된 마크업이고,
            // 누를 때마다 상세로 떠나 버린다. 형제로 두고 위에 얹는다.
            <div key={v.popupId} className="relative">
              <Link
                href={localizedPath(`/popup/${v.popupId}`, locale)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-cream-300/70 p-2 pr-9 transition-colors hover:border-lime-400/60 hover:bg-lime-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/70 dark:bg-ink-800/75 dark:hover:bg-lime-950/30"
              >
                <span className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-cream-300 dark:bg-ink-800 sm:h-[72px] sm:w-[72px]">
                  <PopupCoverVisual
                    popup={{ id: v.popupId, imageUrl: v.popupImage }}
                    name={v.popupName}
                    compact
                  />
                </span>
                <span className="min-w-0 flex-1 py-1">
                  <span className="line-clamp-2 text-[15px] font-extrabold leading-snug text-foreground sm:text-base">
                    {v.popupName}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-lime-700 dark:text-lime-300">
                    {locale === 'en'
                      ? 'View again'
                      : locale === 'ja'
                        ? 'もう一度見る'
                        : '다시 보기'}
                    <ArrowRight size={13} aria-hidden="true" />
                    {/* 언제 봤는지 — '최근' 이라고 부르면서 언제인지 안 적으면 그 말이 비어 있다. */}
                    {(() => {
                      const ago = visitedAgoLabel(visitedAgo(v.visitedAt), locale);
                      return ago ? (
                        <span className="font-medium text-muted-foreground">· {ago}</span>
                      ) : null;
                    })()}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(v.popupId)}
                aria-label={
                  locale === 'en'
                    ? `Remove ${v.popupName} from recently viewed`
                    : locale === 'ja'
                      ? `${v.popupName} を最近見たポップアップから削除`
                      : `${v.popupName} 을(를) 최근 본 팝업에서 지우기`
                }
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/70 dark:hover:bg-white/[0.08]"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 전체 지우기는 장 수와 무관하게 펼쳤을 때 늘 있다 — 한 장뿐인 사람도 지울 수 있어야 한다. */}
      {isExpanded && (
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/70 dark:hover:bg-white/[0.08]"
          >
            {locale === 'en' ? 'Clear all' : locale === 'ja' ? 'すべて削除' : '전체 지우기'}
          </button>
        </div>
      )}

      {/* 장이 하나뿐이면 컨트롤을 그리지 않는다 — 누를 데가 없는 화살표는 장식이다. */}
      {isExpanded && pageCount > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0}
            aria-label={
              locale === 'en'
                ? 'Previous page of recently viewed pop-ups'
                : locale === 'ja'
                  ? '最近見たポップアップの前のページ'
                  : '최근 본 팝업 이전 장'
            }
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] disabled:opacity-35 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          {/* 장을 넘긴 사실은 화면 밖에서도 들려야 한다 — 바뀌는 것은 이 숫자뿐이다. */}
          <span
            aria-live="polite"
            className="px-1 text-xs font-semibold tabular-nums text-muted-foreground"
          >
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={safePage === pageCount - 1}
            aria-label={
              locale === 'en'
                ? 'Next page of recently viewed pop-ups'
                : locale === 'ja'
                  ? '最近見たポップアップの次のページ'
                  : '최근 본 팝업 다음 장'
            }
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] disabled:opacity-35 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function PopupCoverVisual({
  popup,
  name,
  location,
  compact = false,
}: {
  popup: {
    id: string | number;
    category?: string | null;
    imageUrl?: string | null;
    photoOrigin?: string | null;
    photoSourceUrl?: string | null;
    photoCreditName?: string | null;
    photoCreditUrl?: string | null;
  };
  name: string;
  location?: string | null;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const coverUrl = popupCoverUrl(popup, 400);
  const isStyledPhoto = isPexelsPhoto(popup);
  if (coverUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={name}
          title={isStyledPhoto ? t('photo.styledTooltip') : undefined}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!compact && (
          <PhotoDisclosure popup={popup} className="absolute bottom-2 left-2 right-2 w-fit" />
        )}
        {compact && isStyledPhoto && (
          <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[8px] font-bold text-white">
            {t('photo.styled')}
          </span>
        )}
      </>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-lime-100 via-cream-200 to-amber-100 p-2 text-center dark:from-lime-950 dark:via-ink-900 dark:to-amber-950">
      <Store size={compact ? 18 : 24} className="mb-1.5 text-lime-700/55 dark:text-lime-200/55" />
      {!compact && (
        <strong className="line-clamp-2 text-xs text-ink-900 dark:text-cream-100">{name}</strong>
      )}
      {!compact && location && (
        <span className="mt-1 line-clamp-1 text-[10px] text-ink-500 dark:text-cream-200/55">
          {location.split(' ').slice(0, 2).join(' ')}
        </span>
      )}
    </div>
  );
}
