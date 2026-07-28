import type { Metadata } from 'next';

import {
  SliceLandingPage,
  sliceMetadata,
  generateStaticParams as sliceParams,
} from '../../../popups/[slug]/page';

/**
 * 영어판 검색 랜딩.
 *
 * <p>슬러그·데이터·레이아웃은 한국어판과 <b>같은 것을 쓴다.</b> 문안만 언어별로 갈린다 — 페이지를
 * 통째로 복제하면 한쪽만 고치는 사고가 반드시 난다.
 *
 * <p>revalidate·dynamicParams 는 <b>재수출하지 않고 값을 직접 쓴다.</b> Next.js 가 이 설정을 빌드
 * 때 정적으로 읽어야 해서, 다른 파일에서 가져온 변수를 넣으면 빌드가 실패한다.
 */
export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = sliceParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return sliceMetadata(slug, 'en');
}

export default async function EnPopupsBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SliceLandingPage slug={slug} locale="en" />;
}
