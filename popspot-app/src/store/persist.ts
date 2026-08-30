import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoreApi } from 'zustand';

/**
 * 스토어 하나를 저장소에 붙인다 — zustand 의 {@code persist} 미들웨어 대신.
 *
 * <h3>왜 미들웨어를 안 쓰는가</h3>
 *
 * <p>{@code zustand/middleware} 는 하나의 진입점이라 {@code persist} 만 가져와도 <b>{@code devtools}
 * 까지 함께 번들에 들어온다.</b> 그 devtools 안에 {@code import.meta.env.MODE} 가 있는데, Metro 의
 * 웹 빌드는 그것을 모듈이 아닌 스크립트로 내보내서 브라우저가 <b>{@code SyntaxError: Cannot use
 * 'import.meta' outside a module}</b> 로 앱 전체를 못 켠다. 개발 서버뿐 아니라 프로덕션 웹 번들에도
 * 그대로 남는 것을 확인했다.
 *
 * <p>네이티브(안드로이드·iOS)는 멀쩡하다 — Metro 가 {@code import.meta} 를 자기 레지스트리로
 * 바꿔치기하기 때문이다. 그래서 이 문제는 <b>웹에서만</b> 드러나고, 안드로이드만 빌드해 보면
 * 끝까지 안 보인다.
 *
 * <p>필요한 것은 "켤 때 읽고, 바뀌면 쓴다" 뿐이라 스무 줄이면 된다. 쓰지도 않는 devtools 때문에
 * 한 플랫폼을 잃는 것보다 낫다.
 */

export interface PersistOptions<T> {
  /** 저장소 키. */
  name: string;
  /**
   * 저장할 조각만 골라낸다.
   *
   * <p>스토어에는 함수도 들어 있어서 통째로 직렬화하면 함수가 사라진 채 저장되고, 다음 실행에
   * 그것을 그대로 덮어쓰면 <b>동작이 없는 스토어</b>가 된다.
   */
  pick: (state: T) => Partial<T>;
}

/**
 * 스토어에 저장·복원을 붙인다.
 *
 * <p>복원은 비동기다. 첫 프레임은 기본값으로 그려지고, 읽고 나서 값이 있으면 바뀐다 — 저장소를
 * 기다리며 화면을 잡고 있으면 앱이 켜질 때마다 흰 화면이 스친다.
 *
 * <p>저장은 <b>덮어쓰기</b>다. 마지막 상태만 있으면 되므로 병합하지 않는다.
 */
export function attachPersist<T>(store: StoreApi<T>, options: PersistOptions<T>): void {
  AsyncStorage.getItem(options.name)
    .then((raw) => {
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      /* 저장된 값을 믿지 않는다 — 예전 버전이 다른 모양으로 넣어 두었을 수 있고, 그때 화면이
         죽는 것보다 기록을 잃는 편이 낫다. */
      if (saved && typeof saved === 'object') {
        store.setState(saved as Partial<T> as T, false);
      }
    })
    .catch(() => {});

  store.subscribe((state) => {
    AsyncStorage.setItem(options.name, JSON.stringify(options.pick(state))).catch(() => {});
  });
}
