'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  PackageCheck,
  PackageSearch,
  PencilLine,
} from 'lucide-react';

import { cn } from '@/lib/utils';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/ui/PageHeader';
import TagPill from '@/components/ui/TagPill';
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

/** Human names for the fields an invalid submit can point at. */
const FIELD_LABELS: Partial<Record<keyof ItemFormValues, string>> = {
  itemType: 'item status',
  title: 'title',
  description: 'description',
  location: 'location',
};

/**
 * Every control in the form shares one shape: `Input`/`Textarea` own their focus
 * ring, and the selects below mirror those classes rather than re-deriving them,
 * so a focused select looks like a focused input (brief §4.3, §4.8).
 */
const SELECT_CLASSES = [
  'h-10 w-full appearance-none rounded-lg border border-input bg-transparent pl-3 pr-10 text-base text-foreground shadow-xs transition-colors',
  'placeholder:text-muted-foreground',
  'focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

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

interface FieldProps {
  /** Control id; also the base for the message element's id. */
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  /** Extra content under the control — a character count, a live help line. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One field, one row: label above the control, message below it, and the three
 * tied together by `htmlFor` / `aria-describedby`. The message element is always
 * rendered so the described-by target exists whether or not there is an error.
 */
function Field({ id, label, optional = false, error, hint, footer, children }: FieldProps) {
  const messageId = `${id}-message`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {optional && <span className="ml-2 font-normal text-muted-foreground">Optional</span>}
      </label>

      <div className="mt-2">{children}</div>

      <div id={messageId} className="mt-2 space-y-1">
        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : hint ? (
          <p className="text-sm text-muted-foreground">{hint}</p>
        ) : null}

        {footer}
      </div>
    </div>
  );
}

/** Border colour for a control that failed validation. Focus styling is untouched. */
function invalidBorder(hasError: boolean): string | undefined {
  return hasError ? 'border-destructive' : undefined;
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
    submitError,
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

        // The hook validates from the value it was just handed, so this no
        // longer needs to be deferred to a timeout to see the prefilled values.
        setFieldTouched('title', true);
        setFieldTouched('description', true);
        setFieldTouched('itemType', true);
        setFieldTouched('location', true);
        validateForm();
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

  const isBusy = isSubmitting || isLoading;

  /**
   * Value/change/blur only.
   *
   * `getFieldProps` also carries validation metadata (`error`, `touched`,
   * `isValid`), which belongs in aria attributes rather than on the DOM node —
   * spreading it straight into an `<input>` would emit invalid attributes.
   */
  const bind = (field: keyof ItemFormValues) => {
    const { value, onChange, onBlur } = getFieldProps(field);
    return { value, onChange, onBlur };
  };

  /**
   * What a blocked submit says.
   *
   * `submitError` comes from the hook and is authoritative; naming the fields
   * that failed turns "the button did nothing" into an instruction. The message
   * sits next to the submit bar because that is where the user just clicked.
   */
  const blockedFields = Object.keys(errors) as (keyof ItemFormValues)[];
  const blockedSubmitMessage = !submitError
    ? null
    : blockedFields.length > 0
      ? `Please check the ${blockedFields.map((field) => FIELD_LABELS[field] ?? field).join(', ')} before posting.`
      : submitError;

  return (
    <div className={cn('rise-in', className)}>
      <PageHeader
        title={isEditMode ? 'Edit item' : 'Post an item'}
        description={
          isEditMode
            ? 'Update the details below. Saving replaces the current listing.'
            : 'Describe what you lost or found, and where. A photo and a precise location are what make a match.'
        }
      />

      {isEditMode && (
        <p className="mt-6 flex items-start gap-2 text-base leading-relaxed text-muted-foreground">
          <PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          You are editing an existing item. Cancel at the bottom to leave it unchanged.
        </p>
      )}

      {/* Transport / API failures sit at the top, above the fields they belong to. */}
      {error && (
        <div role="alert" className="mt-8 border-l-2 border-destructive bg-destructive/5 px-4 py-3">
          <p className="text-base text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-8" noValidate>
        {/* The uploader is the hero: a photo is the single most useful field on
            this form, so it leads instead of hiding below the fold. */}
        <Field
          id="item-image"
          label="Photo"
          optional
          hint="A clear photo of the item itself, not the surroundings. It is compressed automatically."
        >
          <ImageUpload
            inputId="item-image"
            onImageUpload={setImageUrl}
            onImageRemove={() => setImageUrl(null)}
            currentImage={imageUrl}
          />
        </Field>

        {/* Item type is one field with two options, so the options share a row. */}
        <fieldset>
          <legend className="text-sm font-medium text-foreground">Item status</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {([
              {
                value: 'LOST' as const,
                label: 'I lost this',
                description: 'You are looking for it',
                Icon: PackageSearch,
              },
              {
                value: 'FOUND' as const,
                label: 'I found this',
                description: 'You picked it up',
                Icon: PackageCheck,
              },
            ]).map(({ value, label, description, Icon }) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border border-input p-4 transition-colors',
                  'hover:bg-accent/50',
                  'has-[:checked]:border-primary has-[:checked]:bg-primary/5',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background'
                )}
              >
                <input
                  type="radio"
                  name="itemType"
                  value={value}
                  checked={values.itemType === value}
                  onChange={(event) => getFieldProps('itemType').onChange(event)}
                  onBlur={getFieldProps('itemType').onBlur}
                  className="sr-only"
                />
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-base font-medium text-foreground">{label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
                </span>
              </label>
            ))}
          </div>
          <div id="item-type-message" className="mt-2">
            {errors.itemType && (
              <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{errors.itemType}</span>
              </p>
            )}
          </div>
        </fieldset>

        <Field
          id="item-title"
          label="Title"
          error={errors.title}
          hint="Be specific: “Black iPhone 13 with a cracked corner” finds its owner."
        >
          <Input
            id="item-title"
            {...bind('title')}
            placeholder="Black iPhone 13, blue water bottle, car keys"
            aria-invalid={!!errors.title}
            aria-describedby="item-title-message"
            className={invalidBorder(!!errors.title)}
          />
        </Field>

        <Field
          id="item-description"
          label="Description"
          error={errors.description}
          hint="Anything that would let the owner recognise it — colour, brand, stickers, contents."
          footer={
            <p className="text-sm text-muted-foreground">
              {values.description.length}/2000 characters
            </p>
          }
        >
          <Textarea
            id="item-description"
            {...bind('description')}
            placeholder="Where did you lose or find it? What makes it unmistakably yours?"
            rows={5}
            maxLength={2000}
            aria-invalid={!!errors.description}
            aria-describedby="item-description-message"
            className={cn('text-base', invalidBorder(!!errors.description))}
          />
        </Field>

        <Field
          id="item-location"
          label="Location"
          error={errors.location}
          hint="The building, room, or stop where it was lost or found."
        >
          <Input
            id="item-location"
            {...bind('location')}
            placeholder="Library, 2nd floor — Cafeteria — Parking Lot A"
            aria-invalid={!!errors.location}
            aria-describedby="item-location-message"
            className={invalidBorder(!!errors.location)}
          />
        </Field>

        <Field
          id="item-category"
          label="Category"
          optional
          hint="Used to match this report against the opposite side."
        >
          <div className="relative">
            <select
              id="item-category"
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
              disabled={isBusy || taxonomyLoading}
              aria-describedby="item-category-message"
              className={SELECT_CLASSES}
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
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </Field>

        <Field
          id="item-zone"
          label="Campus zone"
          optional
          hint="Zones are how the map and match scores narrow down where an item went missing."
        >
          <div className="relative">
            <select
              id="item-zone"
              value={zoneSlug}
              onChange={(event) => setZoneSlug(event.target.value)}
              disabled={isBusy || taxonomyLoading}
              aria-describedby="item-zone-message"
              className={SELECT_CLASSES}
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
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </Field>

        <Field
          id="item-tags"
          label="Tags"
          optional
          error={tagError ?? undefined}
          hint={`Press Enter or comma to add a tag — up to ${MAX_TAGS_PER_ITEM} tags of ${MIN_TAG_LENGTH}-${MAX_TAG_LENGTH} characters (letters, numbers, and hyphens).`}
        >
          <div
            className={cn(
              'flex w-full flex-wrap items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-2 shadow-xs transition-colors',
              'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
              invalidBorder(!!tagError)
            )}
          >
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
              disabled={isBusy}
              placeholder={tags.length > 0 ? 'Add another tag…' : 'leather, blue, water-bottle'}
              aria-describedby="item-tags-message"
              aria-invalid={!!tagError}
              className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
          </div>
        </Field>

        {/* Feedback for the action below, kept in view with it: a blocked submit
            and the duplicate confirmation both belong next to the button that
            caused them. */}
        {blockedSubmitMessage && (
          <div role="alert" className="border-l-2 border-destructive bg-destructive/5 px-4 py-3">
            <p className="text-base text-destructive">{blockedSubmitMessage}</p>
          </div>
        )}

        {duplicateWarning && (
          <div role="alert" className="rounded-xl border border-warning/30 bg-warning/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">Possible duplicate</p>
                <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                  {duplicateWarning.candidates.length === 1
                    ? 'This looks like an item you already posted:'
                    : 'This looks like items you already posted:'}{' '}
                  Post it anyway only if it is a different item.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {duplicateWarning.candidates.map((candidate) => (
                <li key={candidate.id}>
                  <Link
                    href={`/item/${candidate.id}`}
                    className="card-surface block p-3 transition-shadow hover:shadow-card-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-foreground">
                          {candidate.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {candidate.location} · {candidate.itemType === 'LOST' ? 'Lost' : 'Found'} ·{' '}
                          {new Date(candidate.createdAt).toLocaleDateString()}
                        </p>
                        {candidate.reasons.length > 0 && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {candidate.reasons.slice(0, 3).map((reason) => reason.label).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-medium text-warning">
                        {Math.round(candidate.score)}% match
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="warning"
                onClick={handlePostAnyway}
                disabled={isBusy}
              >
                Post anyway
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateWarning(null)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {success && (
          <p role="status" className="flex items-center gap-2 text-base text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            {success}
          </p>
        )}

        {/* Sticky on mobile so the primary action never scrolls away; an inline
            row on desktop, where the whole form is visible anyway. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex items-center gap-3">
            {isEditMode && (
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  localStorage.removeItem('editItem');
                  setIsEditMode(false);
                  setEditingItemId(null);
                  router.push('/dashboard');
                }}
                disabled={isBusy}
              >
                Cancel
              </Button>
            )}

            <Button
              type="submit"
              size="lg"
              className="flex-1 sm:flex-none sm:min-w-44"
              disabled={!isValid || isBusy || isAuthLoading}
            >
              {isLoading ? (
                <>
                  <ButtonSpinner />
                  {isEditMode ? 'Saving changes…' : 'Posting item…'}
                </>
              ) : isAuthLoading ? (
                <>
                  <ButtonSpinner />
                  Checking your session…
                </>
              ) : isEditMode ? (
                'Save changes'
              ) : (
                'Post item'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
