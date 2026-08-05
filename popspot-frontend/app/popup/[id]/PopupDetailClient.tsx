'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { TakedownModal } from '../../../src/features/popup/TakedownModal';

import DetailMap from '../../../src/components/Map/DetailMap';
import ChatRoom from '../../../src/components/ChatRoom';
import NowWait from '@/components/popup/NowWait';
import MusicForPopup from '../../../src/components/music/MusicForPopup';
import { apiFetch } from '../../../src/lib/api';
import { notify, notifyError } from '@/lib/notify';
import { trackVisitEvent } from '@/lib/visitEvent';
import { popupCoverUrl } from '@/lib/popupCover';
import { PhotoDisclosure } from '@/components/popup/PhotoDisclosure';
import { addToCalendar, toCalendarEvent } from '@/lib/calendar';
import type { User } from '@/types/popup';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import { bilingual } from '@/lib/bilingual';

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
  if (!closeDate) return null;
  const end = new Date(closeDate);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
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
}: {
  id: string;
  initial: PopupDetail | null;
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
        interface StampRow {
          stampDate?: string;
          popupStore: { popupId: number };
        }
        const myStamps: StampRow[] = await res.json();
        const todayString = new Date().toISOString().split('T')[0];
        const hasStampToday = myStamps.some((s) => {
          const dbDate = s.stampDate?.split('T')[0];
          return s.popupStore.popupId === popupId && dbDate === todayString;
        });
        setIsStamped(hasStampToday);
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
        notifyError(t('detail.stampFailed'));
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
  const displayStatus =
    popup.status === '영업중' || popup.status === '운영중' || popup.status === 'OPEN'
      ? t('status.open')
      : popup.status || t('status.open');
  // 좌표를 모르면 <b>길안내가 아니라 검색</b>으로 보낸다. 예전 폴백(성수동)을 없앤 뒤 이 링크를
  // 그대로 두면 ".../to/이름,NaN,NaN" 이 되어 지도 앱이 엉뚱한 데를 열거나 아무 데도 안 간다.
  // 이름으로 찾게 하면 적어도 사용자가 직접 고를 수 있다.
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const directionsUrl = hasCoords
    ? `https://map.kakao.com/link/to/${encodeURIComponent(popup.name)},${lat},${lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent(popup.address || popup.name)}`;
  const coverUrl = popupCoverUrl(popup, 1200);

  return (
    <main className="min-h-screen bg-background text-foreground pb-24">
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
            className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              aria-label={t('common.share')}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={handleToggleLike}
              aria-label={t('common.wishlist')}
              className={`grid h-10 w-10 place-items-center rounded-full backdrop-blur-md transition ${
                isLiked ? 'bg-hot-400 text-white' : 'bg-black/40 text-white hover:bg-black/60'
              }`}
            >
              <Heart size={18} className={isLiked ? 'fill-current' : ''} />
            </button>
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
            <span className="inline-flex items-center gap-1 rounded-pill bg-lime-300 px-2.5 py-1 text-[11px] font-bold text-ink-900">
              <span className="h-1.5 w-1.5 rounded-full bg-green-600" /> {displayStatus}
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

      <div className="mx-auto max-w-3xl px-4 md:px-6">
        {/* 정보 바 — 우리가 <b>실제로 아는 것</b>만 둔다.
            예전엔 '운영 11:00~20:00' 칸이 있었는데, openTime/closeTime 은 백엔드에 존재하지도
            않는 필드라 폴백이 그대로 찍혔다. 즉 팝업 3,225곳 전부가 같은 영업시간을 내걸고
            있었다. 시간 맞춰 갔다가 닫혀 있으면 그 사람은 다시 오지 않는다.
            빈 칸을 만드느니 칸을 없애고, 남은 자리는 진짜 값(시작일)에 쓴다. */}
        <div className="relative z-10 -mt-6 grid grid-cols-2 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-white shadow-lg dark:divide-white/10 dark:border-white/10 dark:bg-[#111]">
          <div className="px-3 py-4 text-center">
            <p className="text-[10px] font-bold text-muted-foreground">{t('detail.period')}</p>
            <p className="mt-1 text-sm font-bold">
              {popup.closeDate
                ? `${popup.openDate ? `${popup.openDate.slice(5)} ~ ` : '~'}${popup.closeDate.slice(5)}`
                : '-'}
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
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3.5 font-bold text-ink-900 shadow-md transition hover:bg-lime-400"
          >
            <Navigation size={18} /> {t('detail.directions')}
          </a>
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
        </div>

        {/* 캘린더 추가 — 시작·종료일이 둘 다 검증된 경우에만 노출(날짜 없는 팝업은 숨김).
            iOS 는 .ics, Android·데스크톱은 Google Calendar 웹 딥링크(Android 는 .ics import 불가). */}
        {(() => {
          const calInput = {
            id: popup.id,
            name: popup.name,
            address: popup.address,
            startDate: popup.openDate,
            endDate: popup.closeDate,
          };
          return toCalendarEvent(calInput) ? (
            <button
              onClick={() => addToCalendar(calInput)}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white py-3 text-sm font-bold text-foreground transition hover:border-lime-400 dark:border-white/15 dark:bg-white/5"
            >
              <CalendarPlus size={18} /> {t('detail.addCalendar')}
            </button>
          ) : null;
        })()}

        {/* 지금 어때요? — 원터치 대기 제보. 실시간 채팅과 달리 혼자 눌러도 다음 방문자에게 남는 신호라
            방문자가 적어도 작동한다(로그인 불필요 = 참여 문턱 최소). */}
        <NowWait popupId={popup.id} />

        {/* 소개 */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-black">{t('detail.intro')}</h2>
          <div className="whitespace-pre-line rounded-2xl border border-gray-200 bg-white p-5 text-sm font-medium leading-relaxed text-foreground/80 dark:border-white/10 dark:bg-[#111] md:p-6 md:text-base">
            {locale !== 'ko' && popup.content && (
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                {t('detail.originalKorean')}
              </p>
            )}
            {renderContentWithLinks(popup.content)}
          </div>
        </section>

        {/* 위치 */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-black">{t('detail.location')}</h2>
          <div className="relative h-[250px] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 md:h-[320px]">
            <DetailMap latitude={lat} longitude={lng} />
            <div className="absolute bottom-4 left-1/2 z-40 flex w-[90%] -translate-x-1/2 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-white/20 bg-black/85 px-4 py-2 text-[11px] font-bold text-white backdrop-blur-xl md:w-auto md:bottom-6">
              <MapPin size={12} className="shrink-0 animate-bounce text-lime-400" />
              <span className="truncate">{displayPlace}</span>
            </div>
          </div>
        </section>

        {/* 어울리는 곡 — 하단 보조 위젯 */}
        <section className="mt-8">
          <MusicForPopup popupId={popup.id} />
        </section>

        {/* 방문 팁 — '실시간 톡'은 동시 접속자가 있어야 성립해 빈 방으로 보였다.
            남긴 글이 쌓여 다음 방문자에게 남는 비동기 팁으로 성격을 바꾼다. */}
        <section className="mt-8">
          <h2 className="mb-1 text-lg font-black">{t('detail.tipsTitle')}</h2>
          <p className="mb-4 text-xs text-muted-foreground">{t('detail.tipsDesc')}</p>
          <ChatRoom roomId={popup.id} nickname={user?.nickname || t('detail.anonymous')} />
        </section>

        {/* 공식 사이트 · 예약 — 크롤이 snippet 에서 URL 을 실제로 뽑았을 때만 노출 */}
        {(popup.reservationUrl || popup.officialUrl) && (
          <div className="mt-8 flex flex-wrap gap-2.5">
            {popup.reservationUrl && (
              <a
                href={popup.reservationUrl}
                target="_blank"
                rel="noopener noreferrer"
                /*
                 * C-4 퍼널의 마지막 단계. 이 서비스가 사용자를 위해 할 수 있는 가장 끝이라,
                 * 여기까지 온 사람은 그 팝업에 실제로 갈 마음이 있다는 뜻이다.
                 *
                 * onClick 을 써도 이동을 막지 않는다 — trackVisitEvent 는 await 하지 않고
                 * keepalive 로 보내므로, 새 탭이 열리는 동안에도 전송이 끊기지 않는다.
                 */
                onClick={() => trackVisitEvent('outbound_click', { popupId: popup.id })}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-500 px-4 py-3 text-sm font-bold text-ink-900 transition hover:bg-lime-400"
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
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-foreground transition hover:bg-black/[0.03] dark:border-white/15 dark:hover:bg-white/[0.05]"
              >
                {t('detail.official')} <ExternalLink size={14} className="shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* 출처 / 신고 */}
        <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#111] md:p-6">
          {popup.sourceType === 'CRAWLED' && (
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sky-300/30 bg-sky-300/10 text-sky-500">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-muted-foreground">
                  {t('detail.sourceTitle')}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-foreground/70 md:text-sm">
                  {t('detail.sourceDesc1')} ({popup.sourceName || t('detail.externalSource')}){' '}
                  {t('detail.sourceDesc2')}
                </p>
                {popup.sourceUrl && (
                  <a
                    href={popup.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 underline dark:text-lime-400 md:text-sm"
                  >
                    {t('detail.viewSource')} <ExternalLink size={12} className="shrink-0" />
                  </a>
                )}
              </div>
            </div>
          )}
          <div
            className={`flex items-start gap-3 ${popup.sourceType === 'CRAWLED' ? 'border-t border-gray-100 pt-4 dark:border-white/5' : ''}`}
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 underline hover:text-red-400 md:text-sm"
              >
                {t('detail.reportAction')} <ShieldAlert size={12} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <TakedownModal
        open={takedownOpen}
        onOpenChange={setTakedownOpen}
        popupId={popup.id}
        popupName={popup.name}
      />
    </main>
  );
}
