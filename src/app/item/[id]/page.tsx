import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import ItemDetail from '@/components/ItemDetail';

/**
 * Dynamic Route: /item/[id]
 * Individual item detail page with server-side data fetching via API
 */
export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    // Step 107: Get authenticated session (optional for viewing)
    const session = await auth();
    const { id } = await params;

    // Step 107: Validate ID parameter
    if (!id) {
      notFound();
    }

    // Step 107: Fetch item data from our API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/items/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add authentication if user is logged in
      ...(session?.user && {
        headers: {
          ...(session?.user && { 'Cookie': `authjs.session-token=${session.user.id}` }),
        },
      }),
    });

    // Step 107: Handle API errors
    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`Failed to fetch item: ${response.status}`);
    }

    const data = await response.json();
    
    // Step 107: Check if item exists in response
    if (!data.item) {
      notFound();
    }

    const itemData = data.item;

    // Step 108: Render item detail using the ItemDetail component
    return <ItemDetail item={itemData} />;
  } catch (error) {
    console.error('Error loading item detail page:', error);
    notFound();
  }
}
