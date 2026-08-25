'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { TakedownModal } from '../../../src/features/popup/TakedownModal';

import DetailMap from '../../../src/components/Map/DetailMap';
import ChatRoom from '../../../src/components/ChatRoom';
import NowWait from '@/components/popup/NowWait';
import MusicForPopup from '../../../src/components/music/MusicForPopup';
import { apiFetch } from '../../../src/lib/api';
import { notify, notifyError, confirmAction } from '@/lib/notify';
import { trackVisitEvent } from '@/lib/visitEvent';
import { popupCoverUrl } from '@/lib/popupCover';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import LocaleSwitcher from '@/components/LocaleSwitcher';
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
import { toCourseSeed } from '@/lib/courseSeed';

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

const CAT_GRAD: Record<string, string> = {
  FASHION: 'from-pink-300 to-rose-400',
  FOOD: 'from-amber-300 to-orange-400',
  CULTURE: 'from-violet-300 to-indigo-400',
  CHARACTER: 'from-lime-300 to-emerald-400',
  BEAUTY: 'from-fuchsia-300 to-pink-400',
  TECH: 'from-sky-300 to-cyan-400',
  ETC: 'from-gray-300 to-gray-400',
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
}: {
  id: string;
  initial: PopupDetail | null;
  /**
   * 도보 12분 안의 열려 있는 이웃 최대 3곳. 서버(page.tsx)가 이미 계산해 넘긴다 — 마커 전체
   * 목록(355KB)을 여기서 다시 받으면 안 된다(loadNearbyPopups 문서 참고).
   */
  nearby?: Nearby[];
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
  // "N곳 코스로 작전지도 열기" 클릭 후 응답을 기다리는 동안 버튼을 잠근다 — 없으면 두 번 빠르게
  // 누른 사용자가 방을 두 개 만들고, 두 번째 방에만 코스가 시딩된다(첫 방은 빈 채로 남는다).
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
    if (!user) return;
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

  const handleToggleLike = async () => {
    if (!popup) return;
    if (!user) {
      notify(t('common.loginRequired'));
      router.push(localizedPath('/login', locale));
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
  const catGrad = CAT_GRAD[catKey] ?? CAT_GRAD.ETC;
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
          notice: `The service is temporarily unavailable. This information was last checked on ${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-08-11'}.`,
          intro:
            'Photos, descriptions, booking links, and live features will return after the server recovers.',
        }
      : locale === 'ja'
        ? {
            status: '保存済み情報',
            notice: `サービス一時停止中のため、${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-08-11'}に最終確認した情報を表示しています。`,
            intro: '写真・紹介・予約リンク・リアルタイム機能はサーバー復旧後に再表示されます。',
          }
        : {
            status: '저장된 정보',
            notice: `서비스 일시 중단으로 ${popup.emergencyCapturedAt?.slice(0, 10) ?? '2026-08-11'}에 마지막으로 확인한 정보를 표시하고 있음.`,
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
  const directionsUrl = hasCoords
    ? `https://map.kakao.com/link/to/${encodeURIComponent(popup.name)},${lat},${lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(popup.address || popup.name)}`;
  const coverUrl = popupCoverUrl(popup, 1200);
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

  // 「여기까지 왔으면」 아래 붙는 "묶어 코스로" 버튼의 재료. 앵커(이 팝업)를 배열 맨 앞에
  // 넣는다 — "여기, 그리고 이 근처들"이 사용자의 멘탈모델이라 내가 서 있는 곳을 빼면
  // 이상한 코스가 된다(toCourseSeed 는 순서를 보존하므로 여기서 넣은 순서가 곧 방에
  // 채워지는 순서다). nearby 는 항상 이름 그대로(원문 한국어)를 쓴다 — HomeClient 의
  // handleAddPlace 와 같은 이유로, 화면 언어에 저장 값을 묶으면 나중에 다른 언어로 열었을
  // 때 남의 말이 섞여 나온다.
  //
  // nearby 가 비어 있으면(=이 블록 자체가 안 그려지면) 이 배열은 앵커 하나뿐이라
  // courseSeed.length 가 1 이하가 되고, 버튼 렌더 조건(courseSeed.length > 1)이 함께
  // 막는다. 아래에서 hasCoords 를 다시 묻지 않는 이유: nearby.length > 0 인 시점에
  // 도달했다는 것 자체가 loadNearbyPopups(page.tsx)가 이미 앵커 좌표를 검증했다는
  // 뜻이다(좌표가 없으면 그 함수가 빈 배열을 돌려준다).
  const courseSeed = toCourseSeed([
    { name: popup.name, lat, lng },
    ...nearby.map((n) => ({
      name: n.marker.name,
      lat: Number(n.marker.latitude),
      lng: Number(n.marker.longitude),
    })),
  ]);

  // 방 생성은 HomeClient.handleCreateRoom 과 같은 패턴을 그대로 따른다 — 로그인 게이트를
  // 포함해서다. 처음엔 "POST /api/planning/create 에 @PreAuthorize 가 없다"만 보고 게이트를
  // 뺐는데, 그건 API 계층만 본 것이고 진짜 문이 있는 곳은 프론트다: /planning 이 마운트되면
  // localStorage.user 를 확인해 없으면 그 자리에서 /login 으로 튕긴다(app/planning/page.tsx
  // :300-303). 그 문은 없애면 안 된다 — 방은 참가자를 닉네임으로 식별하는 협업 공간이라
  // 로그인된 신원이 실제로 필요하다. 대신 이 버튼이 "코스를 연다"고 말해 놓고 말없이 로그인
  // 폼으로 순간이동시키는 게 문제였으므로, 클릭 시점에 먼저 사실대로 말한다.
  //
  // 버튼 자체는 숨기지 않는다(로그인 여부와 무관하게 courseSeed.length > 1 이면 보인다) —
  // 상세 페이지 유입은 딥링크·직접 방문이 대부분이라 로그인 전 도착이 흔하고, 여기서 버튼을
  // 숨기면 이 기능을 보는 사람 거의 전부에게서 감춰진다. HomeClient 의 "작전 회의실 만들기"
  // 버튼도 같은 이유로 항상 보이고, 클릭 시점에만 로그인을 묻는다 — 그 패턴을 그대로 따른다.
  const handleBuildCourse = async () => {
    if (!user) {
      // 로그인하지 않은 사람에게 방을 만들어 주지 않는다 — /planning 이 어차피 튕겨낸다.
      // 대신 왜 필요한지 먼저 말하고, 응하면 로그인으로 보낸다. sessionStorage 는 쓰지 않는다
      // — 여기서 쓰면 나중에 로그인해서 아무 방이나 열 때 이 코스가 엉뚱하게 재생된다.
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
    if (isBuildingCourse) return; // 응답을 기다리는 중 다시 눌러도 방을 또 만들지 않는다.
    setIsBuildingCourse(true);
    try {
      const res = await apiFetch('/api/planning/create', { method: 'POST' });
      // HomeClient.handleCreateRoom 을 그대로 복제하며 res.ok 확인을 빠뜨렸던 것을 여기서
      // 고친다 — 확인하지 않으면 실패 응답의 오류 본문이 그대로 roomId 로 쓰여 깨진 방으로
      // 이동한다.
      if (!res.ok) throw new Error(`planning/create failed: ${res.status}`);
      const roomId = await res.text();
      // 방 생성이 성공을 확인한 뒤에만 sessionStorage 를 쓴다 — 실패했는데 먼저 써 두면,
      // 사용자가 나중에 아무 방이나 열 때 이 코스가 엉뚱하게 재생된다.
      sessionStorage.setItem('planningSeedCourse', JSON.stringify(courseSeed));
      router.push(localizedPath(`/planning?room=${roomId}`, locale));
      // 성공 경로에서는 isBuildingCourse 를 되돌리지 않는다 — 곧 다른 라우트로 이동하므로
      // 이 컴포넌트가 다시 인터랙션을 받을 일이 없고, 언마운트 이후 setState 를 피한다.
    } catch (e) {
      notifyError(t('home.serverFail'));
      setIsBuildingCourse(false);
    }
  };

  return (
    <main className="min-h-screen bg-background pb-36 text-foreground md:pb-24">
      {/* 사진 히어로 — 실제 커버 이미지(없으면 카테고리 그라디언트) + 제목 오버레이 */}
      <div className="relative h-[38vh] min-h-[240px] max-h-[440px] w-full overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${catGrad}`} />
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

        {/* 상단: 뒤로 / 공유 · 찜 */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 md:p-5">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} className="shrink-0" />
            <button
              onClick={handleShare}
              aria-label={t('common.share')}
              className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
            >
              <Share2 size={18} />
            </button>
            {!popup.emergencySnapshot && (
              <button
                onClick={handleToggleLike}
                aria-label={t('common.wishlist')}
                className={`grid h-11 w-11 place-items-center rounded-full backdrop-blur-md transition ${
                  isLiked ? 'bg-hot-400 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                }`}
              >
                <Heart size={18} className={isLiked ? 'fill-current' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* 제목 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white md:p-7">
          <PhotoDisclosure popup={popup} showCredit className="mb-3" />
          <div className="mb-2 flex items-center gap-2">
            {category && (
              <span className="rounded-pill bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
                {category}
              </span>
            )}
            {/* 색은 "확인됐다"는 근거가 있을 때만 라임(go 신호)을 켠다. 종료·상태 미상·저장된
                정보는 전부 중립이다 — 예전엔 조건 없이 항상 라임+초록 점이라, 끝난 팝업도
                운영 중과 같은 색으로 보여줬다. */}
            <span
              className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-bold ${
                popup.emergencySnapshot
                  ? 'bg-amber-300 text-ink-900'
                  : isConfirmedOpen
                    ? 'bg-lime-300 text-ink-900'
                    : 'bg-gray-800/80 text-white'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  popup.emergencySnapshot
                    ? 'bg-amber-600'
                    : isConfirmedOpen
                      ? 'bg-green-600'
                      : 'bg-gray-300'
                }`}
              />{' '}
              {displayStatus}
            </span>
          </div>
          <h1 className="text-2xl font-black leading-tight md:text-4xl">{displayName}</h1>
          {shownName.original && (
            <p className="mt-1 text-xs font-semibold text-white/65">{shownName.original}</p>
          )}
          <p className="mt-1.5 flex items-center gap-1 text-sm text-white/80">
            <MapPin size={14} className="shrink-0" /> {displayPlace}
          </p>
          {shownPlace.original && (
            <p className="ml-5 mt-0.5 text-[11px] text-white/60">{shownPlace.original}</p>
          )}
        </div>
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
          {/* 정보 바 — 우리가 <b>실제로 아는 것</b>만 둔다.
            예전엔 '운영 11:00~20:00' 칸이 있었는데, openTime/closeTime 은 백엔드에 존재하지도
            않는 필드라 폴백이 그대로 찍혔다. 즉 팝업 3,225곳 전부가 같은 영업시간을 내걸고
            있었다. 시간 맞춰 갔다가 닫혀 있으면 그 사람은 다시 오지 않는다.
            빈 칸을 만드느니 칸을 없애고, 남은 자리는 진짜 값(시작일)에 쓴다. */}
          <div className="relative z-10 -mt-6 grid grid-cols-2 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-white shadow-lg dark:divide-white/10 dark:border-white/10 dark:bg-[#111]">
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground">{t('detail.period')}</p>
              <p className="mt-1 text-sm font-bold">
                {periodText(popup.openDate, popup.closeDate)}
              </p>
            </div>
            <div className="px-3 py-4 text-center">
              <p className="text-[10px] font-bold text-muted-foreground">{t('detail.closing')}</p>
              <p
                className={`mt-1 text-sm font-black ${dday === t('detail.ended') ? 'text-muted-foreground' : 'text-hot-400'}`}
              >
                {dday || '-'}
              </p>
            </div>
          </div>

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

              {/* 세 곳 묶어 코스로 — 이미 있던 시드 리더(app/planning/page.tsx:408)에 쓰는
                쪽을 붙인다. 앵커가 courseSeed 맨 앞에 있으므로 리스트가 비어도(toCourseSeed
                가 항목을 걸러내) 1곳만 남을 수 있어 courseSeed.length > 1 로 다시 가드한다 —
                혼자인 "코스"는 이 버튼이 답하려는 질문 자체가 성립하지 않는다. */}
              {courseSeed.length > 1 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleBuildCourse}
                    disabled={isBuildingCourse}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3.5 text-sm font-bold text-foreground transition hover:border-lime-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 md:text-base"
                  >
                    <Route size={18} className="shrink-0" />
                    {t('detail.courseSeedPrefix')}
                    {courseSeed.length}
                    {t('detail.courseSeedSuffix')}
                  </button>
                  {/* 방은 3시간 뒤 사라진다(PlanningController.java:43, ROOM_TTL_HOURS=3).
                    말없이 사라지는 "코스"를 쥐여주지 않으려고 짧게 적어 둔다. */}
                  <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                    {t('detail.courseSeedTtl')}
                  </p>
                </div>
              )}
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
