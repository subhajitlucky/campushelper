import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
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
    const { id } = await params;

    // Step 107: Validate ID parameter
    if (!id) {
      notFound();
    }

    // Step 107: Fetch item data from our API endpoint
    const cookieHeader = cookies().toString();
    const headersList = await headers();

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      (headersList.get('x-forwarded-host')
        ? `${headersList.get('x-forwarded-proto') || 'https'}://${headersList.get('x-forwarded-host')}`
        : headersList.get('host')
          ? `${headersList.get('x-forwarded-proto') || 'https'}://${headersList.get('host')}`
          : 'http://localhost:3000');

    const response = await fetch(`${baseUrl}/api/items/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: 'no-store',
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
    notFound();
  }
}
