import { PopupDetailPageContent } from '@/app/(ko)/popup/[id]/page';

export default async function JapanesePopupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PopupDetailPageContent params={params} includeEventJsonLd={false} />;
}
