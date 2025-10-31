'use client';

import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { setSafeErrorMessage } from '@/lib/security';
import { showSuccess, showError } from '@/lib/toast-config';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import ValidationInput from '@/components/forms/ValidationInput';
import FieldError from '@/components/forms/FieldError';
import FormError from '@/components/forms/FormError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useApiRequest } from '@/hooks/useApiRequest';
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

  // Create API request function
  const createItem = async (formData: ItemFormValues) => {
    const itemData = {
      ...formData,
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
      throw new Error(JSON.stringify(errorData));
    }

    return await response.json();
  };

  // Use API request hook
  const {
    data,
    error,
    isLoading,
    isError,
    execute
  } = useApiRequest(createItem, {
    showToast: true,
    successMessage: 'Item posted successfully!',
    errorMessage: 'Failed to post item. Please try again.',
    onSuccess: (result) => {
      console.log('Item created:', result);
      resetForm();
      // Redirect after short delay to show success toast
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    },
    onError: (apiError) => {
      console.error('API Error:', apiError);
      // Could update form state based on specific error codes here
      if (apiError.code === 'AUTHENTICATION_REQUIRED') {
        router.push('/auth/login');
      }
    }
  });

  const onSubmit = async (formData: ItemFormValues) => {
    await execute(formData);
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
      <FormError error={error?.error} className="mb-6" />
      
      {/* Success Message */}
      {data && !isError && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 mb-6">
          <p>✅ Item posted successfully! Redirecting...</p>
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
            className={errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
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

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={!isValid || isSubmitting || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <ButtonSpinner className="mr-2" />
              Posting Item...
            </>
          ) : (
            `Post ${values.itemType === 'LOST' ? 'Lost' : 'Found'} Item`
          )}
        </Button>
      </form>
    </Card>
  );
}
