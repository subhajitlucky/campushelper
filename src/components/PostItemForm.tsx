'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { sanitizeInput } from '@/lib/security';
import { showSuccess, showError } from '@/lib/toast-config';
import { useAuthFetch } from '@/lib/auth-fetch';
import ImageUpload from '@/components/ImageUpload';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import ValidationInput from '@/components/forms/ValidationInput';
import FieldError from '@/components/forms/FieldError';
import FormError from '@/components/forms/FormError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { createItemSchema } from '@/lib/schemas/item';
import { ButtonSpinner } from '@/components/ui/loading-spinner';

// Form schema for validation (without images for better UX)
const postItemSchema = createItemSchema.omit({ images: true });

type ItemFormValues = z.infer<typeof postItemSchema>;

interface PostItemFormProps {
  className?: string;
}

export default function PostItemForm({ className }: PostItemFormProps) {
  const router = useRouter();
  const { fetchWithAuth, isLoading: isAuthLoading } = useAuthFetch(true); // Require authentication
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Initialize form validation
  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    getFieldProps,
    handleSubmit,
    resetForm
  } = useFormValidation({
    schema: postItemSchema,
    initialValues: {
      title: '',
      description: '',
      itemType: 'LOST' as 'LOST' | 'FOUND',
      location: '',
    },
    validateOnChange: true,
    validateOnBlur: true
  });

  // Handle form submission with authenticated fetch
  const onSubmit = async (formData: ItemFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const itemData = {
        title: sanitizeInput(formData.title),
        description: sanitizeInput(formData.description),
        itemType: formData.itemType,
        location: sanitizeInput(formData.location),
        images: imageUrl ? [imageUrl] : [] // Optional image
      };

      const response = await fetchWithAuth('/api/items', {
        method: 'POST',
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post item');
      }

      const data = await response.json();
      setSuccess('Item posted successfully!');
      showSuccess('Item posted successfully!');

      // Reset form and image
      resetForm();
      setImageUrl(null);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to post item. Please try again.';
      setError(errorMessage);
      showError(errorMessage);

      if (err.message?.toLowerCase().includes('auth')) {
        setTimeout(() => {
          router.push('/auth/login');
        }, 1500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`max-w-2xl mx-auto p-6 ${className}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Post a Lost or Found Item</h1>
        <p className="text-gray-600">
          Help reunite lost items with their owners or report items you've found.
        </p>
      </div>

      {/* API Error Display */}
      <FormError error={error || undefined} className="mb-6" />

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 mb-6">
          <p>✅ {success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Item Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Item Status
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="itemType"
                value="LOST"
                checked={values.itemType === 'LOST'}
                onChange={(e) => getFieldProps('itemType').onChange(e)}
                onBlur={getFieldProps('itemType').onBlur}
                className="mr-2"
              />
              <span className="text-sm font-medium text-red-700">🔍 I Lost This</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="itemType"
                value="FOUND"
                checked={values.itemType === 'FOUND'}
                onChange={(e) => getFieldProps('itemType').onChange(e)}
                onBlur={getFieldProps('itemType').onBlur}
                className="mr-2"
              />
              <span className="text-sm font-medium text-green-700">✨ I Found This</span>
            </label>
          </div>
          <FieldError error={errors.itemType} />
        </div>

        {/* Title Field */}
        <ValidationInput
          {...getFieldProps('title')}
          label="Item Title"
          placeholder="e.g., Black iPhone 13, Blue Nike Shoes, Car Keys"
          error={errors.title}
          isValid={!!values.title && !errors.title}
          showCheckIcon={true}
          helperText="Give a brief, descriptive title for the item"
        />

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <Textarea
            {...getFieldProps('description')}
            placeholder="Describe the item in detail... Where did you lose/find it? What makes it unique?"
            rows={4}
            className={errors.description 
              ? 'border-red-300 focus:border-red-500' 
              : ''
            }
          />
          <FieldError error={errors.description} />
          <p className="text-sm text-gray-500 mt-1">
            {values.description.length}/2000 characters
          </p>
        </div>

        {/* Location Field */}
        <ValidationInput
          {...getFieldProps('location')}
          label="Location"
          placeholder="e.g., Library, Cafeteria, Parking Lot A"
          error={errors.location}
          isValid={!!values.location && !errors.location}
          showCheckIcon={true}
          helperText="Where was the item lost or found?"
        />

        {/* Image Upload Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Item Image (Optional)
          </label>
          <ImageUpload
            onImageUpload={setImageUrl}
            onImageRemove={() => setImageUrl(null)}
            currentImage={imageUrl}
          />
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={!isValid || isSubmitting || isLoading || isAuthLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <ButtonSpinner className="mr-2" />
              Posting Item...
            </>
          ) : isAuthLoading ? (
            <>
              <ButtonSpinner className="mr-2" />
              Loading...
            </>
          ) : (
            `Post ${values.itemType === 'LOST' ? 'Lost' : 'Found'} Item`
          )}
        </Button>
      </form>
    </Card>
  );
}
