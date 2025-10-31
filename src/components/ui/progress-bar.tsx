import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "error";
  animated?: boolean;
  label?: string;
}

export function ProgressBar({
  value = 0,
  max = 100,
  showLabel = true,
  size = "md",
  variant = "default",
  animated = true,
  label,
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4"
  };

  const variantClasses = {
    default: "bg-blue-600",
    success: "bg-green-600",
    error: "bg-red-600"
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {label || "Progress"}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full bg-gray-200 rounded-full overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            variantClasses[variant],
            animated && "animate-pulse"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: "default" | "success" | "error";
  showLabel?: boolean;
  label?: string;
}

export function CircularProgress({
  value = 0,
  max = 100,
  size = 40,
  strokeWidth = 4,
  variant = "default",
  showLabel = true,
  label,
  className,
  ...props
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
  const center = size / 2;

  const variantColors = {
    default: "#2563eb", // blue-600
    success: "#16a34a", // green-600
    error: "#dc2626"    // red-600
  };

  return (
    <div className={cn("flex flex-col items-center", className)} {...props}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={variantColors[variant]}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>
        {(showLabel && percentage > 0 && percentage < 100) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <div className="mt-2 text-center">
          <span className="text-sm text-gray-600">{label}</span>
        </div>
      )}
    </div>
  );
}

interface UploadProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  fileName: string;
  progress: number;
  status?: "uploading" | "success" | "error";
  speed?: string;
  timeRemaining?: string;
}

export function UploadProgress({
  fileName,
  progress,
  status = "uploading",
  speed,
  timeRemaining,
  className,
  ...props
}: UploadProgressProps) {
  const getStatusVariant = () => {
    switch (status) {
      case "success": return "success";
      case "error": return "error";
      default: return "default";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "success": return "✅";
      case "error": return "❌";
      default: return "📤";
    }
  };

  return (
    <div
      className={cn(
        "bg-white border rounded-lg p-4 space-y-3",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getStatusIcon()}</span>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {fileName}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>
      
      <ProgressBar
        value={progress}
        variant={getStatusVariant()}
        animated={status === "uploading"}
        showLabel={false}
        className="mb-2"
      />
      
      {(speed || timeRemaining) && status === "uploading" && (
        <div className="flex justify-between text-xs text-gray-500">
          {speed && <span>Speed: {speed}</span>}
          {timeRemaining && <span>Time: {timeRemaining}</span>}
        </div>
      )}
    </div>
  );
}
