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

  // The composer owns its own `<main>`, width and rhythm: it needs a full-width
  // two-column layout, and a `max-w-2xl` wrapper here silently capped the grid
  // at 576px (measured), which collapsed both columns.
  return <PostItemForm />;
}
