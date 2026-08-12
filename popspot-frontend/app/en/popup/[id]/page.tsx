import { PopupDetailPageContent } from '../../../popup/[id]/page';

export default async function EnglishPopupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PopupDetailPageContent params={params} includeEventJsonLd={false} />;
}
