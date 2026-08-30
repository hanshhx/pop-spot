/**
 * 화면 목록 — 시안의 17개 화면이 그대로 들어 있다.
 *
 * <p>탭 내비게이터를 쓰지 않고 <b>스택 하나</b>에 전부 넣었다. 시안의 하단 독은 탭바가 아니기
 * 때문이다 — 다섯 칸 중 "더보기" 는 음악과 여권 <b>두</b> 화면에서 켜지고, 독 자체가 어떤 화면에서는
 * 사라진다(로그인·상세·길찾기). 탭 내비게이터에 그 규칙을 억지로 태우면 탭마다 스택이 하나씩 더
 * 생겨서, 상세에서 뒤로 갔을 때 어느 탭으로 돌아갈지가 화면마다 달라진다.
 *
 * <p>대신 {@code BottomDock} 을 필요한 화면이 직접 그린다. 어느 화면이 독을 갖는지가 그 화면
 * 파일에 적히므로 시안과 대조하기 쉽다.
 */
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  FindAccount: undefined;

  Home: undefined;
  /**
   * 전체보기. 검색 화면에서 검색어를 실어 보낼 수 있다 — 웹 PopAllModal 이 initialCategory 를
   * 받는 것과 같은 자리다. 예전에는 undefined 라, 검색하다 「나머지 N곳 보기」를 누르면 검색어가
   * 사라진 전체 목록이 열렸다.
   */
  PopAll: { keyword?: string; category?: string } | undefined;
  Search: undefined;
  /** 목록에서 고른 팝업. 상세만 다시 받아오지 않도록 통째로 넘긴다(웹도 같은 목록을 공유한다). */
  Detail: { id: number };

  Course: undefined;
  /** 일정 — 내가 본 팝업 + 전체 팝업 달력. 웹 홈의 SCHEDULE 탭과 같은 내용. */
  Schedule: undefined;
  Planner: undefined;
  /** 길찾기 주행. */
  Guide: undefined;

  Notifications: undefined;
  /** 잠금화면 알림 미리보기 — 실제 푸시가 어떻게 보이는지 비교하는 자리. */
  PushPreview: undefined;

  Music: undefined;
  Passport: undefined;
  My: undefined;
};

/** 하단 독이 가리키는 다섯 칸. */
export type DockTab = 'map' | 'course' | 'plan' | 'my' | 'more';
