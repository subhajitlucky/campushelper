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
    touched,
    isTouched,
    onBlur,
    isValid, // Don't pass to DOM
    ...props
  }, ref) => {
    const hasError = !!error;
    const hasSuccess = !hasError && isValid && props.value;
    
    const inputClasses = `
      w-full px-3 py-2 border rounded-md transition-colors bg-background shadow-xs
      ${hasError 
        ? 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/50' 
        : hasSuccess 
          ? 'border-green-300 focus-visible:border-green-500 focus-visible:ring-green-500/50'
          : 'border-input focus-visible:border-ring focus-visible:ring-ring/50'
      }
      focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
      ${className}
    `;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
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
            {hasError && <AlertCircle className="w-5 h-5 text-red-500" />}
            {hasSuccess && showCheckIcon && <CheckCircle className="w-5 h-5 text-green-500" />}
          </div>
        </div>
        
        {/* Helper text */}
        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
        
        {/* Error message */}
        <FieldError error={error} />
      </div>
    );
  }
);

ValidationInput.displayName = 'ValidationInput';

export default ValidationInput;
