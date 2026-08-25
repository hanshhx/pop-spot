/**
 * public/seoul.pmtiles 에서 지하철역 이름·좌표를 뽑아 src/data/stations.json 을 만드는
 * 빌드타임 일회성 스크립트.
 *
 * <p>출구 번호는 뽑지 않는다. 이 아카이브의 subway_entrance 2,140개 중 이름에 출구 번호가
 * 붙은 것은 92개(30개 역)뿐이라, 무작정 최근접 조인을 하면 홍대입구·명동·여의도처럼 번호가
 * 없는 역 근처에서 엉뚱한 역의 출구 번호가 튀어나온다(예: 「신길역 3번 출구」). 그래서 pois
 * 레이어의 kind === 'station' 피처, 즉 역 이름만 쓴다 — 전부 이름은 있다.
 *
 * <p>z14 타일 전체를 아카이브 bounds 안에서 훑는다. getZxy 는 없는 타일에 null 을 돌려주므로
 * 그건 에러가 아니라 건너뛴다. 같은 역이 여러 타일 경계에 걸쳐 중복으로 나오므로 이름 기준으로
 * 중복 제거하고(좌표는 첫 번째 것), 재실행 때 diff 가 요동치지 않도록 이름 오름차순 정렬해
 * 커밋한다.
 *
 * 재생성: node scripts/extract-stations.mjs  (popspot-frontend/ 에서)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const { PMTiles } = await import('pmtiles');
const Pbf = (await import('pbf')).default;
const { VectorTile } = await import('@mapbox/vector-tile');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PMTILES_PATH = path.join(__dirname, '..', 'public', 'seoul.pmtiles');
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'stations.json');

// 아카이브 헤더 실측값(2026-08-25 검증). minZoom 0 / maxZoom 15 / tileType 1(MVT) /
// tileCompression 2(gzip). 처음엔 z14 로 훑었는데 63개뿐이었다 — station 피처마다 min_zoom 이
// 달라(대부분 14지만 일부는 15) z14 타일에는 아예 안 들어 있는 역이 있었다(홍대입구 실측:
// z14 타일엔 없고 z15 타일에만 있음). 그래서 아카이브의 maxZoom 인 z15 로 훑는다 — 더 상세한
// 줌일수록 더 많은 min_zoom 피처를 포함하므로 이 아카이브에서 나올 수 있는 역을 전부 담는다.
const Z = 15;
const BOUNDS = { minLng: 126.65, minLat: 37.35, maxLng: 127.3, maxLat: 37.75 };

class NodeSource {
  constructor(filePath) {
    this.path = filePath;
    this.fd = fs.openSync(filePath, 'r');
  }
  getKey() {
    return this.path;
  }
  async getBytes(offset, length) {
    const b = Buffer.alloc(length);
    fs.readSync(this.fd, b, 0, length, offset);
    return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
  }
}

/** 경위도 → 슬리피맵 타일 좌표(표준 웹 메르카토르 공식). */
function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

async function main() {
  const pm = new PMTiles(new NodeSource(PMTILES_PATH));

  // lat 는 커질수록 y 는 작아진다(메르카토르가 북쪽일수록 y 감소) — xMin/xMax 는 lng 로,
  // yMin/yMax 는 위/아래 위도를 뒤집어서 구한다.
  const topLeft = lngLatToTile(BOUNDS.minLng, BOUNDS.maxLat, Z);
  const bottomRight = lngLatToTile(BOUNDS.maxLng, BOUNDS.minLat, Z);

  const byName = new Map();
  let tilesChecked = 0;
  let tilesPresent = 0;

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tilesChecked++;
      const tile = await pm.getZxy(Z, x, y);
      if (!tile) continue; // 아카이브에 없는 타일 — 에러가 아니라 건너뛴다.
      tilesPresent++;

      let raw = Buffer.from(tile.data);
      if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);

      const vt = new VectorTile(new Pbf(raw));
      const layer = vt.layers.pois;
      if (!layer) continue;

      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.properties.kind !== 'station') continue;

        const rawName = f.properties['name:ko'] || f.properties.name || '';
        const name = String(rawName).trim();
        if (!name) continue; // 빈 이름은 버린다.
        if (byName.has(name)) continue; // 이름 기준 중복 제거 — 먼저 본 좌표를 유지한다.

        const geo = f.toGeoJSON(x, y, Z);
        const [lng, lat] = geo.geometry.coordinates;
        // 타일에는 렌더링 연속성을 위한 버퍼가 있어, bbox 경계에 걸친 타일은 그 밖의 좌표를
        // 가진 피처도 함께 들고 있을 수 있다(실측: 의정부·인천 외곽 12곳이 이렇게 새어 들어옴).
        // 아카이브가 스스로 광고하는 bounds 밖 좌표는 걸러, 커밋되는 데이터가 항상 그 범위
        // 안이라고 믿을 수 있게 한다.
        if (
          lat < BOUNDS.minLat ||
          lat > BOUNDS.maxLat ||
          lng < BOUNDS.minLng ||
          lng > BOUNDS.maxLng
        )
          continue;
        byName.set(name, {
          name,
          lat: Math.round(lat * 1e6) / 1e6,
          lng: Math.round(lng * 1e6) / 1e6,
        });
      }
    }
  }

  const stations = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  fs.writeFileSync(OUT_PATH, JSON.stringify(stations, null, 2) + '\n');

  console.log(`tiles checked: ${tilesChecked}, present: ${tilesPresent}`);
  console.log(`stations: ${stations.length}`);
  console.log(`wrote: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
