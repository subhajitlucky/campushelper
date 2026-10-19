'use client';

import { useEffect } from 'react';
import PostItemForm from "@/components/PostItemForm";

export default function PostPage() {
  useEffect(() => {
    // Check if we're in edit mode
    const timer = setTimeout(() => {
      const storedItem = localStorage.getItem('editItem');
      if (storedItem) {
        try {
          const parsedItem = JSON.parse(storedItem);
          if (parsedItem?.isEdit) {
            document.title = 'Edit Item - Campus Helper';
          } else {
            document.title = 'Post Item - Campus Helper';
          }
        } catch {
          document.title = 'Post Item - Campus Helper';
        }
      } else {
        document.title = 'Post Item - Campus Helper';
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // The wash is opt-in on this element: a page that painted its own opaque
  // background would hide it. The form inside owns the column width and rhythm.
  return (
    <main className="page-canvas min-h-[70vh]">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <PostItemForm />
      </div>
    </main>
  );
}
