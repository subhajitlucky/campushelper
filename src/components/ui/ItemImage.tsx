import Image from 'next/image';

interface ItemImageProps {
  images?: string[] | null;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
}

/**
 * ItemImage Component
 *
 * Displays an item image with automatic fallback to placeholder.
 * Features:
 * - Shows first image from array if available
 * - Displays placeholder icon when no images
 * - Handles image load errors gracefully
 * - Supports different aspect ratios (video or square)
 */
export default function ItemImage({
  images,
  alt,
  className = '',
  aspectRatio = 'video'
}: ItemImageProps) {
  const aspectClass = aspectRatio === 'square' ? 'aspect-square' : 'aspect-video';

  if (images && images.length > 0) {
    return (
      <div className={`bg-gray-100 overflow-hidden ${aspectClass} ${className}`}>
        <Image
          src={images[0]}
          alt={alt}
          width={400}
          height={aspectRatio === 'square' ? 400 : 225}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className={`bg-gray-100 flex items-center justify-center ${aspectClass} ${className}`}>
      <svg
        className="w-12 h-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}
