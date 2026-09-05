'use client';

import { isGuestWished, toggleGuestWishlist } from '@/lib/guestWishlist';
import { GUEST_WISHLIST_MIGRATED_EVENT } from '@/lib/migrateGuestWishlist';
import { FeaturedPopupBanner } from '@/components/main/FeaturedPopupBanner';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Share2,
  Heart,
  CheckCircle,
  Ticket,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Navigation,
  CalendarPlus,
  Route,
  Loader2,
} from 'lucide-react';
import { TakedownModal } from '../../../src/features/popup/TakedownModal';

import DetailMap from '../../../src/components/Map/DetailMap';
import ChatRoom from '../../../src/components/ChatRoom';
import NowWait from '@/components/popup/NowWait';
import MusicForPopup from '../../../src/components/music/MusicForPopup';
import { apiFetch } from '../../../src/lib/api';
import { notify, notifyError, confirmAction } from '@/lib/notify';
import { trackVisitEvent } from '@/lib/visitEvent';
import { isPexelsPhoto, popupCoverUrl } from '@/lib/popupCover';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import { PopupGallery } from '@/components/popup/PopupGallery';
import type { GalleryImage } from '@/lib/galleryImages';
import { addToCalendar, toCalendarEvent } from '@/lib/calendar';
import type { User } from '@/types/popup';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { bilingual } from '@/lib/bilingual';
import { daysUntilEnd } from '@/lib/dday';
import { isPopupStamped, stampErrorMessageKey, type StampRow } from '@/lib/stamps';
import { periodText } from '@/lib/periodText';
import { detailStatusLabel, isPopupEnded } from '@/lib/popupDetailStatus';
import { showsVisitActions } from '@/lib/detailActions';
import { kstTodayStart } from '@/lib/popupSlices';
import type { Nearby } from '@/lib/nearby';
import { canAccessTab } from '@/lib/tabAccess';
import { isGuestActive } from '@/lib/guestMode';
import { popupVibe } from '@/lib/popupVibe';

declare global {
  interface Window {
    kakao: import('@/types/sdk').KakaoMapsSdk;
  }
}

interface PopupDetail {
  id: number;
  name: string;
  nameEn?: string;
  nameJa?: string;
  content: string;
  address: string;
  locationEn?: string;
  locationJa?: string;
  category: string;
  status?: string;
  openDate?: string;
  closeDate?: string;
  latitude?: string;
  longitude?: string;
  imageUrl?: string;
  photoOrigin?: string;
  photoSourceUrl?: string;
  photoCreditName?: string;
  photoCreditUrl?: string;
  /** 소개 아래 갤러리에 그릴 주최측 제공 자료. 비어 있으면 블록 자체가 안 그려진다. */
  images?: GalleryImage[];
  // [V4] 자동수집/검수/저작권 메타
  sourceType?: string;
  sourceUrl?: string;
  sourceName?: string;
  reviewStatus?: string;
  officialUrl?: string;
  reservationUrl?: string;
  informationCheckedAt?: string;
  emergencySnapshot?: boolean;
  emergencyCapturedAt?: string;
}

const CATEGORY_KEY: Record<string, MessageKey> = {
  FASHION: 'category.fashion',
  FOOD: 'category.food',
  CULTURE: 'category.culture',
  CHARACTER: 'category.character',
  BEAUTY: 'category.beauty',
  TECH: 'category.tech',
  ETC: 'category.etc',
};

function ddayLabel(
  closeDate: string | undefined,
  ended: string,
  todayClosing: string,
): string | null {
  const diff = daysUntilEnd(closeDate);
  if (diff === null) return null;
  if (diff < 0) return ended;
  if (diff === 0) return todayClosing;
  return `D-${diff}`;
}

/**
 * 팝업 상세 페이지 — 사진 히어로 + 정보 바 + CTA + 소개 + 지도 + 보조 위젯(음악·톡).
 *
 * <p><b>{@code initial} 을 받는 이유.</b> 예전엔 이 컴포넌트가 {@code useEffect} 안에서 팝업을
 * 가져왔다. {@code useEffect} 는 브라우저에서만 도는데, 서버가 만드는 HTML 은 그 전에 확정된다 —
 * 그래서 크롤러와 공유 카드 미리보기가 보는 것은 <b>"불러오는 중…" 뿐이었다.</b> 라이브에서
 * 확인한 사실이다.
 *
 * <p>{@code 'use client'} 가 문제가 아니다. App Router 는 클라이언트 컴포넌트도 서버에서 HTML 로
 * 그린다. 문제는 <b>데이터가 도착하는 시점</b>이었다. 그래서 서버 컴포넌트(page.tsx)가 먼저 받아
 * 넘겨 주고, 여기서는 그것을 첫 상태로 쓴다. 화면 코드는 그대로 두고 데이터가 들어오는 문을 하나
 * 더 낸 것이라, 지도·찜·스탬프·음악 같은 브라우저 기능은 전혀 건드리지 않았다.
 */
export default function PopupDetailClient({
  id,
  initial,
  nearby = [],
  station = null,
}: {
  id: string;
  initial: PopupDetail | null;
  /**
   * 도보 12분 안의 열려 있는 이웃 최대 3곳. 서버(page.tsx)가 이미 계산해 넘긴다 — 마커 전체
   * 목록(355KB)을 여기서 다시 받으면 안 된다(loadNearbyPopups 문서 참고).
   */
  nearby?: Nearby[];
  /**
   * 주소 아래 「가는 법」 한 줄의 재료 — 가장 가까운 역 + 도보 분. 서버(page.tsx, loadNearestStation)가
   * 이미 계산해 넘긴다. 여기서 {@code nearestStation} 을 직접 부르면 역 509곳짜리 JSON(39KB)이
   * 이 컴포넌트('use client') 를 통해 모든 방문자의 브라우저로 내려간다 — 정작 쓰는 값은
   * {@code { name, minutes } } 뿐인데 그걸 만들려고 원본 39KB 를 통째로 실어 보내는 셈이다.
   *
   * <p>{@code initial} 이 {@code null} 이라 서버가 팝업을 못 받았을 때(아래 useEffect 의 재조회
   * 분기)도 이 값은 계속 {@code null} 이다 — {@code nearby} 와 같은 처지다. 재조회로 좌표는
   * 클라이언트에 새로 도착하지만, 그걸로 다시 역을 계산하려면 이 무거운 JSON 을 클라이언트에
   * 다시 끌어와야 하므로 하지 않는다. 그 경로는 이미 서버 렌더 콘텐츠를 잃은 열화 경로이므로,
   * 「가는 법」 줄이 거기서만 안 보이는 것은 받아들일 수 있는 손실이다.
   */
  station?: { name: string; minutes: number } | null;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();

  const [popup, setPopup] = useState<PopupDetail | null>(initial);
  // 서버가 이미 채워 줬으면 로딩이 아니다. true 로 두면 첫 화면이 "불러오는 중…" 으로 깜빡인다.
  const [loading, setLoading] = useState(initial === null);
  const [isStamped, setIsStamped] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [takedownOpen, setTakedownOpen] = useState(false);
  // "AI 코스 만들기" 클릭 후 응답을 기다리는 동안 버튼을 잠근다(HomeClient.handleAiRecommend 의
  // isAiLoading 과 같은 역할) — 없으면 두 번 빠르게 누른 사용자가 추천 요청을 두 번 보내고,
  // sessionStorage.aiCourseData 를 나중 응답이 덮어써 앞선 요청은 그냥 낭비된다. 로딩 중
  // 버튼 라벨/아이콘도 이 값으로 바꾼다.
  const [isBuildingCourse, setIsBuildingCourse] = useState(false);
  const trackedDetailId = useRef<number | null>(null);

  const TEST_USER_ID = 'test_user';

  /** 본문 내 http/https 링크를 클릭 가능한 a 태그로 변환. */
  const renderContentWithLinks = (text: string) => {
    if (!text) return '';
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
            className="text-lime-600 hover:text-lime-500 dark:text-lime-400 dark:hover:text-lime-300 underline break-all inline-flex items-center gap-1"
          >
            {part} <ExternalLink size={12} className="md:w-3.5 md:h-3.5" />
          </a>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    // 팝업 상세는 비로그인/게스트도 열람 가능(공유·SEO·게스트 둘러보기). 로그인은 스탬프·찜 등 액션에서만 요구.
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        /* 손상된 값 무시 */
      }
    }
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!popup || trackedDetailId.current === popup.id) return;
    trackedDetailId.current = popup.id;

    // 카드 클릭 수가 아니라 실제 상세 도착 수를 센다. 검색 결과·SEO 랜딩·공유 링크처럼
    // PopupCard를 거치지 않는 유입도 모두 같은 기준으로 퍼널에 들어와야 한다.
    trackVisitEvent('detail_view', { popupId: popup.id });
  }, [popup]);

  useEffect(() => {
    if (isCheckingAuth) return;

    // 서버가 이미 채워 줬으면 같은 것을 또 받지 않는다. 스탬프·찜은 로그인한 사람에게만
    // 필요한 값이라 서버가 모르므로 여기서 따로 확인한다.
    if (initial) {
      checkIfStamped(initial.id);
      checkWishlistStatus(initial.id);
      // '최근 본 팝업' 은 브라우저에만 남는 기록이라 서버 경로에서도 여기서 남겨야 한다.
      import('@/lib/recentVisits')
        .then(({ recordVisit }) =>
          recordVisit({
            popupId: initial.id,
            popupName: initial.name,
            popupImage: initial.imageUrl,
          }),
        )
        .catch(() => {
          /* 기록 실패는 무시 — 화면과 무관하다 */
        });
      return;
    }

    apiFetch(`/api/popups/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((response) => {
        const data = response.data || response;
        setPopup({
          id: data.popupId || data.id,
          name: data.name,
          nameEn: data.nameEn,
          nameJa: data.nameJa,
          content: data.content,
          address: data.location || data.address,
          locationEn: data.locationEn,
          locationJa: data.locationJa,
          category: data.category,
          status: data.status,
          openDate: data.startDate || data.openDate,
          closeDate: data.endDate || data.closeDate,
          latitude: data.latitude,
          longitude: data.longitude,
          imageUrl: data.imageUrl || data.image,
          photoOrigin: data.photoOrigin,
          photoSourceUrl: data.photoSourceUrl,
          photoCreditName: data.photoCreditName,
          photoCreditUrl: data.photoCreditUrl,
          images: Array.isArray(data.images) ? data.images : undefined,
          sourceType: data.sourceType,
          sourceUrl: data.sourceUrl,
          sourceName: data.sourceName,
          reviewStatus: data.reviewStatus,
          officialUrl: data.officialUrl,
          reservationUrl: data.reservationUrl,
          informationCheckedAt: data.informationCheckedAt,
        });
        setLoading(false);
        // v2.18 — 최근 본 팝업 자동 기록.
        try {
          import('@/lib/recentVisits').then(({ recordVisit }) => {
            const popupId = Number(data.popupId || data.id);
            if (!Number.isNaN(popupId)) {
              recordVisit({
                popupId,
                popupName: data.name,
                popupImage: data.imageUrl || data.image,
              });
            }
          });
        } catch {
          /* 기록 실패는 무시 */
        }
        checkIfStamped(data.popupId || data.id);
        checkWishlistStatus(data.popupId || data.id);
      })
      .catch(() => {
        // [redesign/test 전용] 로컬(백엔드 없음)에서 재설계 상세를 보기 위한 목업 폴백.
        if (process.env.NODE_ENV === 'development') {
          import('@/lib/devMockPopups').then(({ devMockPopups }) => {
            const list = devMockPopups();
            const m = list.find((p) => String(p.id) === String(id)) || list[0];
            if (m) {
              setPopup({
                id: Number(m.id),
                name: m.name,
                content:
                  '성수동에 처음 문을 여는 팝업스토어입니다. 포토존과 한정판 굿즈, 시즌 한정 메뉴를 만나보세요. 방문 인증하면 스탬프가 적립됩니다. 자세한 내용은 공식 SNS를 참고해주세요.',
                address: m.location,
                category: m.category || 'ETC',
                status: m.status || '운영중',
                closeDate: m.endDate,
                latitude: m.latitude,
                longitude: m.longitude,
                imageUrl: m.imageUrl,
              });
            }
          });
        }
        setLoading(false);
      });
  }, [id, isCheckingAuth, initial]);

  const checkIfStamped = async (popupId: number) => {
    if (!user) return;
    const userIdToCheck = user?.userId || TEST_USER_ID;
    try {
      const res = await apiFetch(`/api/stamps/my?userId=${userIdToCheck}`);
      if (res.ok) {
        const myStamps: StampRow[] = await res.json();
        setIsStamped(isPopupStamped(myStamps, popupId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkWishlistStatus = async (popupId: number) => {
    // 비회원은 브라우저에 담는다. 경위는 lib/guestWishlist.ts.
    if (!user) {
      setIsLiked(isGuestWished(popupId));
      return;
    }
    const userIdToCheck = user?.userId || TEST_USER_ID;
    try {
      const res = await apiFetch(`/api/wishlist/${userIdToCheck}`);
      if (res.ok) {
        const list: { popupId: number }[] = await res.json();
        setIsLiked(list.some((item) => item.popupId === popupId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * 비회원 때 담아 둔 찜이 방금 이 계정으로 옮겨졌으면 하트를 맞춘다.
   *
   * <p><b>옮기는 일 자체는 더 이상 여기서 하지 않는다.</b> 예전에는 이 화면 안의 useEffect 가
   * 유일한 이전기였는데, 로그인 성공은 전부 {@code /?entered=1}(홈)으로 착지하므로 <b>평범한
   * 로그인으로는 한 번도 돌지 않았다.</b> 이제 AuthGuard(루트 레이아웃)가 경로와 무관하게
   * 실행하고(lib/migrateGuestWishlist.ts), 이 화면은 결과만 받아 화면을 맞춘다 — 이전이 끝나는
   * 시점은 이 컴포넌트의 마운트보다 늦을 수 있어서 알려 주지 않으면 하트가 꺼진 채로 남는다.
   */
  useEffect(() => {
    const handleMigrated = () => {
      if (popup) void checkWishlistStatus(popup.id);
    };
    window.addEventListener(GUEST_WISHLIST_MIGRATED_EVENT, handleMigrated);
    return () => window.removeEventListener(GUEST_WISHLIST_MIGRATED_EVENT, handleMigrated);
    // checkWishlistStatus 는 매 렌더 새로 만들어지지만 읽는 값은 popup·user 뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.id, user?.userId]);

  const handleStamp = async () => {
    if (!popup) return;
    if (!user) {
      notify(t('common.loginRequired'));
      router.push(localizedPath('/login', locale));
      return;
    }
    try {
      const res = await apiFetch(`/api/stamps?userId=${user?.userId}&popupId=${popup.id}`, {
        method: 'POST',
      });
      if (res.ok) {
        setIsStamped(true);
        notify(t('detail.stampDone'));
      } else {
        // 서버가 400 본문에 정확한 사유를 담아 준다(StampController#addStamp). 그 문구를
        // 그대로 띄우면 이 사이트가 ko/en/ja 를 모두 서비스하는데 한국어 문장이 영어 화면에도
        // 뜬다 — stampErrorMessageKey 가 알려진 두 사유만 안전하게 번역해서 연결한다.
        const body = await res.text().catch(() => '');
        notifyError(t(stampErrorMessageKey(body)));
      }
    } catch (e) {
      notifyError(t('detail.failed'));
    }
  };

  /**
   * 찜 담기·빼기.
   *
   * <p><b>비회원을 로그인 화면으로 보내지 않는다.</b> 예전에는 그렇게 했고, 그래서 7일간 찜한
   * 사람이 <b>0명</b>이었다 — 그 기간 방문자 1,561명 중 회원은 4명이라 99.7% 가 벽을 만났다.
   * 게다가 그 벽은 방문을 끝냈다. 관심을 표시하려던 사람을 정확히 그 순간에 내보낸 셈이다.
   *
   * <p>이제 비회원은 브라우저에 담고, 로그인하면 <b>AuthGuard(루트 레이아웃)</b>가 서버로 옮긴다
   * ({@code lib/migrateGuestWishlist.ts}). 이 화면에는 이전 로직이 없다 — 예전에 여기 있었는데,
   * 로그인은 언제나 홈에 착지하므로 <b>평범한 로그인으로는 한 번도 돌지 않았다.</b> 이 화면은 이제
   * 이전이 끝났다는 알림만 받아 하트를 다시 맞춘다.
   */
  const handleToggleLike = async () => {
    if (!popup) return;
    if (!user) {
      const nowLiked = toggleGuestWishlist(popup.id);
      setIsLiked(nowLiked);
      if (nowLiked) trackVisitEvent('wishlist_add', { popupId: popup.id });
      return;
    }
    const prevStatus = isLiked;
    setIsLiked(!isLiked);
    try {
      const res = await apiFetch(`/api/wishlist/${user.userId}/${popup.id}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      /*
       * C-4 퍼널의 "저장" 단계. <b>담을 때만</b> 남긴다 — 이 버튼은 토글이라 해제도 같은 곳을
       * 지나는데, 퍼널이 묻는 것은 "관심을 표시한 적이 있나" 이고 나중에 마음이 바뀐 것은 그
       * 단계를 통과했다는 사실을 지우지 않는다.
       *
       * 서버 응답을 받은 뒤에 남긴다. 낙관적 UI 라 화면은 먼저 바뀌는데, 저장이 실패한 것까지
       * 퍼널에 세면 통과 수가 실제보다 부풀려진다.
       */
      if (!prevStatus) trackVisitEvent('wishlist_add', { popupId: popup.id });
    } catch (e) {
      setIsLiked(prevStatus);
      notifyError(t('detail.wishFailed'));
    }
  };

  const handleShare = async () => {
    if (!popup) return;
    const { share } = await import('@/lib/share');
    const shareName =
      (locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null) || popup.name;
    const sharePlace =
      (locale === 'en' ? popup.locationEn : locale === 'ja' ? popup.locationJa : null) ||
      popup.address;
    await share({
      title: shareName,
      text: `${shareName} — ${sharePlace ?? ''}`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    });
  };

  // <b>로그인 확인을 기다리지 않는다.</b> 예전엔 isCheckingAuth 도 함께 봤는데, 그 값은 true 로
  // 시작해서 브라우저의 useEffect 에서만 false 가 된다. 그래서 서버가 만드는 HTML 은 팝업 정보를
  // 들고 있어도 <b>항상 "불러오는 중…" 이었다</b> — 크롤러와 공유 미리보기가 본 것이 그것이다.
  //
  // 팝업 정보는 로그인과 무관하다. 로그인이 필요한 것은 스탬프·찜뿐이고, 그 버튼들은 각자
  // user 를 보고 알아서 분기한다.
  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-black text-sm md:text-base">
        {t('common.loading')}
      </div>
    );
  if (!popup) return null;

  // 좌표가 없으면 없는 것이다. 예전엔 성수동(37.5445,127.0560)을 끼워 넣었는데, 그러면
  // 위치를 모르는 팝업의 핀이 <b>성수동에 정확히 찍힌다.</b> 지도는 그걸 사실로 보여 주고,
  // 길찾기를 누른 사람은 엉뚱한 데로 간다.
  //
  // DetailMap 은 좌표가 없을 때 "위치 정보가 없습니다" 를 보여 주는 분기를 이미 갖고 있는데,
  // 이 폴백 때문에 그 분기를 영원히 못 탔다. 없음을 성수동으로 위장하던 코드다.
  const lat = popup.latitude ? parseFloat(popup.latitude) : NaN;
  const lng = popup.longitude ? parseFloat(popup.longitude) : NaN;

  const catKey = popup.category?.toUpperCase() ?? 'ETC';
  const category = CATEGORY_KEY[catKey] ? t(CATEGORY_KEY[catKey]) : popup.category;
  const dday = ddayLabel(popup.closeDate, t('detail.ended'), t('detail.todayClosing'));
  const shownName = bilingual(
    popup.name,
    locale === 'en' ? popup.nameEn : locale === 'ja' ? popup.nameJa : null,
  );
  const shownPlace = bilingual(
    popup.address,
    locale === 'en' ? popup.locationEn : locale === 'ja' ? popup.locationJa : null,
  );
  const displayName = shownName.display || popup.name;
  const displayPlace = shownPlace.display || popup.address;
  const isCrawledSource = popup.sourceType === 'CRAWLED';
  const hasSourceInformation = isCrawledSource || Boolean(popup.sourceUrl);
  const snapshotCopy =
    locale === 'en'
      ? {
          status: 'Stored information',
          notice: `The service is temporarily unavailable. This information was last checked on ${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-09-01'}.`,
          intro:
            'Photos, descriptions, booking links, and live features will return after the server recovers.',
        }
      : locale === 'ja'
        ? {
            status: '保存済み情報',
            notice: `サービス一時停止中のため、${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-09-01'}に最終確認した情報を表示しています。`,
            intro: '写真・紹介・予約リンク・リアルタイム機能はサーバー復旧後に再表示されます。',
          }
        : {
            status: '저장된 정보',
            notice: `서비스 일시 중단으로 ${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-09-01'}에 마지막으로 확인한 정보를 표시하고 있음.`,
            intro: '사진·소개·예약 링크·실시간 기능은 서버 복구 후 다시 표시됨.',
          };
  // 끝났는지는 status 문자열이 아니라 날짜로 먼저 판단한다 — status=EXPIRED 전환은 스케줄러가
  // 하루 1회만 돌리므로(popupDetailStatus.ts 주석) 종료일이 지나고도 최대 24시간은 status 가
  // 여전히 "영업중"일 수 있다.
  const ended = isPopupEnded(popup.status, popup.closeDate);
  const displayStatus = popup.emergencySnapshot
    ? snapshotCopy.status
    : detailStatusLabel(popup.status, ended, popup.openDate, popup.closeDate, t);
  // 배지를 라임(운영중)으로 켜는 것은 "열려 있다고 확인됐을 때"뿐이다. 저장된 정보(스냅샷)·종료·
  // 상태 미상·혼잡도 값(여유/보통/혼잡) 은 모두 중립으로 둔다 — status.open 텍스트와 실제로
  // 같은지만 보고, popupLocale 의 매핑을 다시 베끼지 않는다.
  const isConfirmedOpen = !popup.emergencySnapshot && !ended && displayStatus === t('status.open');
  // 좌표를 모르면 <b>길안내가 아니라 검색</b>으로 보낸다. 예전 폴백(성수동)을 없앤 뒤 이 링크를
  // 그대로 두면 ".../to/이름,NaN,NaN" 이 되어 지도 앱이 엉뚱한 데를 열거나 아무 데도 안 간다.
  // 이름으로 찾게 하면 적어도 사용자가 직접 고를 수 있다.
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  // 주소 아래 「가는 법」 한 줄 — 가장 가까운 역 + 도보 분만 쓴다(출구 번호는 안 쓴다,
  // nearestStation.ts 문서 참고). station 은 서버(page.tsx)가 이미 계산해 넘긴 prop 이다 —
  // 여기서 nearestStation() 을 직접 부르지 않는다(station prop 문서 참고: 역 509곳 JSON 을
  // 클라이언트 번들에 실지 않기 위해서다). null 이면(좌표가 없거나 15분 밖) 그리지 않는다 —
  // 성수동 폴백을 없앤 것과 같은 규칙: 모르면 지어내지 않고 숨긴다.
  const stationLine = station
    ? t('detail.stationLine')
        .replace('{name}', station.name)
        .replace('{minutes}', String(station.minutes))
    : null;
  const directionsUrl = hasCoords
    ? `https://map.kakao.com/link/to/${encodeURIComponent(popup.name)},${lat},${lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(popup.address || popup.name)}`;
  const coverUrl = popupCoverUrl(popup, 1200);
  /**
   * <b>그 팝업을 찍은 사진인가.</b> {@code popupCoverUrl} 은 PEXELS 스톡도 돌려주므로 그것만으로는
   * 갈리지 않는다. 실측(2026-09-02) 1,343곳 중 PEXELS 82.4% · PLACEHOLDER 17.5% · 실제 사진 1곳.
   */
  const hasOwnPhoto = Boolean(coverUrl) && !isPexelsPhoto(popup);
  const calendarInput = {
    id: popup.id,
    name: popup.name,
    address: popup.address,
    startDate: popup.openDate,
    endDate: popup.closeDate,
  };
  const canAddCalendar = toCalendarEvent(calendarInput) !== null;
  // 끝난 팝업에는 방문 전제 액션(길찾기 · 방문 인증 · 캘린더)을 두지 않는다 — 닫힌 곳으로
  // 보내는 버튼이기 때문이다. 날짜를 모르면 보여주는 쪽으로 기운다(showsVisitActions 문서 참고).
  const canVisit = showsVisitActions(
    popup.openDate ?? null,
    popup.closeDate ?? null,
    kstTodayStart(),
  );
  // 하단 빠른 실행 바가 빈 껍데기로만 뜨지 않게 한다. 바 안 버튼 셋 중 캘린더는 canVisit 에
  // 종속(canVisit && canAddCalendar)이라 별도로 셀 필요가 없고, 남는 것은 길찾기(canVisit)와
  // 찜(!emergencySnapshot) 뿐이다. 이 둘이 동시에 거짓일 때(끝났고 + 스냅샷)만 바가 완전히
  // 비므로, 그때는 바 자체를 그리지 않는다.
  const showQuickActionBar = canVisit || !popup.emergencySnapshot;

  /**
   * 「여기까지 왔으면」 아래 붙는 "AI 코스 만들기" 버튼의 핸들러.
   *
   * <p><b>작전지도(/planning)는 폐기된 기능이다</b> — 대표가 직접 확인해 준 사실이다. 이 버튼은
   * 원래 앵커(이 팝업)+이웃 좌표로 시드를 만들어 POST /api/planning/create 로 방을 만들고 그
   * 방으로 보냈다. 그 경로는 지금도 API 로서는 멀쩡히 동작하지만("작동한다"가 "쓰이고 있다"의
   * 증거는 아니다), 대표가 실제로 쓰는 것은 홈 화면 COURSE 탭의 AI 추천
   * ({@code HomeClient.handleAiRecommend})이다. 다음에 이 페이지를 만지는 사람이 다시 작전지도로
   * 연결하지 않도록 이유를 남겨 둔다.
   *
   * <p>순서는 둘 중 하나만 밟는다 — <b>탭 접근 확인 → (막히면) 안내 → 로그인 → 끝</b>이거나,
   * <b>API 호출 → 성공 확인 → sessionStorage 기록 → 이동</b>이거나. 막힐 수 있는 경로(로그인
   * 필요)에서는 sessionStorage 에 아무것도 쓰지 않는다 — 예전 작전지도 버전은 시드를 먼저 쓰고
   * 방 생성이 나중에 실패하면 그 시드가 사용자가 나중에 아무 방이나 열 때 엉뚱하게 재생됐다.
   * 같은 모양의 실수를 반복하지 않는다.
   *
   * <p>탭 접근 판정은 {@code HomeClient}와 같은 규칙({@code src/lib/tabAccess.ts})을 쓴다 —
   * 게스트 모드가 켜져 있으면(7일) COURSE 탭은 홈에서 이미 열려 있으므로, 그런 사용자에게
   * 로그인을 또 묻지 않는다. 판정을 이 페이지에서 따로 만들면(예: 단순히 {@code !user}만 보는
   * 규칙) 게스트가 홈에서는 되는데 상세 페이지에서는 막히는 모순이 생긴다.
   *
   * <p>버튼 자체는 숨기지 않는다(로그인·게스트 여부와 무관하게 보인다) — 상세 페이지 유입은
   * 딥링크·직접 방문이 대부분이라 로그인 전 도착이 흔하고, 여기서 버튼을 숨기면 이 기능을 보는
   * 사람 거의 전부에게서 감춰진다. 클릭 시점에만 접근 가능 여부를 묻는다.
   */
  const handleAiCourse = async () => {
    if (!canAccessTab('COURSE', !!user, isGuestActive())) {
      // 막힌 사람에게 먼저 사실대로 말한다("AI 코스 추천은 가입 후 이용해주세요" — HomeClient
      // 가 COURSE 탭 자체를 막을 때 쓰는 문구와 같다). 응하면 로그인으로 보내고, 응하지 않으면
      // sessionStorage 에 아무것도 쓰지 않은 채 그대로 둔다.
      if (
        await confirmAction({
          title: t('home.loginRequired'),
          text: t('home.hintCourse'),
          confirmText: t('nav.login'),
        })
      ) {
        router.push(localizedPath('/login', locale));
      }
      return;
    }
    if (isBuildingCourse) return; // 응답을 기다리는 중 다시 눌러도 요청을 또 보내지 않는다.
    setIsBuildingCourse(true);
    try {
      // vibe 는 이 팝업에서 고른다(popupVibe 문서 참고) — 화면 언어와 무관하게 한국어로
      // 고정한다. HomeClient.handleAiRecommend 와 동일한 메커니즘: 응답 그대로
      // sessionStorage.aiCourseData 에 담아 두면 홈이 마운트 시 그것을 읽어 COURSE 탭에 그린다.
      const vibe = popupVibe(popup);
      const res = await apiFetch(`/api/courses/recommend?vibe=${encodeURIComponent(vibe)}`);
      // HomeClient.handleAiRecommend 는 res.ok 를 보지 않고 바로 파싱한다(실패를 JSON.parse 가
      // 던지는 예외에 기대어 알아채는 셈이라, 오류 본문이 우연히도 유효한 JSON 이면 그 조용한
      // 안전망마저 없다). 여기서는 파싱하기 전에 먼저 확인한다.
      if (!res.ok) throw new Error(`courses/recommend failed: ${res.status}`);
      const jsonString = await res.text();
      const result = JSON.parse(jsonString);
      // AiCourseService 는 LLM 응답 파싱에 실패하면 예외 대신 <b>빈 배열을 200 으로</b> 돌려준다
      // (AiCourseService.parseResponse 의 catch 분기). res.ok 만 보면 이 경우를 놓쳐 빈 코스
      // 탭으로 이동하게 된다 — 배열이 비었으면 같은 실패로 취급한다.
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('empty AI course result');
      }
      sessionStorage.setItem('aiCourseData', JSON.stringify({ vibe, course: result }));
      router.push(localizedPath('/?tab=COURSE', locale));
      // 성공 경로에서는 isBuildingCourse 를 되돌리지 않는다 — 곧 다른 라우트로 이동하므로
      // 이 컴포넌트가 다시 인터랙션을 받을 일이 없고, 언마운트 이후 setState 를 피한다.
    } catch (e) {
      notifyError(t('home.aiFail'));
      setIsBuildingCourse(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-36 text-foreground md:pb-24">
      {/*
        표지는 <b>그 팝업의 사진이 있을 때만</b> 쓴다.

        실측(2026-09-02) 1,343곳 중 PEXELS 82.4% · PLACEHOLDER 17.5% · 실제 사진 1곳이다. 즉 거의
        전부가 남의 사진인데, 화면 위 38% 를 써서 "이 팝업의 모습" 이라고 주장하고 있었다.
        PhotoDisclosure("연출 이미지 · 실제 팝업 현장 아님")를 따로 만들어야 했던 것이 그 증거다 —
        사진이 만든 오해를 글자로 되돌리고 있었다.

        유입의 72%가 검색이고, 그들이 먼저 알고 싶은 것은 언제까지·어디서·지금 여는가다. 그래서
        사실을 위로 올리고, 진짜 사진이 있을 때만 그 아래 본문으로 붙인다.

        뒤로가기 단추도 뺐다. 위에 헤더와 빵부스러기가 있어 같은 일을 하는 층이 둘이었다.
      */}
      <header className="border-b border-[var(--color-border)] bg-surface">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3 px-4 py-5 md:px-6 md:py-6 lg:max-w-6xl">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {category && (
                <span className="rounded-pill bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  {category}
                </span>
              )}
              {/* 색은 "확인됐다"는 근거가 있을 때만 라임(go 신호)을 켠다. 종료·상태 미상·저장된
                  정보는 전부 중립이다 — 끝난 팝업이 운영 중과 같은 색이면 안 된다. */}
              <span
                className={
                  'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-bold ' +
                  (popup.emergencySnapshot
                    ? 'bg-amber-200 text-amber-950'
                    : isConfirmedOpen
                      ? 'bg-lime-300 text-ink-900'
                      : 'bg-muted text-muted-foreground')
                }
              >
                <span
                  className={
                    'h-1.5 w-1.5 rounded-full ' +
                    (popup.emergencySnapshot
                      ? 'bg-amber-600'
                      : isConfirmedOpen
                        ? 'bg-green-600'
                        : 'bg-gray-400')
                  }
                />{' '}
                {displayStatus}
              </span>
            </div>

            <h1 className="text-2xl font-black leading-tight md:text-4xl">{displayName}</h1>
            {shownName.original && (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {shownName.original}
              </p>
            )}

            <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin size={14} className="shrink-0" /> {displayPlace}
            </p>
            {shownPlace.original && (
              <p className="ml-5 mt-0.5 text-[11px] text-muted-foreground">{shownPlace.original}</p>
            )}
            {stationLine && (
              <p className="ml-5 mt-0.5 text-[11px] text-muted-foreground">{stationLine}</p>
            )}

            {/* 기간·마감을 접힌 선 위로 올린다 — 검색으로 온 사람이 가장 먼저 확인하는 값이다. */}
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">{periodText(popup.openDate, popup.closeDate)}</span>
              {dday && (
                <span
                  className={
                    'font-black ' +
                    (dday === t('detail.ended') ? 'text-muted-foreground' : 'text-hot-400')
                  }
                >
                  {dday}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleShare}
              aria-label={t('common.share')}
              className={
                'grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border)] bg-surface text-foreground transition hover:bg-muted'
              }
            >
              <Share2 size={18} />
            </button>
            {!popup.emergencySnapshot && (
              <button
                onClick={handleToggleLike}
                aria-label={t('common.wishlist')}
                className={
                  'grid h-11 w-11 place-items-center rounded-full transition ' +
                  (isLiked
                    ? 'bg-hot-400 text-white'
                    : 'border border-[var(--color-border)] bg-surface text-foreground hover:bg-muted')
                }
              >
                <Heart size={18} className={isLiked ? 'fill-current' : ''} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 진짜 사진일 때만. 오버레이가 아니라 본문 블록이라 글자가 사진 위에 얹히지 않는다. */}
      {hasOwnPhoto && coverUrl && (
        <div className="mx-auto max-w-3xl px-4 pt-4 md:px-6 lg:max-w-6xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={displayName}
            className="max-h-[420px] w-full rounded-2xl object-cover"
          />
          <PhotoDisclosure popup={popup} showCredit className="mt-2" />
        </div>
      )}

      {/* 제휴 배너 — 사실 헤더 아래 본문 첫 자리다. 자기 자신의 상세에서는 안 뜬다(hideOnPopupId). */}
      <div className="mx-auto max-w-3xl px-4 pt-4 md:px-6 lg:max-w-6xl">
        <FeaturedPopupBanner hideOnPopupId={popup.id} />
      </div>

      {/* 1440 에서 max-w-3xl 한 칸은 좌우 336px 씩을 버린다. lg 이상에서만 두 칸으로 펴고,
          md(768–1023) 구간은 한 칸 그대로 두되 하단 바(아래 nav, lg:hidden)가 살아 있어
          액션이 사라지지 않는다. */}
      <div className="mx-auto max-w-3xl px-4 md:px-6 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        {popup.emergencySnapshot && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100 lg:col-span-2">
            {snapshotCopy.notice}
          </div>
        )}

        {/* 오른쪽 레일 — 정보 바 · CTA · 캘린더 · 공식 링크 · NowWait.
            데스크탑(lg)에서는 하단 빠른 실행 바가 사라지므로(lg:hidden) 방문 액션이 여기서
            항상 보여야 한다. 이 다섯 블록은 오늘 DOM 에서도 원래 소개보다 먼저 붙어 있던
            것 그대로다 — lg 미만에서는 이 grid 자체가 꺼져 순수 block 스택이 되므로 DOM
            순서가 곧 화면 순서다(375/768/900 은 오늘과 동일). lg 에서만 order-2 로 오른쪽에
            두고, 아래 본문 칸을 order-1 로 왼쪽에 둔다 — DOM 은 그대로 두고 시각 순서만
            grid order 로 뒤집는다. */}
        <aside className="lg:order-2 lg:sticky lg:top-6 lg:self-start">
          {/* 기간·마감 칸은 사실 헤더로 올렸다 — 검색으로 온 사람이 가장 먼저 확인하는 값이라
            접힌 선 위에 있어야 한다. 여기 남겨 두면 같은 숫자가 한 화면에 두 번 나온다. */}

          {/* CTA — 길찾기(주) · 방문 인증(보조). 찜은 히어로 우상단. */}
          <div className="mt-4 flex gap-2.5">
            {/* 끝난 팝업은 닫힌 곳이다 — 길찾기를 없앤다. 세 CTA를 하나로 묶어 감싸지 않고
              각각 감싼다(감싸면 flex-[2]/flex-1 같은 레이아웃 클래스가 함께 사라진다). */}
            {canVisit && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3.5 font-bold text-ink-900 shadow-md transition hover:bg-lime-400"
              >
                <Navigation size={18} /> {t('detail.directions')}
              </a>
            )}
            {canVisit && !popup.emergencySnapshot && (
              <button
                onClick={handleStamp}
                disabled={isStamped}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-3.5 font-bold transition ${
                  isStamped
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30'
                    : 'border-gray-300 bg-white text-foreground hover:border-lime-400 dark:border-white/15 dark:bg-white/5'
                }`}
              >
                {isStamped ? <CheckCircle size={16} /> : <Ticket size={16} />}
                {isStamped ? t('detail.verified') : t('detail.visitVerify')}
              </button>
            )}
          </div>

          {/* 캘린더 추가 — 시작·종료일이 둘 다 검증된 경우에만 노출(날짜 없는 팝업은 숨김).
            iOS 는 .ics, Android·데스크톱은 Google Calendar 웹 딥링크(Android 는 .ics import 불가).
            끝난 팝업은 캘린더에 담을 대상이 아니므로 canVisit 도 함께 본다. */}
          {canVisit && canAddCalendar ? (
            <button
              onClick={() => addToCalendar(calendarInput)}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3 text-sm font-bold text-foreground transition hover:border-lime-400 dark:border-white/15 dark:bg-white/5"
            >
              <CalendarPlus size={18} /> {t('detail.addCalendar')}
            </button>
          ) : null}

          {/* 방문 결정을 돕는 공식 링크는 소개보다 먼저 보여준다. 검증된 URL이 있을 때만 노출한다. */}
          {(popup.reservationUrl || popup.officialUrl) && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {popup.reservationUrl && (
                <a
                  href={popup.reservationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackVisitEvent('outbound_click', { popupId: popup.id })}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-lime-400"
                >
                  {t('detail.reserve')} <ExternalLink size={14} className="shrink-0" />
                </a>
              )}
              {popup.officialUrl && (
                <a
                  href={popup.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackVisitEvent('outbound_click', { popupId: popup.id })}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.05]"
                >
                  {t('detail.official')} <ExternalLink size={14} className="shrink-0" />
                </a>
              )}
            </div>
          )}

          {/* 지금 어때요? — 원터치 대기 제보. 실시간 채팅과 달리 혼자 눌러도 다음 방문자에게 남는 신호라
            방문자가 적어도 작동한다(로그인 불필요 = 참여 문턱 최소).

            끝난 팝업에는 그리지 않는다(canVisit). 닫힌 곳의 대기 시간을 묻는 것은 길찾기와 같은
            종류의 무의미한 권유이고, 더 나쁘게는 <b>데이터를 오염시킨다</b> — 문 닫은 가게 앞에서
            '바로 입장' 을 누른 기록이 쌓이면 그 팝업의 혼잡 신호가 통째로 못 쓰게 된다. */}
          {canVisit && !popup.emergencySnapshot && <NowWait popupId={popup.id} />}
        </aside>

        {/* 왼쪽 칸 — 소개 · 위치 · 어울리는 곡 · 방문 팁 · 출처/신고.
            lg 에서 order-1 로 왼쪽에 둔다(위 레일 주석 참고 — DOM 순서는 그대로, 시각 순서만
            grid order 로 뒤집는다). */}
        <div className="lg:order-1 min-w-0">
          {/* 주최측 제공 자료 — 소개보다 <b>먼저</b> 둔다.
              주최측이 만든 안내는 우리가 옮겨 적은 소개글보다 정확하고 최신이다. 카드뉴스에는
              시간·구성·현장 이벤트까지 들어 있는데, 그것을 소개글 아래로 내리면 스크롤 한 번을
              더 해야 닿는다. 원본이 있으면 원본을 먼저 보여주는 것이 맞다.

              자료가 있을 때만 그려진다(PopupGallery 내부에서 판단). 장애 스냅샷일 때는 숨긴다 —
              그때 화면은 "사진·소개·예약 링크는 서버 복구 후 다시 표시됨" 이라고 약속하고 있어서,
              자료만 남아 있으면 그 문구와 어긋난다. */}
          {!popup.emergencySnapshot && (
            <PopupGallery images={popup.images} popupName={displayName || popup.name} />
          )}

          {/* 소개 */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-black">{t('detail.intro')}</h2>
            <div className="whitespace-pre-line rounded-2xl border border-gray-200 bg-white p-5 text-sm font-medium leading-relaxed text-foreground/80 dark:border-white/10 dark:bg-[#111] md:p-6 md:text-base">
              {locale !== 'ko' && popup.content && (
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  {t('detail.originalKorean')}
                </p>
              )}
              {popup.emergencySnapshot ? snapshotCopy.intro : renderContentWithLinks(popup.content)}
            </div>
          </section>
          {/* 위치 */}
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-black">{t('detail.location')}</h2>
            {/*
            높이를 DetailMap 이 요구하는 값과 맞춘다. 이 칸은 md 에서 320 이었는데 안의 지도는
            {@code md:min-h-[350px]} 라, 넓은 화면에서 지도 아래 30px 이 잘려 나갔다.
            거기에 MapLibre 의 저작자 표시(attributionControl)가 들어간다 — 지도 데이터는
            출처를 보이게 두어야 하므로 화면 문제만이 아니다.

            lg 에서 이 칸은 오른쪽 360px 레일 때문에 좁아진다(1024px 뷰포트 기준 약 584px,
            1152px 이상에서는 약 712px) — 그래도 가로:세로가 최소 1.67:1 이라 여전히 landscape
            비율이라 높이 값은 바꾸지 않았다. 바꾸게 되면 DetailMap.tsx 의 min-h 도 반드시
            같이 바꿔야 한다(안 그러면 위 30px 잘림이 재발한다).
          */}
            <div className="relative h-[250px] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 md:h-[350px]">
              <DetailMap latitude={lat} longitude={lng} />
              <div className="absolute bottom-4 left-1/2 z-40 flex w-[90%] -translate-x-1/2 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-white/20 bg-black/85 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-xl md:w-auto md:bottom-6">
                <MapPin size={12} className="shrink-0 animate-bounce text-lime-400" />
                <span className="truncate">{displayPlace}</span>
              </div>
            </div>
          </section>

          {/* 어울리는 곡 — 하단 보조 위젯 */}
          {!popup.emergencySnapshot && (
            <section className="mt-8">
              <MusicForPopup popupId={popup.id} />
            </section>
          )}

          {/* 방문 팁 — '실시간 톡'은 동시 접속자가 있어야 성립해 빈 방으로 보였다.
            남긴 글이 쌓여 다음 방문자에게 남는 비동기 팁으로 성격을 바꾼다. */}
          {!popup.emergencySnapshot && (
            <section className="mt-8">
              <h2 className="mb-1 text-lg font-black">{t('detail.tipsTitle')}</h2>
              <p className="mb-4 text-xs text-muted-foreground">{t('detail.tipsDesc')}</p>
              <ChatRoom roomId={popup.id} nickname={user?.nickname || t('detail.anonymous')} />
            </section>
          )}

          {/* 여기까지 왔으면 — 상세를 종점이 아니라 경유지로 만드는 블록. 도보 12분 안의 이웃을
            서버가 이미 계산해 최대 3곳만 넘긴다(nearby prop, page.tsx 의 loadNearbyPopups).
            좌표가 없거나 이웃이 0곳이면 섹션 자체를 그리지 않는다 — 빈 껍데기·플레이스홀더 없음.
            다른 보조 섹션(h2)보다 가벼운 무게로 <h3> 를 쓴다. */}
          {nearby.length > 0 && (
            <section className="mt-8">
              <h3 className="mb-3 text-sm font-black md:text-base">{t('detail.nearbyTitle')}</h3>
              <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#111]">
                {nearby.map((n) => {
                  const nearbyName = bilingual(
                    n.marker.name,
                    locale === 'en' ? n.marker.nameEn : locale === 'ja' ? n.marker.nameJa : null,
                  );
                  const nearbyDisplayName = nearbyName.display || n.marker.name;
                  return (
                    <Link
                      key={n.marker.id}
                      href={localizedPath(`/popup/${n.marker.id}`, locale)}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05] md:px-5 md:text-base"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                        {nearbyDisplayName}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-muted-foreground md:text-sm">
                        {t('detail.nearbyWalkPrefix')}
                        {n.minutes}
                        {t('detail.nearbyWalkSuffix')}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* AI 코스 만들기 — 이 섹션이 그려지는 조건(nearby.length > 0)을 그대로 재사용한다:
                도보권에 갈 곳이 있는 상세 페이지에서만 "더 둘러보고 싶다"는 동기가 자연스럽다.
                다만 AI 추천(HomeClient.handleAiRecommend 와 같은 엔드포인트)은 이 팝업의 좌표나
                nearby 목록을 재료로 쓰지 않는다 — vibe 키워드 하나로 서버가 통째로 새 코스를
                만들어 준다. 그래서 예전처럼 courseSeed 개수로 다시 가드하지 않는다(courseSeed
                자체가 이제 없다 — popupVibe.ts 문서 참고). */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleAiCourse}
                  disabled={isBuildingCourse}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5 text-sm font-bold text-foreground transition hover:border-lime-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 md:text-base"
                >
                  {isBuildingCourse ? (
                    <Loader2 size={18} className="shrink-0 animate-spin" />
                  ) : (
                    <Route size={18} className="shrink-0" />
                  )}
                  {isBuildingCourse ? t('detail.aiCourseLoading') : t('detail.aiCourseButton')}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                  {t('detail.aiCourseHint')}
                </p>
              </div>
            </section>
          )}

          {/* 출처 / 신고 */}
          {!popup.emergencySnapshot && (
            <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] md:p-6">
              {hasSourceInformation && (
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sky-300/30 bg-sky-300/10 text-sky-500">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-muted-foreground">
                      {t(isCrawledSource ? 'detail.sourceTitle' : 'detail.reportedSourceTitle')}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground/70 md:text-sm">
                      {isCrawledSource ? (
                        <>
                          {t('detail.sourceDesc1')} (
                          {popup.sourceName || t('detail.externalSource')}){' '}
                          {t('detail.sourceDesc2')}
                        </>
                      ) : (
                        t('detail.reportedSourceDesc')
                      )}
                    </p>
                    {popup.informationCheckedAt && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t('detail.informationChecked')} {popup.informationCheckedAt.slice(0, 10)}
                      </p>
                    )}
                    {popup.sourceUrl && (
                      <a
                        href={popup.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        /*
                         * 이 페이지에서 <b>실제로 작동하는 유일한 이탈 경로</b>다. 공식·예약 버튼에도
                         * 같은 이벤트가 달려 있지만 그 둘은 진행 중 588건 전부 URL 이 비어 있어 한 번도
                         * 그려진 적이 없다 — 3주간 outbound_click 이 0건이었던 이유가 클릭이 없어서가
                         * 아니라 버튼이 없어서였다.
                         *
                         * 여기 붙여야 "상세를 보고 더 알아보러 떠났는가" 를 처음으로 셀 수 있다.
                         */
                        onClick={() => trackVisitEvent('outbound_click', { popupId: popup.id })}
                        /*
                         * 글자만 있는 링크는 높이가 글자 높이(16px)라 손가락으로 정확히 누르기 어렵다.
                         * 글자 크기는 그대로 두고 위아래 여백으로 누를 면적만 44px 로 넓힌다 —
                         * 겉모습을 키우면 본문 흐름이 흐트러진다.
                         */
                        className="mt-1 inline-flex min-h-11 items-center gap-1.5 py-2 text-xs font-semibold text-lime-600 underline dark:text-lime-400 md:text-sm"
                      >
                        {t('detail.viewSource')} <ExternalLink size={12} className="shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div
                className={`flex items-start gap-3 ${hasSourceInformation ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-300/30 bg-red-300/10 text-red-500">
                  <ShieldAlert size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {t('detail.reportTitle')}
                  </p>
                  <p className="mb-2 mt-0.5 text-xs leading-relaxed text-foreground/70 md:text-sm">
                    {t('detail.reportDesc')}
                  </p>
                  <button
                    onClick={() => setTakedownOpen(true)}
                    className="inline-flex min-h-11 items-center gap-1.5 py-2 text-xs font-semibold text-red-500 underline hover:text-red-400 md:text-sm"
                  >
                    {t('detail.reportAction')} <ShieldAlert size={12} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 세 버튼이 전부 조건부라 다 꺼지면 빈 껍데기 바만 남는다 — canVisit || !emergencySnapshot
          로 그 경우를 걸러 바 자체를 그리지 않는다(showQuickActionBar 정의부 주석 참고). */}
      {showQuickActionBar && (
        <nav
          aria-label={
            locale === 'ko' ? '빠른 실행' : locale === 'ja' ? 'クイック操作' : 'Quick actions'
          }
          className="fixed inset-x-3 z-50 mx-auto flex max-w-md gap-2 rounded-2xl border border-black/10 bg-white/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#111]/95"
          style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {/* 끝난 팝업은 닫힌 곳이다 — 길찾기를 없앤다. */}
          {canVisit && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-300 px-2 text-xs font-black text-ink-900 active:scale-[0.98]"
            >
              <Navigation size={17} aria-hidden /> {t('detail.directions')}
            </a>
          )}
          {canVisit && canAddCalendar ? (
            <button
              type="button"
              onClick={() => addToCalendar(calendarInput)}
              className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-2 text-xs font-black text-gray-900 active:scale-[0.98] dark:bg-white/10 dark:text-white"
            >
              <CalendarPlus size={17} aria-hidden /> {t('detail.addCalendar')}
            </button>
          ) : null}
          {/* 찜하기는 남긴다 — 끝난 팝업을 찜하는 것도 기록으로서 유효하다. */}
          {!popup.emergencySnapshot && (
            <button
              type="button"
              onClick={handleToggleLike}
              aria-pressed={isLiked}
              className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black active:scale-[0.98] ${
                isLiked
                  ? 'bg-hot-400 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
              }`}
            >
              <Heart size={17} className={isLiked ? 'fill-current' : ''} aria-hidden />
              {t('common.wishlist')}
            </button>
          )}
        </nav>
      )}

      {!popup.emergencySnapshot && (
        <TakedownModal
          open={takedownOpen}
          onOpenChange={setTakedownOpen}
          popupId={popup.id}
          popupName={popup.name}
        />
      )}
    </main>
  );
}
