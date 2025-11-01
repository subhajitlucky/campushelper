import { useState, useCallback, useMemo } from 'react';
import { z, ZodSchema } from 'zod';

interface FormField {
  value: string;
  error?: string;
  touched: boolean;
  isValid?: boolean;
}

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
  
  // Field validation
  validateField: (field: keyof T) => boolean;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldTouched: (field: keyof T, touched?: boolean) => void;
  setFieldError: (field: keyof T, error?: string) => void;
  
  // Form validation
  validateForm: () => boolean;
  resetForm: () => void;
  handleSubmit: (submitFn: (values: T) => Promise<void> | void) => (e: React.FormEvent) => Promise<void>;
  
  // Utility
  getFieldProps: (field: keyof T) => {
    value: any;
    error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    touched: boolean;
    isValid?: boolean;
  };
}

export function useFormValidation<T extends Record<string, any>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const { schema, initialValues, validateOnChange = true, validateOnBlur = true } = options;
  
  // Initialize form state
  const [formState, setFormState] = useState<Record<keyof T, FormField>>(() => {
    const initial: Record<keyof T, FormField> = {} as any;
    Object.keys(initialValues).forEach((key) => {
      initial[key as keyof T] = {
        value: initialValues[key as keyof T],
        touched: false,
        isValid: false
      };
    });
    return initial;
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validate single field
  const validateField = useCallback((field: keyof T): boolean => {
    const fieldState = formState[field];
    if (!fieldState) return false;
    
    try {
      // Create a partial object with just this field for validation
      const partialResult = (schema as any).pick({ [field]: true } as any).safeParse({
        [field]: fieldState.value
      });
      
      let error = '';
      let isValid = false;
      
      if (partialResult.success) {
        isValid = true;
      } else {
        const fieldError = partialResult.error.issues.find(
          (issue: any) => issue.path[0] === field
        );
        error = fieldError?.message || '';
      }
      
      setFormState(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          error,
          isValid
        }
      }));
      
      return !error;
    } catch (error) {
      return false;
    }
  }, [formState, schema]);
  
  // Validate entire form
  const validateForm = useCallback((): boolean => {
    try {
      // Get current values first
      const currentValues: any = {};
      Object.keys(formState).forEach((key) => {
        currentValues[key] = formState[key as keyof T].value;
      });

      const result = schema.safeParse(currentValues);
      
      if (result.success) {
        // Clear all errors
        const clearedState: Record<keyof T, FormField> = {} as any;
        Object.keys(formState).forEach((key) => {
          clearedState[key as keyof T] = {
            ...formState[key as keyof T],
            error: undefined,
            isValid: true
          };
        });
        setFormState(clearedState);
        return true;
      } else {
        // Set errors for each field
        const newState: Record<keyof T, FormField> = { ...formState };
        
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof T;
          if (newState[field]) {
            newState[field] = {
              ...newState[field],
              error: issue.message,
              isValid: false
            };
          }
        });
        
        setFormState(newState);
        return false;
      }
    } catch (error) {
      return false;
    }
  }, [formState, schema]);
  
  // Get current values
  const values = useMemo(() => {
    const currentValues: any = {};
    Object.keys(formState).forEach((key) => {
      currentValues[key] = formState[key as keyof T].value;
    });
    return currentValues;
  }, [formState]);
  
  // Get current errors
  const errors = useMemo(() => {
    const currentErrors: Partial<Record<keyof T, string>> = {};
    Object.keys(formState).forEach((key) => {
      const fieldState = formState[key as keyof T];
      if (fieldState.error) {
        currentErrors[key as keyof T] = fieldState.error;
      }
    });
    return currentErrors;
  }, [formState]);
  
  // Get touched fields
  const touched = useMemo(() => {
    const currentTouched: Partial<Record<keyof T, boolean>> = {};
    Object.keys(formState).forEach((key) => {
      currentTouched[key as keyof T] = formState[key as keyof T].touched;
    });
    return currentTouched;
  }, [formState]);
  
  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.keys(formState).length > 0 && 
           Object.values(formState).every(field => field.isValid && !field.error);
  }, [formState]);
  
  // Set field value
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value
      }
    }));
    
    // Validate on change if enabled
    if (validateOnChange) {
      setTimeout(() => validateField(field), 0);
    }
  }, [validateOnChange, validateField]);
  
  // Set field touched
  const setFieldTouched = useCallback((field: keyof T, touched = true) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        touched
      }
    }));
    
    // Validate on blur if enabled
    if (validateOnBlur && touched) {
      setTimeout(() => validateField(field), 0);
    }
  }, [validateOnBlur, validateField]);
  
  // Set field error manually
  const setFieldError = useCallback((field: keyof T, error?: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        error,
        isValid: !error
      }
    }));
  }, []);
  
  // Reset form
  const resetForm = useCallback(() => {
    const initial: Record<keyof T, FormField> = {} as any;
    Object.keys(initialValues).forEach((key) => {
      initial[key as keyof T] = {
        value: initialValues[key as keyof T],
        touched: false,
        isValid: false
      };
    });
    setFormState(initial);
    setIsSubmitting(false);
  }, [initialValues]);
  
  // Handle form submission
  const handleSubmit = useCallback((submitFn: (values: T) => Promise<void> | void) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Mark all fields as touched
      const touchedState: Record<keyof T, FormField> = { ...formState };
      Object.keys(touchedState).forEach((key) => {
        touchedState[key as keyof T] = {
          ...touchedState[key as keyof T],
          touched: true
        };
      });
      setFormState(touchedState);
      
      // Validate form
      const isValidForm = validateForm();
      
      if (!isValidForm) {
        return;
      }
      
      setIsSubmitting(true);
      
      try {
        // Get current values for submission
        const currentValues: any = {};
        Object.keys(formState).forEach((key) => {
          currentValues[key] = formState[key as keyof T].value;
        });
        
        await submitFn(currentValues);
      } catch (error) {
        } finally {
        setIsSubmitting(false);
      }
    };
  }, [formState, validateForm]);
  
  // Get field props for easy integration
  const getFieldProps = useCallback((field: keyof T) => {
    const fieldState = formState[field];
    
    return {
      value: fieldState?.value || '',
      error: fieldState?.error,
      touched: fieldState?.touched || false,
      isValid: fieldState?.isValid,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFieldValue(field, e.target.value);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
