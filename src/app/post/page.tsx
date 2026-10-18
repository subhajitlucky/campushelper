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

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <div className="container mx-auto px-4">
        <PostItemForm />
      </div>
    </div>
  );
}
