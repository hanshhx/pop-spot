/*
 * 공식 CI 섹션 로고 SVG → React 컴포넌트(BrandLogos.tsx) 생성기.
 *
 * public/brand/*.svg 의 검정(#040000 등)을 currentColor 로 치환해 라이트/다크·배경에 적응시킨다.
 * (태그라인은 흰색 #f6f6f6 글자 파트도 있어 단색화 — 흑·백 모두 currentColor, 라임/핑크는 유지.)
 *
 * 재생성: node popspot-frontend/scripts/gen-brand-logos.cjs
 */
const fs = require("fs");
const path = require("path");

const dir = path.join("popspot-frontend", "public", "brand");
const out = path.join("popspot-frontend", "src", "components", "layout", "BrandLogos.tsx");

const MAP = {
  "pop-look": "popspot-pop-look.svg",
  "popup-calendar": "popspot-popup-calendar.svg",
  "search-zone": "popspot-search-zone.svg",
  "powered-by": "popspot-powered-by.svg",
  tagline: "popspot-tagline.svg",
};

function clean(svg, isTagline) {
  let s = svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sid="[^"]*"/g, "")
    .replace(/\sdata-name="[^"]*"/g, "")
    .replace(/#040000/gi, "currentColor")
    .replace(/#060203/gi, "currentColor");
  if (isTagline) s = s.replace(/#f6f6f6/gi, "currentColor");
  // 줄바꿈/중복 공백은 단일 공백으로 (속성 사이 구분 유지).
  return s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

const entries = Object.entries(MAP)
  .map(([key, file]) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    return '  "' + key + '": `' + clean(raw, key === "tagline") + "`,";
  })
  .join("\n");

const tsx =
  'import { cn } from "@/lib/utils";\n\n' +
  "/*\n" +
  " * 자동 생성 — `node popspot-frontend/scripts/gen-brand-logos.cjs`. 직접 수정 금지.\n" +
  " * 공식 CI 섹션 로고. 검정(#040000 등)은 currentColor 로 치환되어 라이트/다크·배경에 적응한다.\n" +
  " */\n" +
  "const SVGS: Record<string, string> = {\n" +
  entries +
  "\n};\n\n" +
  "export type SectionLogoName = keyof typeof SVGS;\n\n" +
  "/** 공식 CI 섹션 로고. height(h-*)로 크기, text-*로 색(검정 파트=currentColor)을 제어. */\n" +
  "export function SectionLogo({\n" +
  "  name,\n" +
  "  className,\n" +
  "  label,\n" +
  "}: {\n" +
  "  name: SectionLogoName;\n" +
  "  className?: string;\n" +
  "  label?: string;\n" +
  "}) {\n" +
  "  const svg = SVGS[name];\n" +
  "  if (!svg) return null;\n" +
  "  return (\n" +
  "    <span\n" +
  '      role="img"\n' +
  "      aria-label={label ?? name}\n" +
  '      className={cn("inline-flex items-center [&>svg]:block [&>svg]:h-full [&>svg]:w-auto", className)}\n' +
  "      dangerouslySetInnerHTML={{ __html: svg }}\n" +
  "    />\n" +
  "  );\n" +
  "}\n";

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, tsx);
console.log("wrote " + out);
Object.keys(MAP).forEach((k) => {
  const m = tsx.match(new RegExp('"' + k + '": `([^`]*)`'));
  console.log("  " + k + ": " + (m ? m[1].length : 0) + " chars");
});
