import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface FormErrorProps {
  error?: string;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ 
  error, 
  className = '' 
}) => {
  if (!error) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 ${className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    </div>
  );
};

export default FormError;
