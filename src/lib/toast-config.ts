import { toast, Toast, ToastPosition } from 'react-hot-toast';

// Custom toast types for better type safety
export type ToastType = 'success' | 'error' | 'loading' | 'info' | 'warning';

// Toast configuration constants
export const TOAST_CONFIG = {
  SUCCESS_DURATION: 3000,
  ERROR_DURATION: 5000,
  INFO_DURATION: 4000,
  WARNING_DURATION: 4500,
  LOADING_DURATION: Infinity,
} as const;

// Default positions
export const POSITIONS: Record<string, ToastPosition> = {
  TOP_RIGHT: 'top-right',
  TOP_LEFT: 'top-left',
  TOP_CENTER: 'top-center',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_CENTER: 'bottom-center',
} as const;

// Predefined message templates
export const TOAST_MESSAGES = {
  // Success messages
  SUCCESS: {
    ITEM_CREATED: 'Item created successfully!',
    ITEM_UPDATED: 'Item updated successfully!',
    ITEM_DELETED: 'Item deleted successfully!',
    PROFILE_UPDATED: 'Profile updated successfully!',
    LOGIN_SUCCESS: 'Logged in successfully!',
    LOGOUT_SUCCESS: 'Logged out successfully!',
    SAVE_SUCCESS: 'Changes saved successfully!',
  },
  
  // Error messages
  ERROR: {
    NETWORK_ERROR: 'Network error. Please check your connection.',
    GENERIC_ERROR: 'Something went wrong. Please try again.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    SERVER_ERROR: 'Server error. Please try again later.',
    UNAUTHORIZED: 'Please log in to continue.',
  },
  
  // Info messages
  INFO: {
    PROCESSING: 'Processing your request...',
    LOADING: 'Loading content...',
    SEARCHING: 'Searching items...',
    UPLOADING: 'Uploading file...',
    SYNCING: 'Syncing data...',
    SAVING: 'Saving changes...',
  },
  
  // Warning messages
  WARNING: {
    UNSAVED_CHANGES: 'You have unsaved changes.',
    DELETE_CONFIRM: 'Are you sure you want to delete this item?',
    LEAVE_PAGE: 'Are you sure you want to leave this page?',
    SESSION_EXPIRING: 'Your session will expire soon.',
  }
} as const;

// Enhanced toast options
export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  position?: ToastPosition;
  icon?: string | React.ReactElement;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  persistent?: boolean;
}

// Toast utility functions
export class ToastManager {
  // Success toast
  static success(message: string, options?: Omit<ToastOptions, 'type'>) {
    return toast.success(message, {
      duration: options?.duration ?? TOAST_CONFIG.SUCCESS_DURATION,
      position: options?.position,
      icon: options?.icon,
    });
  }
  
  // Error toast
  static error(message: string, options?: Omit<ToastOptions, 'type'>) {
    return toast.error(message, {
      duration: options?.duration ?? TOAST_CONFIG.ERROR_DURATION,
      position: options?.position,
    });
  }
  
  // Info toast (custom implementation)
  static info(message: string, options?: Omit<ToastOptions, 'type'>) {
    return toast(message, {
      duration: options?.duration ?? TOAST_CONFIG.INFO_DURATION,
      position: options?.position,
      icon: options?.icon ?? 'ℹ️',
      style: {
        background: '#eff6ff',
        color: '#1e40af',
        border: '1px solid #93c5fd',
      },
    });
  }
  
  // Warning toast
  static warning(message: string, options?: Omit<ToastOptions, 'type'>) {
    return toast(message, {
      duration: options?.duration ?? TOAST_CONFIG.WARNING_DURATION,
      position: options?.position,
      icon: options?.icon ?? '⚠️',
      style: {
        background: '#fffbeb',
        color: '#d97706',
        border: '1px solid #fed7aa',
      },
    });
  }
  
  // Loading toast (persistent)
  static loading(message: string, options?: Omit<ToastOptions, 'type'>) {
    return toast.loading(message, {
      duration: TOAST_CONFIG.LOADING_DURATION,
      position: options?.position,
    });
  }
  
  // Promise-based toast (auto-resolve/reject)
  static promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: {
      position?: ToastPosition;
      duration?: number;
    }
  ): Promise<T> {
    return toast.promise(promise, messages, {
      position: options?.position,
      style: {
        // Default style for promise toasts
      },
      success: {
        duration: TOAST_CONFIG.SUCCESS_DURATION,
        style: {
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
        },
      },
      error: {
        duration: TOAST_CONFIG.ERROR_DURATION,
        style: {
          background: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
        },
      },
    });
  }
  
  // Custom toast with advanced options
  static custom(message: string, options: ToastOptions) {
    const { type, persistent, action, ...toastOptions } = options;
    
    switch (type) {
      case 'success':
        return this.success(message, toastOptions);
      case 'error':
        return this.error(message, toastOptions);
      case 'info':
        return this.info(message, toastOptions);
      case 'warning':
        return this.warning(message, toastOptions);
      case 'loading':
        return this.loading(message, toastOptions);
      default:
        return toast(message, toastOptions);
    }
  }
  
  // Dismiss specific toast
  static dismiss(toastId?: string) {
    toast.dismiss(toastId);
  }
  
  // Dismiss all toasts
  static dismissAll() {
    toast.dismiss();
  }
}

// Convenience functions for common use cases
export const showSuccess = (message: string, options?: Omit<ToastOptions, 'type'>) => 
  ToastManager.success(message, options);

export const showError = (message: string, options?: Omit<ToastOptions, 'type'>) => 
  ToastManager.error(message, options);

export const showInfo = (message: string, options?: Omit<ToastOptions, 'type'>) => 
  ToastManager.info(message, options);

export const showWarning = (message: string, options?: Omit<ToastOptions, 'type'>) => 
  ToastManager.warning(message, options);

export const showLoading = (message: string, options?: Omit<ToastOptions, 'type'>) => 
  ToastManager.loading(message, options);

export const showPromise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  },
  options?: {
    position?: ToastPosition;
    duration?: number;
  }
) => ToastManager.promise(promise, messages, options);

// API-specific toast helpers
export const API_TOASTS = {
  success: (action: string) => showSuccess(TOAST_MESSAGES.SUCCESS[`${action.toUpperCase()}_SUCCESS` as keyof typeof TOAST_MESSAGES.SUCCESS] || `${action} completed successfully!`),
  error: (error: any) => {
    const message = typeof error === 'string' ? error : error?.message || 'An error occurred';
    showError(message);
  },
  loading: (action: string) => showLoading(TOAST_MESSAGES.INFO[`${action.toUpperCase()}` as keyof typeof TOAST_MESSAGES.INFO] || `Processing ${action}...`),
};
