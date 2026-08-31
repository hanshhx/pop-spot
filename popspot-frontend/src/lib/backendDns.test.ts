import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBackendLookup,
  isPubliclyRoutableIpv4,
  parseDohAnswer,
  resetBackendDnsForTest,
  resolvePublicIpv4,
} from './backendDns';

const systemLookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns', () => ({ lookup: systemLookup }));

const HOST = 'vm-113.tailc57dd4.ts.net';

function dohResponse(answers: unknown[]) {
  return {
    ok: true,
    json: async () => ({ Answer: answers }),
  } as unknown as Response;
}

function aRecord(data: string, TTL = 300) {
  return { name: HOST, type: 1, TTL, data };
}

beforeEach(() => {
  resetBackendDnsForTest();
  systemLookup.mockReset();
  systemLookup.mockImplementation((_host: string, _options: unknown, callback: unknown) => {
    (callback as (e: null, a: string, f: number) => void)(null, '9.9.9.9', 4);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPubliclyRoutableIpv4', () => {
  it('공인 주소는 통과시킨다', () => {
    expect(isPubliclyRoutableIpv4('103.84.155.153')).toBe(true);
    expect(isPubliclyRoutableIpv4('8.8.8.8')).toBe(true);
    expect(isPubliclyRoutableIpv4('1.1.1.1')).toBe(true);
  });

  /* 이 대역이 이 파일이 존재하는 이유다 — Tailscale 이 funnel 아닌 노드에 싣는 주소이고,
     Vercel 함수는 tailnet 에 없으므로 그리로 붙으면 응답 없이 시간만 끈다. */
  it('Tailscale 내부 대역(100.64.0.0/10)을 막는다', () => {
    expect(isPubliclyRoutableIpv4('100.99.233.107')).toBe(false); // 실제로 물려 있던 주소
    expect(isPubliclyRoutableIpv4('100.64.0.0')).toBe(false);
    expect(isPubliclyRoutableIpv4('100.127.255.255')).toBe(false);
  });

  it('그 대역 바로 바깥은 막지 않는다', () => {
    expect(isPubliclyRoutableIpv4('100.63.255.255')).toBe(true);
    expect(isPubliclyRoutableIpv4('100.128.0.0')).toBe(true);
  });

  it('사설·루프백·링크로컬·멀티캐스트를 막는다', () => {
    expect(isPubliclyRoutableIpv4('10.0.0.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('172.16.0.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('172.31.255.255')).toBe(false);
    expect(isPubliclyRoutableIpv4('192.168.1.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('127.0.0.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('169.254.1.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('224.0.0.1')).toBe(false);
    expect(isPubliclyRoutableIpv4('0.0.0.0')).toBe(false);
  });

  it('172.16/12 바깥의 172 는 막지 않는다', () => {
    expect(isPubliclyRoutableIpv4('172.15.0.1')).toBe(true);
    expect(isPubliclyRoutableIpv4('172.32.0.1')).toBe(true);
  });

  it('IPv4 가 아닌 것을 통과시키지 않는다', () => {
    expect(isPubliclyRoutableIpv4('2403:2500:400:20::e8e')).toBe(false);
    expect(isPubliclyRoutableIpv4('1.2.3')).toBe(false);
    expect(isPubliclyRoutableIpv4('1.2.3.256')).toBe(false);
    expect(isPubliclyRoutableIpv4('1.2.3.a')).toBe(false);
    expect(isPubliclyRoutableIpv4('')).toBe(false);
  });
});

describe('parseDohAnswer', () => {
  it('A 레코드만 골라낸다', () => {
    const parsed = parseDohAnswer({
      Answer: [
        { name: HOST, type: 5, TTL: 300, data: 'other.example.' }, // CNAME
        aRecord('103.84.155.153'),
        aRecord('103.84.155.217'),
      ],
    });
    expect(parsed.addresses).toEqual(['103.84.155.153', '103.84.155.217']);
  });

  it('CGNAT 주소가 섞여 오면 그것만 버린다', () => {
    const parsed = parseDohAnswer({
      Answer: [aRecord('100.99.233.107'), aRecord('103.84.155.153')],
    });
    expect(parsed.addresses).toEqual(['103.84.155.153']);
  });

  it('쓸 주소가 없으면 빈 목록을 준다', () => {
    expect(parseDohAnswer({ Answer: [aRecord('100.99.233.107')] }).addresses).toEqual([]);
    expect(parseDohAnswer({ Answer: [] }).addresses).toEqual([]);
    expect(parseDohAnswer({}).addresses).toEqual([]);
    expect(parseDohAnswer(null).addresses).toEqual([]);
  });

  it('TTL 을 30초~5분 사이로 자른다', () => {
    expect(parseDohAnswer({ Answer: [aRecord('1.2.3.4', 5)] }).ttlMs).toBe(30_000);
    expect(parseDohAnswer({ Answer: [aRecord('1.2.3.4', 60)] }).ttlMs).toBe(60_000);
    expect(parseDohAnswer({ Answer: [aRecord('1.2.3.4', 86_400)] }).ttlMs).toBe(300_000);
  });

  it('여러 TTL 중 가장 짧은 것을 쓴다', () => {
    const parsed = parseDohAnswer({
      Answer: [aRecord('1.2.3.4', 240), aRecord('5.6.7.8', 90)],
    });
    expect(parsed.ttlMs).toBe(90_000);
  });
});

describe('resolvePublicIpv4', () => {
  it('한 번 푼 결과를 다시 묻지 않는다', async () => {
    const fetchMock = vi.fn(async () => dohResponse([aRecord('103.84.155.153')]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await resolvePublicIpv4(HOST)).toEqual(['103.84.155.153']);
    expect(await resolvePublicIpv4(HOST)).toEqual(['103.84.155.153']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('동시에 들어온 요청을 하나로 합친다', async () => {
    const fetchMock = vi.fn(async () => dohResponse([aRecord('103.84.155.153')]));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([resolvePublicIpv4(HOST), resolvePublicIpv4(HOST)]);
    expect(first).toEqual(['103.84.155.153']);
    expect(second).toEqual(['103.84.155.153']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('첫 곳이 죽으면 다음 곳으로 넘어간다', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(dohResponse([aRecord('103.84.155.217')]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await resolvePublicIpv4(HOST)).toEqual(['103.84.155.217']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('두 곳 다 실패하면 빈 목록을 준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await resolvePublicIpv4(HOST)).toEqual([]);
  });
});

describe('createBackendLookup', () => {
  it('맡은 이름은 DoH 로 푼 공인 주소를 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => dohResponse([aRecord('103.84.155.153')])),
    );
    const lookup = createBackendLookup(HOST);

    const result = await new Promise((resolve) => {
      lookup(HOST, {}, (error, address, family) => resolve({ error, address, family }));
    });

    expect(result).toEqual({ error: null, address: '103.84.155.153', family: 4 });
    expect(systemLookup).not.toHaveBeenCalled();
  });

  it('주소가 둘이면 돌려 가며 쓴다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => dohResponse([aRecord('103.84.155.153'), aRecord('103.84.155.217')])),
    );
    const lookup = createBackendLookup(HOST);
    const pick = () =>
      new Promise((resolve) => {
        lookup(HOST, {}, (_error, address) => resolve(address));
      });

    expect([await pick(), await pick(), await pick()]).toEqual([
      '103.84.155.153',
      '103.84.155.217',
      '103.84.155.153',
    ]);
  });

  it('all 을 요구하면 목록으로 준다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => dohResponse([aRecord('103.84.155.153'), aRecord('103.84.155.217')])),
    );
    const lookup = createBackendLookup(HOST);

    const addresses = await new Promise((resolve) => {
      lookup(HOST, { all: true }, (_error, value) => resolve(value));
    });

    expect(addresses).toEqual([
      { address: '103.84.155.153', family: 4 },
      { address: '103.84.155.217', family: 4 },
    ]);
  });

  /* 이 모듈은 "더 나빠질 수 없는" 자리에 있어야 한다. 아래 둘이 그 약속이다. */
  it('맡지 않은 이름은 시스템 해석으로 넘긴다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const lookup = createBackendLookup(HOST);

    const address = await new Promise((resolve) => {
      lookup('example.com', {}, (_error, value) => resolve(value));
    });

    expect(address).toBe('9.9.9.9');
    expect(systemLookup).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DoH 가 아무것도 못 주면 시스템 해석으로 되돌아간다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const lookup = createBackendLookup(HOST);

    const address = await new Promise((resolve) => {
      lookup(HOST, {}, (_error, value) => resolve(value));
    });

    expect(address).toBe('9.9.9.9');
    expect(systemLookup).toHaveBeenCalledTimes(1);
  });
});
