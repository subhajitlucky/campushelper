import { useState, useCallback, useMemo, useRef } from 'react';
import { z, ZodSchema } from 'zod';

interface FormField {
  value: string;
  error?: string;
  touched: boolean;
  isValid?: boolean;
}

type FieldState<T> = Record<keyof T, FormField>;

interface UseFormValidationOptions<T> {
  schema: ZodSchema<T>;
  initialValues: T;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

interface UseFormValidationReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  /**
   * Set when a submit was blocked by validation, cleared as soon as the user
   * edits or resets. Guarantees that pressing submit on an invalid form produces
   * visible feedback even for a field the consumer forgot to render an error for.
   */
  submitError: string | null;

  // Field validation
  validateField: (field: keyof T) => boolean;
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setFieldError: (field: keyof T, error?: string) => void;

  // Form validation
  validateForm: () => boolean;
  resetForm: () => void;
  handleSubmit: (submitFn: (values: T) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;

  // Utility
  getFieldProps: (field: keyof T) => {
    value: T[keyof T];
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    touched: boolean;
    isValid?: boolean;
  };
}

/** Shown when a submit is blocked and the schema gave no field-specific reason. */
const BLOCKED_SUBMIT_MESSAGE = 'Please correct the highlighted fields before submitting.';

/** Build the empty field state for a set of initial values. */
function buildState<T extends Record<string, string>>(initialValues: T): FieldState<T> {
  const initial = {} as FieldState<T>;
  (Object.keys(initialValues) as (keyof T)[]).forEach((key) => {
    initial[key] = { value: initialValues[key], touched: false, isValid: false };
  });
  return initial;
}

/** The values of a field snapshot, in the shape the schema parses. */
function snapshotValues<T extends Record<string, string>>(fields: FieldState<T>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  (Object.keys(fields) as (keyof T)[]).forEach((key) => {
    values[key as string] = fields[key].value;
  });
  return values;
}

/**
 * Parse an explicit field snapshot and return the state that should replace it.
 *
 * Module-level and pure on purpose. `handleSubmit` has to mark every field
 * touched *and* validate that exact snapshot in a single write; the old code
 * read `formState` from the render closure instead, so the all-touched flags
 * were discarded and an invalid submit rendered nothing at all (audit finding
 * M8). Issues that cannot be mapped to a field are returned so the caller can
 * surface them rather than swallow them.
 */
function applySchema<T extends Record<string, string>>(
  schema: ZodSchema<T>,
  fields: FieldState<T>
): { nextState: FieldState<T>; isValid: boolean; unmappedErrors: string[] } {
  const result = schema.safeParse(snapshotValues(fields));

  // Start from a clean slate: an issue that no longer applies has to be cleared,
  // and a field the schema did not complain about passed its own rules.
  const nextState = {} as FieldState<T>;
  (Object.keys(fields) as (keyof T)[]).forEach((key) => {
    nextState[key] = { ...fields[key], error: undefined, isValid: true };
  });

  if (result.success) {
    return { nextState, isValid: true, unmappedErrors: [] };
  }

  const unmappedErrors: string[] = [];

  result.error.issues.forEach((issue) => {
    const field = issue.path[0] as keyof T | undefined;

    if (field === undefined || !nextState[field]) {
      if (!unmappedErrors.includes(issue.message)) {
        unmappedErrors.push(issue.message);
      }
      return;
    }

    // First issue per field wins, so the message is stable while typing.
    if (nextState[field].error) {
      return;
    }

    nextState[field] = {
      ...nextState[field],
      error: issue.message,
      isValid: false,
    };
  });

  return { nextState, isValid: false, unmappedErrors };
}

/**
 * Validate a single field against just its own part of the schema.
 *
 * Returns `null` when the schema cannot be picked apart (a `.refine()` wrapper,
 * for instance); the caller then falls back to validating the whole form.
 */
function applyFieldSchema<T extends Record<string, string>>(
  schema: ZodSchema<T>,
  field: keyof T,
  value: string
): { error?: string; isValid: boolean } | null {
  try {
    const pickMask: Record<string, true> = { [field as string]: true };
    const result = (schema as unknown as z.ZodObject<z.ZodRawShape>)
      .pick(pickMask)
      .safeParse({ [field as string]: value });

    if (result.success) {
      return { error: undefined, isValid: true };
    }

    const issue =
      result.error.issues.find((candidate) => candidate.path[0] === field) ??
      result.error.issues[0];

    return { error: issue?.message ?? 'This value is not valid', isValid: false };
  } catch {
    return null;
  }
}

/**
 * useFormValidation
 *
 * A small string-only form state machine over a Zod schema.
 *
 * All writes go through a single `commit` helper that updates a ref *before*
 * React state, so anything that validates in the same tick — a scheduled field
 * check, a prefill effect, a submit handler — reads the value the user just
 * typed rather than the previous render's snapshot. Stale snapshot reads are the
 * whole family of bugs this hook used to ship (audit findings M7 and M8).
 */
export function useFormValidation<T extends Record<string, string>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const { schema, initialValues, validateOnChange = true, validateOnBlur = true } = options;

  // Initialize form state
  const [formState, setFormState] = useState<FieldState<T>>(() => buildState(initialValues));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Mirrors `formState`, updated synchronously by every write. Reading state
   * after `setFormState` in the same tick would otherwise see the value from the
   * last committed render, which is what made a click on submit do nothing.
   */
  const formStateRef = useRef(formState);

  /** The single write path: ref first (immediately readable), then React state. */
  const commit = useCallback((update: (previous: FieldState<T>) => FieldState<T>) => {
    const next = update(formStateRef.current);
    formStateRef.current = next;
    setFormState(next);
  }, []);

  // Validate single field
  const validateField = useCallback((field: keyof T): boolean => {
    const fieldState = formStateRef.current[field];
    if (!fieldState) return false;

    const current = applyFieldSchema(schema, field, fieldState.value);

    if (!current) {
      // Not a pickable object schema: validate the form and report this field.
      const { nextState } = applySchema(schema, formStateRef.current);
      const resolved = nextState[field];
      commit((previous) => ({
        ...previous,
        [field]: { ...previous[field], error: resolved?.error, isValid: resolved?.isValid ?? false },
      }));
      return !resolved?.error;
    }

    commit((previous) => ({
      ...previous,
      [field]: { ...previous[field], error: current.error, isValid: current.isValid },
    }));

    return current.isValid;
  }, [schema, commit]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const { nextState, isValid: formIsValid } = applySchema(schema, formStateRef.current);
    commit(() => nextState);
    return formIsValid;
  }, [schema, commit]);

  // Get current values
  const values = useMemo(() => {
    return snapshotValues(formState) as T;
  }, [formState]);

  // Get current errors
  const errors = useMemo(() => {
    const currentErrors: Partial<Record<keyof T, string>> = {};
    (Object.keys(formState) as (keyof T)[]).forEach((key) => {
      const fieldState = formState[key];
      // Only show errors for fields that have been touched
      if (fieldState.error && fieldState.touched) {
        currentErrors[key] = fieldState.error;
      }
    });
    return currentErrors;
  }, [formState]);

  // Get touched fields
  const touched = useMemo(() => {
    const currentTouched: Partial<Record<keyof T, boolean>> = {};
    (Object.keys(formState) as (keyof T)[]).forEach((key) => {
      currentTouched[key] = formState[key].touched;
    });
    return currentTouched;
  }, [formState]);

  // Check if form is valid
  const isValid = useMemo(() => {
    // A field the user has not reached yet is not treated as an error: the
    // submit button stays enabled so that pressing it can explain what is
    // missing, instead of sitting there disabled with no reason given.
    return Object.keys(formState).length > 0 &&
      Object.values(formState).every((field) => {
        if (!field.touched) return true;
        return !field.error && field.value.toString().trim().length > 0;
      });
  }, [formState]);

  // Set field value
  const setFieldValue = useCallback((field: keyof T, value: T[keyof T]) => {
    commit((previous) => ({
      ...previous,
      [field]: { ...previous[field], value },
    }));

    setSubmitError(null);

    if (validateOnChange) {
      validateField(field);
    }
  }, [commit, validateOnChange, validateField]);

  // Set field touched
  const setFieldTouched = useCallback((field: keyof T, touched = true) => {
    commit((previous) => ({
      ...previous,
      [field]: { ...previous[field], touched },
    }));

    setSubmitError(null);

    // Validating immediately is safe now that the write above is readable
    // synchronously; the old setTimeout hop read a stale snapshot.
    if (validateOnBlur && touched) {
      validateField(field);
    }
  }, [commit, validateField, validateOnBlur]);

  // Set field error manually
  const setFieldError = useCallback((field: keyof T, error?: string) => {
    commit((previous) => ({
      ...previous,
      [field]: { ...previous[field], error, isValid: !error },
    }));
  }, [commit]);

  // Reset form
  const resetForm = useCallback(() => {
    commit(() => buildState(initialValues));
    setIsSubmitting(false);
    setSubmitError(null);
  }, [commit, initialValues]);

  // Handle form submission
  const handleSubmit = useCallback((submitFn: (values: T) => Promise<void> | void) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();

      // Mark every field touched and validate that same snapshot in one write.
      // Previously the touched flags were computed from the render closure and
      // then dropped by a second write that validated an older snapshot, so
      // submitting an untouched required field produced no request, no error and
      // no feedback (audit finding M8).
      const current = formStateRef.current;
      const submitted = {} as FieldState<T>;
      (Object.keys(current) as (keyof T)[]).forEach((key) => {
        submitted[key] = { ...current[key], touched: true };
      });

      const { nextState, isValid: formIsValid, unmappedErrors } = applySchema(schema, submitted);
      commit(() => nextState);

      if (!formIsValid) {
        setSubmitError(unmappedErrors[0] ?? BLOCKED_SUBMIT_MESSAGE);
        return;
      }

      setSubmitError(null);
      setIsSubmitting(true);

      try {
        await submitFn(snapshotValues(submitted) as T);
      } catch {
        // The submit callback reports its own failures next to the form.
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [schema, commit]);

  // Get field props for easy integration
  const getFieldProps = useCallback((field: keyof T) => {
    const fieldState = formState[field];

    return {
      value: (fieldState?.value || '') as T[keyof T],
      error: fieldState?.error,
      touched: fieldState?.touched || false,
      isValid: fieldState?.isValid,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFieldValue(field, e.target.value as T[keyof T]);
      },
      onBlur: () => {
        setFieldTouched(field, true);
      }
    };
  }, [formState, setFieldValue, setFieldTouched]);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitError,
    validateField,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    validateForm,
    resetForm,
    handleSubmit,
    getFieldProps
  };
}
