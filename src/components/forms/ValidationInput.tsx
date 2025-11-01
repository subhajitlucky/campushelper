import React, { forwardRef } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import FieldError from './FieldError';

interface ValidationInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isValid?: boolean;
  showCheckIcon?: boolean;
  helperText?: string;
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
      w-full px-3 py-2 border rounded-lg transition-colors
      ${hasError 
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
        : hasSuccess 
          ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
      }
      focus:ring-2 focus:ring-opacity-20
      disabled:bg-gray-50 disabled:text-gray-500
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
