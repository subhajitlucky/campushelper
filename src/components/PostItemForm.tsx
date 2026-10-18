'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { sanitizeInput } from '@/lib/security';
import { showSuccess, showError } from '@/lib/toast-config';
import { useAuthFetch } from '@/lib/auth-fetch';
import {
  MAX_TAGS_PER_ITEM,
  MAX_TAG_LENGTH,
  MIN_TAG_LENGTH,
  normalizeTag,
} from '@/lib/schemas/taxonomy';
import ImageUpload from '@/components/ImageUpload';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import TagPill from '@/components/ui/TagPill';
import ValidationInput from '@/components/forms/ValidationInput';
import FieldError from '@/components/forms/FieldError';
import FormError from '@/components/forms/FormError';
import { useFormValidation } from '@/hooks/useFormValidation';
import { createItemSchema } from '@/lib/schemas/item';
import { ButtonSpinner } from '@/components/ui/loading-spinner';

// Form schema for validation (without images for better UX).
//
// The taxonomy fields are omitted because `useFormValidation` is string-only:
// tags are an array and the coordinates are numbers. Category, zone, and tags
// are held in local state and merged into the submitted payload.
const postItemSchema = createItemSchema.omit({
  images: true,
  categorySlug: true,
  zoneSlug: true,
  tags: true,
  latitude: true,
  longitude: true,
});

type ItemFormValues = z.infer<typeof postItemSchema>;

/** A category as returned by `GET /api/categories`. */
interface CategoryOption {
  id: string;
  slug: string;
  name: string;
}

/** A campus zone as returned by `GET /api/zones`. */
interface ZoneOption {
  id: string;
  slug: string;
  name: string;
}

/** One candidate from a 409 `DUPLICATE_SUSPECTED` response. */
interface DuplicateCandidate {
  id: string;
  title: string;
  itemType: 'LOST' | 'FOUND';
  location: string;
  createdAt: string;
  score: number;
  reasons: { code: string; label: string; weight: number }[];
}

/**
 * A duplicate warning plus the exact payload that produced it, so "Post anyway"
 * resubmits what the server already reviewed.
 *
 * The response's `details.hint` is deliberately not kept: it documents the
 * transport flag ("resend with acknowledgeDuplicates") rather than anything a
 * user should read.
 */
interface DuplicateWarning {
  candidates: DuplicateCandidate[];
  payload: Record<string, unknown>;
}

/** The tag shape the API accepts once normalised. */
const TAG_PATTERN = /^[a-z0-9-]+$/;

/**
 * Normalise and validate a tag list in one pass.
 *
 * Duplicates are folded (the API does the same), but anything malformed is
 * reported instead of being silently dropped, and the valid tags are kept.
 */
function normalizeTags(rawTags: string[]): { tags: string[]; error: string | null } {
  const tags: string[] = [];
  let error: string | null = null;

  for (const raw of rawTags) {
    const normalized = normalizeTag(raw);

    if (!normalized) {
      continue;
    }

    if (normalized.length < MIN_TAG_LENGTH) {
      error ??= `Tags must be at least ${MIN_TAG_LENGTH} characters: "${normalized}" was not added.`;
      continue;
    }

    if (normalized.length > MAX_TAG_LENGTH) {
      error ??= `Tags must be ${MAX_TAG_LENGTH} characters or fewer: "${normalized}" was not added.`;
      continue;
    }

    if (!TAG_PATTERN.test(normalized)) {
      error ??= `"${normalized}" is not a valid tag: use letters, numbers, and hyphens only.`;
      continue;
    }

    if (tags.includes(normalized)) {
      continue;
    }

    if (tags.length >= MAX_TAGS_PER_ITEM) {
      error ??= `You can add up to ${MAX_TAGS_PER_ITEM} tags.`;
      continue;
    }

    tags.push(normalized);
  }

  return { tags, error };
}

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

  // Taxonomy lives outside the form-validation hook, which is string-only.
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [categorySlug, setCategorySlug] = useState('');
  const [zoneSlug, setZoneSlug] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

  // Initialize form validation
  const {
    values,
    errors,
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

  // Optional taxonomy for the category and zone selects. A failure here must
  // not block posting, so the selects simply stay empty.
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let cancelled = false;

    const fetchTaxonomy = async () => {
      try {
        const [categoriesResponse, zonesResponse] = await Promise.all([
          fetchWithAuth('/api/categories'),
          fetchWithAuth('/api/zones'),
        ]);

        const [categoriesData, zonesData] = await Promise.all([
          categoriesResponse.ok ? categoriesResponse.json() : { categories: [] },
          zonesResponse.ok ? zonesResponse.json() : { zones: [] },
        ]);

        if (cancelled) {
          return;
        }

        setCategories(categoriesData.categories || []);
        setZones(zonesData.zones || []);
      } catch {
        // Taxonomy is optional: the form still posts without it.
      } finally {
        if (!cancelled) {
          setTaxonomyLoading(false);
        }
      }
    };

    fetchTaxonomy();

    return () => {
      cancelled = true;
    };
  }, [fetchWithAuth, isAuthLoading]);

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

        // Taxonomy is restored too when the stored item carries it.
        setCategorySlug(typeof parsedItem.categorySlug === 'string' ? parsedItem.categorySlug : '');
        setZoneSlug(typeof parsedItem.zoneSlug === 'string' ? parsedItem.zoneSlug : '');
        setTags(
          Array.isArray(parsedItem.tags)
            ? parsedItem.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
            : []
        );

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
    } catch {
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
      categorySlug,
      zoneSlug,
      tags,
      isEdit: true,
    };

    localStorage.setItem('editItem', JSON.stringify(editData));
  }, [categorySlug, editingItemId, imageUrl, isEditMode, tags, values.description, values.itemType, values.title, values.location, zoneSlug]);

  // Committed tags plus whatever is still typed in the tag input.
  const collectTags = (): { tags: string[]; error: string | null } => {
    const pending = tagInput.trim();
    return normalizeTags(pending ? [...tags, pending] : tags);
  };

  const addTags = (rawTags: string[]) => {
    const { tags: nextTags, error: nextError } = normalizeTags([...tags, ...rawTags]);
    const duplicate = rawTags
      .map(normalizeTag)
      .find((normalized) => normalized && tags.includes(normalized));

    setTags(nextTags);
    setTagInput('');
    setTagError(nextError ?? (duplicate ? `#${duplicate} has already been added.` : null));
  };

  const handleTagInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;

    // A comma commits every complete segment, so pasting "keys, blue" works.
    if (value.includes(',')) {
      const segments = value.split(',');
      const remainder = segments.pop() ?? '';
      addTags(segments);
      setTagInput(remainder);
      return;
    }

    setTagInput(value);
    if (tagError) {
      setTagError(null);
    }
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      if (tagInput.trim()) {
        event.preventDefault();
        addTags([tagInput]);
      } else if (event.key === ',') {
        // Never let a stray comma into the input.
        event.preventDefault();
      }
      // Enter with an empty input falls through to submitting the form.
      return;
    }

    // Backspace in an empty input removes the most recent tag.
    if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((previous) => previous.slice(0, -1));
      setTagError(null);
    }
  };

  const handleSubmitError = (err: unknown) => {
    const rawMessage = err instanceof Error ? err.message : '';
    const errorMessage = rawMessage || (isEditMode ? 'Failed to update item. Please try again.' : 'Failed to post item. Please try again.');
    setError(errorMessage);
    showError(errorMessage);

    if (rawMessage.toLowerCase().includes('auth')) {
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    }
  };

  /**
   * POST a new item.
   *
   * A 409 carrying `DUPLICATE_SUSPECTED` is not an error: the duplicate guard is
   * asking for confirmation, so the candidates are surfaced with a "Post anyway"
   * escape hatch instead of a generic failure message.
   */
  const postNewItem = async (payload: Record<string, unknown>, acknowledgeDuplicates: boolean) => {
    const response = await fetchWithAuth('/api/items', {
      method: 'POST',
      body: JSON.stringify(acknowledgeDuplicates ? { ...payload, acknowledgeDuplicates: true } : payload),
    });

    if (response.status === 409) {
      let errorData: {
        error?: string;
        code?: string;
        details?: { candidates?: DuplicateCandidate[] };
      } | null = null;

      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }

      if (errorData?.code === 'DUPLICATE_SUSPECTED') {
        setDuplicateWarning({
          candidates: errorData.details?.candidates ?? [],
          payload,
        });
        return;
      }

      throw new Error(errorData?.error || 'Failed to post item');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to post item');
    }

    await response.json();
    setSuccess('Item posted successfully!');
    showSuccess('Item posted successfully!');

    resetForm();
    setImageUrl(null);
    setTags([]);
    setTagInput('');
    setTagError(null);
    setCategorySlug('');
    setZoneSlug('');
  };

  // Resubmit the reviewed payload, this time acknowledging the duplicates.
  const handlePostAnyway = async () => {
    if (!duplicateWarning) {
      return;
    }

    const { payload } = duplicateWarning;
    setDuplicateWarning(null);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await postNewItem(payload, true);
    } catch (err: unknown) {
      handleSubmitError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission with authenticated fetch
  const onSubmit = async (formData: ItemFormValues) => {
    // Fold in whatever is still typed in the tag input, and refuse to submit a
    // tag list the API would reject rather than dropping tags silently.
    const { tags: finalTags, error: tagValidationError } = collectTags();

    if (tagValidationError) {
      setTags(finalTags);
      setTagInput('');
      setTagError(tagValidationError);
      showError(tagValidationError);
      return;
    }

    setTags(finalTags);
    setTagInput('');
    setTagError(null);
    setDuplicateWarning(null);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      title: sanitizeInput(formData.title),
      description: sanitizeInput(formData.description),
      itemType: formData.itemType,
      location: sanitizeInput(formData.location),
      images: imageUrl ? [imageUrl] : [],
      categorySlug: categorySlug || undefined,
      zoneSlug: zoneSlug || undefined,
      tags: finalTags
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

      await postNewItem(payload, false);
    } catch (err: unknown) {
      handleSubmitError(err);
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

      {/* Duplicate warning: 409 DUPLICATE_SUSPECTED from POST /api/items */}
      {duplicateWarning && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900">Possible duplicate</p>
              <p className="text-sm text-amber-800 mt-1">
                {duplicateWarning.candidates.length === 1
                  ? 'You recently posted a very similar item:'
                  : 'You recently posted very similar items:'}
              </p>

              <ul className="mt-3 space-y-2">
                {duplicateWarning.candidates.map((candidate) => (
                  <li key={candidate.id} className="bg-white border border-amber-200 rounded-md p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/item/${candidate.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {candidate.title}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {candidate.location} · {candidate.itemType === 'LOST' ? 'Lost' : 'Found'} ·{' '}
                          {new Date(candidate.createdAt).toLocaleDateString()}
                        </p>
                        {candidate.reasons.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {candidate.reasons.slice(0, 3).map((reason) => reason.label).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                        {Math.round(candidate.score)}% match
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex gap-3 mt-4">
                <Button
                  type="button"
                  variant="warning"
                  onClick={handlePostAnyway}
                  disabled={isLoading}
                >
                  Post anyway
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDuplicateWarning(null)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
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

        {/* Category and Zone (held in local state, not in the string-only hook) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="item-category" className="block text-sm font-medium text-gray-700 mb-2">
              Category (Optional)
            </label>
            <select
              id="item-category"
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              disabled={isLoading || taxonomyLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">
                {taxonomyLoading ? 'Loading categories…' : 'Select a category'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="item-zone" className="block text-sm font-medium text-gray-700 mb-2">
              Campus Zone (Optional)
            </label>
            <select
              id="item-zone"
              value={zoneSlug}
              onChange={(e) => setZoneSlug(e.target.value)}
              disabled={isLoading || taxonomyLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">
                {taxonomyLoading ? 'Loading zones…' : 'Select a zone'}
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.slug}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="item-tags" className="block text-sm font-medium text-gray-700 mb-2">
            Tags (Optional)
          </label>
          <div className="flex flex-wrap items-center gap-2 w-full px-3 py-2 border border-gray-300 rounded-md focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
            {tags.map((tag) => (
              <TagPill
                key={tag}
                tag={tag}
                onRemove={() => {
                  setTags((previous) => previous.filter((entry) => entry !== tag));
                  setTagError(null);
                }}
              />
            ))}
            <input
              id="item-tags"
              type="text"
              value={tagInput}
              onChange={handleTagInputChange}
              onKeyDown={handleTagKeyDown}
              disabled={isLoading}
              placeholder={tags.length > 0 ? 'Add another tag…' : 'e.g., leather, blue, water-bottle'}
              aria-describedby="item-tags-help"
              className="flex-1 min-w-[8rem] border-0 p-0 text-sm focus:outline-none focus:ring-0 disabled:bg-transparent"
            />
          </div>
          <p id="item-tags-help" className="text-sm text-gray-500 mt-1">
            Press Enter or comma to add a tag — up to {MAX_TAGS_PER_ITEM} tags of{' '}
            {MIN_TAG_LENGTH}-{MAX_TAG_LENGTH} characters (letters, numbers, and hyphens).
          </p>
          <FieldError error={tagError ?? undefined} />
        </div>

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
