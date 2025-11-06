'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const hasPrefilledFromStorage = useRef(false);

  // Initialize form validation
  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setFieldValue,
    setFieldTouched,
    validateForm,
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

  // Clear any lingering edit state on first load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // If we're on the post page for a new item, clear any edit state
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');
      if (!editId) {
        localStorage.removeItem('editItem');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasPrefilledFromStorage.current) {
      return;
    }

    const storedItem = localStorage.getItem('editItem');
    if (!storedItem) {
      return;
    }

    try {
      const parsedItem = JSON.parse(storedItem);

      if (parsedItem?.isEdit && parsedItem.id) {
        hasPrefilledFromStorage.current = true;
        setIsEditMode(true);
        setEditingItemId(parsedItem.id as string);
        setImageUrl(Array.isArray(parsedItem.images) && parsedItem.images.length > 0 ? parsedItem.images[0] : null);

        setFieldValue('title', parsedItem.title ?? '');
        setFieldValue('description', parsedItem.description ?? '');
        setFieldValue('itemType', parsedItem.itemType ?? 'LOST');
        setFieldValue('location', parsedItem.location ?? '');

        setTimeout(() => {
          setFieldTouched('title', true);
          setFieldTouched('description', true);
          setFieldTouched('itemType', true);
          setFieldTouched('location', true);
          validateForm();
        }, 0);
      } else {
        localStorage.removeItem('editItem');
      }
    } catch (err) {
      localStorage.removeItem('editItem');
      hasPrefilledFromStorage.current = true;
    }
  }, [setFieldTouched, setFieldValue, validateForm]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isEditMode || !editingItemId) {
      return;
    }

    const editData = {
      id: editingItemId,
      title: values.title,
      description: values.description,
      itemType: values.itemType,
      location: values.location,
      images: imageUrl ? [imageUrl] : [],
      isEdit: true,
    };

    localStorage.setItem('editItem', JSON.stringify(editData));
  }, [editingItemId, imageUrl, isEditMode, values.description, values.itemType, values.title, values.location]);

  // Handle form submission with authenticated fetch
  const onSubmit = async (formData: ItemFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      title: sanitizeInput(formData.title),
      description: sanitizeInput(formData.description),
      itemType: formData.itemType,
      location: sanitizeInput(formData.location),
      images: imageUrl ? [imageUrl] : []
    };

    try {
      if (isEditMode) {
        if (!editingItemId) {
          throw new Error('Unable to determine which item to update. Please try again.');
        }

        const response = await fetchWithAuth(`/api/items/${editingItemId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update item');
        }

        await response.json();
        setSuccess('Item updated successfully!');
        showSuccess('Item updated successfully!');
        localStorage.removeItem('editItem');
        setIsEditMode(false);
        setEditingItemId(null);
        router.push(`/item/${editingItemId}`);
        return;
      }

      const response = await fetchWithAuth('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post item');
      }

      await response.json();
      setSuccess('Item posted successfully!');
      showSuccess('Item posted successfully!');

      resetForm();
      setImageUrl(null);
    } catch (err: any) {
      const errorMessage = err.message || (isEditMode ? 'Failed to update item. Please try again.' : 'Failed to post item. Please try again.');
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
    <Card className={`max-w-2xl mx-auto p-6 ${isEditMode ? 'border-2 border-blue-400 shadow-lg' : ''} ${className}`}>
      {isEditMode && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white shadow-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <div>
            <p className="font-semibold text-sm">✏️ EDIT MODE</p>
            <p className="text-xs opacity-90">You are updating an existing item</p>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isEditMode ? 'Edit Item Details' : 'Post a Lost or Found Item'}
        </h1>
        <p className="text-gray-600">
          {isEditMode
            ? 'Update the information for your item. Changes are saved once you submit.'
            : 'Help reunite lost items with their owners or report items you\'ve found.'}
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
        <div className="flex gap-3">
          {isEditMode && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                localStorage.removeItem('editItem');
                router.push('/dashboard');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={!isValid || isSubmitting || isLoading || isAuthLoading}
            className={isEditMode ? 'flex-1' : 'w-full'}
          >
            {isLoading ? (
              <>
                <ButtonSpinner className="mr-2" />
                {isEditMode ? 'Saving Changes...' : 'Posting Item...'}
              </>
            ) : isAuthLoading ? (
              <>
                <ButtonSpinner className="mr-2" />
                Loading...
              </>
            ) : (
              isEditMode ? 'Save Changes' : 'Post Item'
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
