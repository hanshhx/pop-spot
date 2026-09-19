import { redirect } from 'next/navigation';

/**
 * /music 라우트는 홈의 MUSIC 탭으로 흡수되었다.
 * 북마크/외부 링크 호환을 위해 홈으로 보낸다.
 */
export default function MusicRedirect() {
  redirect('/?tab=music');
}
