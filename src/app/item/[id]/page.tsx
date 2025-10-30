import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

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

    // Step 106: Render item detail page
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {itemData.title}
            </h1>
            <div className="flex items-center gap-4 mt-4">
              {/* Item Type Badge */}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                itemData.itemType === 'LOST' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {itemData.itemType}
              </span>
              
              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                itemData.status === 'LOST' ? 'bg-red-100 text-red-800' :
                itemData.status === 'FOUND' ? 'bg-green-100 text-green-800' :
                itemData.status === 'CLAIMED' ? 'bg-blue-100 text-blue-800' :
                itemData.status === 'RESOLVED' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {itemData.status}
              </span>
              
              {/* Location */}
              <span className="text-gray-600">
                📍 {itemData.location}
              </span>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Item Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Description</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {itemData.description}
                </p>
              </div>

              {/* Images Section */}
              {itemData.images && itemData.images.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Images</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {itemData.images.map((image: string, index: number) => (
                      <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`${itemData.title} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - User Info & Actions */}
            <div className="space-y-6">
              {/* Posted By */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Posted By</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    {itemData.postedBy?.avatar ? (
                      <img
                        src={itemData.postedBy.avatar}
                        alt={itemData.postedBy.name || 'User'}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <span className="text-gray-600 font-medium">
                        {(itemData.postedBy?.name || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {itemData.postedBy?.name || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {itemData.postedBy?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Claimed By (if item is claimed) */}
              {itemData.claimedBy && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Claimed By</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {itemData.claimedBy.avatar ? (
                        <img
                          src={itemData.claimedBy.avatar}
                          alt={itemData.claimedBy.name || 'User'}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {(itemData.claimedBy.name || 'U')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {itemData.claimedBy.name || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {itemData.claimedBy.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Item Stats */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Comments</span>
                    <span className="font-medium">{itemData.commentCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Claims</span>
                    <span className="font-medium">{itemData.claimCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Posted</span>
                    <span className="font-medium">
                      {new Date(itemData.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions - Placeholder for future implementation */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                <div className="space-y-3">
                  {/* TODO: Add claim button for non-owners */}
                  {/* TODO: Add comment form */}
                  {/* TODO: Add share functionality */}
                  <p className="text-sm text-gray-500">
                    Additional actions will be available in future updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading item detail page:', error);
    notFound();
  }
}
