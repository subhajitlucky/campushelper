import React, { forwardRef } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import FieldError from './FieldError';

interface ValidationInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isValid?: boolean;
  showCheckIcon?: boolean;
  helperText?: string;
  touched?: boolean;
  isTouched?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const ValidationInput = forwardRef<HTMLInputElement, ValidationInputProps>(
  ({
    label,
    error,
    showCheckIcon = false,
    helperText,
    className = '',
    // Filter out props that aren't valid HTML attributes
    isValid, // Don't pass to DOM
    ...props
  }, ref) => {
    const hasError = !!error;
    const hasSuccess = !hasError && isValid && props.value;
    
    const inputClasses = `
      w-full px-3 py-2 border rounded-md transition-colors bg-background shadow-xs
      ${hasError 
        ? 'border-destructive/30 focus:border-destructive/30'
        : hasSuccess 
          ? 'border-success/30 focus:border-success/30'
          : 'border-input focus:border-ring'
      }
      focus:outline-none focus:ring-0 focus-visible:ring-0
      disabled:cursor-not-allowed disabled:opacity-50
      ${className}
    `;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-foreground/85">
            {label}
          </label>
        )}
        
        <div className="relative">
          <input
            ref={ref}
            className={inputClasses}
            {...props}
          />
          
          {/* Status icons */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {hasError && <AlertCircle className="w-5 h-5 text-destructive" />}
            {hasSuccess && showCheckIcon && <CheckCircle className="w-5 h-5 text-success" />}
          </div>
        </div>
        
        {/* Helper text */}
        {helperText && !error && (
          <p className="text-sm text-muted-foreground">{helperText}</p>
        )}
        
        {/* Error message */}
        <FieldError error={error} />
      </div>
    );
  }
);

ValidationInput.displayName = 'ValidationInput';

export default ValidationInput;
