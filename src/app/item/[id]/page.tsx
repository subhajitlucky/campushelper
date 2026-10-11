import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getItemDetailForViewer, type ItemDetailData } from '@/lib/item-detail';
import ItemDetail from '@/components/ItemDetail';

/**
 * Dynamic Route: /item/[id]
 * Individual item detail page with server-side data fetching
 */
export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Validate ID parameter
  if (!id) {
    notFound();
  }

  let itemData: ItemDetailData | null = null;

  try {
    const session = await getSession();
    const viewer = session?.user?.id
      ? { id: session.user.id, role: session.user.role }
      : null;

    itemData = await getItemDetailForViewer(id, viewer);
  } catch (error) {
    console.error('[item page] Failed to load item:', error);
    itemData = null;
  }

  if (!itemData) {
    notFound();
  }

  // Render item detail using the ItemDetail component
  return <ItemDetail item={itemData} />;
}
