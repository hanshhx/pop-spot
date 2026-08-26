// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useHistoryBackedModal, type HistoryBackedModal } from './useHistoryBackedModal';

/**
 * 훅을 직접 부르는 최소 하네스. {@code onApi} 는 매 렌더마다 최신 반환값을 밖으로 흘려보낸다 —
 * 실제 다이얼로그(AllTrendingModal) 없이 훅의 규칙만 검증하기 위해서다.
 */
function Harness({
  open,
  onOpenChange,
  onApi,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onApi: (api: HistoryBackedModal) => void;
}) {
  const api = useHistoryBackedModal(open, onOpenChange);
  onApi(api);
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount(): Root {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  return root;
}

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('useHistoryBackedModal', () => {
  it('열릴 때 history 항목을 정확히 하나 push 한다', async () => {
    const onOpenChange = vi.fn();
    const r = mount();
    await act(async () => {
      r.render(<Harness open={false} onOpenChange={onOpenChange} onApi={vi.fn()} />);
    });
    const before = window.history.length;

    await act(async () => {
      r.render(<Harness open={true} onOpenChange={onOpenChange} onApi={vi.fn()} />);
    });

    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toEqual({ popspotModal: true });
  });

  it('React StrictMode 가 마운트를 두 번 시뮬레이션해도 push 는 한 번만 일어난다', async () => {
    // 이 테스트가 실패하면(길이가 +2 라면) 실제로는 개발 모드에서 목록을 한 번 열었는데
    // 뒤로가기를 두 번 눌러야 닫히는 버그로 나타난다 — Task 3 이 같은 부류의 버그를
    // "고쳤다고 생각했는데 StrictMode 이중 실행 때문에 조용히 깨졌다" 로 기록한 바로 그 함정이다.
    const onOpenChange = vi.fn();
    const before = window.history.length;
    const r = mount();

    await act(async () => {
      r.render(
        <StrictMode>
          <Harness open={true} onOpenChange={onOpenChange} onApi={vi.fn()} />
        </StrictMode>,
      );
    });

    expect(window.history.length).toBe(before + 1);
  });

  it('브라우저 뒤로가기(popstate)는 추가로 back() 을 부르지 않고 상태만 닫는다', async () => {
    const onOpenChange = vi.fn();
    const r = mount();
    await act(async () => {
      r.render(<Harness open={true} onOpenChange={onOpenChange} onApi={vi.fn()} />);
    });
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    // 실제 브라우저라면 이 시점에 항목은 이미 소비된 뒤다 — 우리는 이벤트만 흉내 낸다.
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('사용자가 직접 닫으면(Escape·바깥 클릭·닫기 버튼) 쌓인 항목을 back() 으로 소비한다', async () => {
    const onOpenChange = vi.fn();
    let api: HistoryBackedModal | null = null;
    const r = mount();
    await act(async () => {
      r.render(<Harness open={true} onOpenChange={onOpenChange} onApi={(a) => (api = a)} />);
    });
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    await act(async () => {
      api!.onOpenChange(false);
    });

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('다른 페이지로 이동하려는 닫힘은 notifyNavigatingAway 뒤에 back() 을 부르지 않는다', async () => {
    // 카드를 눌러 상세로 갈 때의 경로다. 여기서 back() 을 부르면(트랩 2) 뒤이은 라우팅과
    // 경합해 history 스택이 타이밍에 따라 달라진다 — 그래서 이 경로는 back() 을 아예 안 부른다.
    const onOpenChange = vi.fn();
    let api: HistoryBackedModal | null = null;
    const r = mount();
    await act(async () => {
      r.render(<Harness open={true} onOpenChange={onOpenChange} onApi={(a) => (api = a)} />);
    });
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);

    await act(async () => {
      api!.notifyNavigatingAway();
      api!.onOpenChange(false);
    });

    expect(backSpy).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
