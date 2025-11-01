'use client';

import React, { Component, ReactNode } from 'react';

import { handleGenericError } from '@/lib/errorHandler';
import { showError } from '@/lib/toast-config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'component' | 'feature';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error with structured context
    const { level = 'component' } = this.props;
    
    

    // Update state with error info for potential debugging
    this.setState({ errorInfo });

    // Show user-friendly error message
    showError('Something went wrong. Please refresh the page if the problem persists.');

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const { level = 'component' } = this.props;

      switch (level) {
        case 'page':
          return <PageErrorFallback error={this.state.error} />;
        case 'feature':
          return <FeatureErrorFallback error={this.state.error} />;
        default:
          return <ComponentErrorFallback error={this.state.error} />;
      }
    }

    return this.props.children;
  }
}

// Page-level error fallback
function PageErrorFallback({ error }: { error?: Error }) {
      return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <h3 className="text-lg font-medium text-gray-900">Page Error</h3>
          <p className="mt-2 text-sm text-gray-600">
            We're sorry, but something went wrong loading this page.
              </p>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Reload Page
            </button>
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-100 text-gray-900 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
              >
              Go Back
            </button>
            </div>
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development)
                </summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {error.message}
                {'\n'}
                {error.stack}
                </pre>
              </details>
            )}
        </div>
          </div>
        </div>
      );
    }

// Feature-level error fallback
function FeatureErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center">
        <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          <h4 className="text-sm font-medium text-red-800">Feature Unavailable</h4>
          <p className="text-sm text-red-700 mt-1">
            This feature is temporarily unavailable. Please try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
  }

// Component-level error fallback
function ComponentErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
      <div className="flex items-center text-red-700">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Component error</span>
      </div>
    </div>
  );
}

// HOC for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for error boundary in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    

    showError('An error occurred. Please try again.');
  };
}
