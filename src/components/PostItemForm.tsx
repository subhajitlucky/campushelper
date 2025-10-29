'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { createItemSchema } from '@/lib/schemas/item';

// Form-specific schema without images to save database space
const postItemFormSchema = createItemSchema.omit({ images: true });

type ItemFormValues = z.infer<typeof postItemFormSchema>;

interface PostItemFormProps {
  className?: string;
}

export default function PostItemForm({ className }: PostItemFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(postItemFormSchema),
    defaultValues: {
      title: '',
      description: '',
      itemType: 'LOST',
      location: '',
    },
  });

  const onSubmit = async (data: ItemFormValues) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      // Add empty images array to save database space
      const itemData = {
        ...data,
        images: [] // Empty array to save database space
      };

      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create item');
      }

      const result = await response.json();
      console.log('Item created:', result);

      // Reset form and redirect to dashboard
      form.reset();
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Error creating item:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to create item. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`w-full max-w-2xl mx-auto p-6 ${className}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Post an Item</h1>
        <p className="text-gray-600 mt-2">
          Report a lost item or announce something you found on campus. Provide detailed text descriptions.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Title Field */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Red iPhone 15, Blue Backpack"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description Field */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Provide detailed description of the item including color, size, brand, unique features, etc. Be as specific as possible since no images are included..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Item Type Field */}
          <FormField
            control={form.control}
            name="itemType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Item Type</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    {...field}
                  >
                    <option value="LOST">LOST</option>
                    <option value="FOUND">FOUND</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location Field */}
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Main Library, Engineering Building, Cafeteria"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Error Message */}
          {errorMessage && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {errorMessage}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Creating...' : 'Create Item'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
