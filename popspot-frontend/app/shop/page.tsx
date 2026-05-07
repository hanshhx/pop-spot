import { redirect } from "next/navigation";

/**
 * 상점 페이지는 V5 음악 추천 기능으로 대체되었습니다.
 * /shop 으로 들어온 모든 요청은 /music 으로 리다이렉트됩니다.
 */
export default function ShopRedirect() {
  redirect("/music");
}
