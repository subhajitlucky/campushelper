'use client';

import { useEffect, useState } from 'react';
import PostItemForm from "@/components/PostItemForm";

export default function PostPage() {
  const [pageTitle, setPageTitle] = useState('Post Item');

  useEffect(() => {
    // Check if we're in edit mode
    const storedItem = localStorage.getItem('editItem');
    if (storedItem) {
      try {
        const parsedItem = JSON.parse(storedItem);
        if (parsedItem?.isEdit) {
          setPageTitle('Edit Item');
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
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <PostItemForm />
      </div>
    </div>
  );
}
