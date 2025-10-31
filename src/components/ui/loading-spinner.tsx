import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
  variant?: "spinner" | "dots" | "pulse";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6", 
  lg: "w-8 h-8",
  xl: "w-12 h-12"
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  className,
  text,
  variant = "spinner"
}) => {
  const renderSpinner = () => {
    switch (variant) {
      case "dots":
        return (
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        );
      case "pulse":
        return (
          <div className="w-full h-full bg-current rounded-full animate-pulse" />
        );
      case "spinner":
      default:
        return <Loader2 className={cn("animate-spin", sizeClasses[size])} />;
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {renderSpinner()}
      {text && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  );
};

export const ButtonSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 className={cn("w-4 h-4 animate-spin", className)} />
);

export const PageLoader: React.FC<{ text?: string }> = ({ text = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
    <LoadingSpinner size="lg" />
    <p className="text-sm text-gray-600">{text}</p>
  </div>
);

export const InlineLoader: React.FC<{ text?: string; className?: string }> = ({ 
  text, 
  className 
}) => (
  <div className={cn("flex items-center gap-2 py-4", className)}>
    <LoadingSpinner size="sm" />
    {text && <span className="text-sm text-gray-600">{text}</span>}
  </div>
);
