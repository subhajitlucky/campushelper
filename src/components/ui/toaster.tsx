'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{
        top: 20,
        left: 20,
        bottom: 20,
        right: 20,
      }}
      toastOptions={{
        // Define default options
        className: '',
        duration: 4000,
        style: {
          background: '#fff',
          color: '#363636',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          fontSize: '14px',
          padding: '12px 16px',
          maxWidth: '500px',
        },

        // Default options for specific types
        success: {
          duration: 3000,
          style: {
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
          },
          iconTheme: {
            primary: '#22c55e',
            secondary: '#f0fdf4',
          },
        },
        error: {
          duration: 5000,
          style: {
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fecaca',
          },
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fef2f2',
          },
        },
        loading: {
          style: {
            background: '#eff6ff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
          },
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#eff6ff',
          },
        },
      }}
    />
  );
}

export default Toaster;
