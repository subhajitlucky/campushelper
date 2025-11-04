import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    // Filter out form-specific props that aren't valid HTML attributes
    // Use type assertion to handle form library props
    const {
      // Form validation props from libraries like React Hook Form
      error,
      touched,
      isValid,
      // Spread the rest to the textarea element
      ...restProps
    } = props as any;

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground transition-colors",
          "focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Default border color
          "border-input focus:border-ring",
          className
        )}
        ref={ref}
        {...restProps}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
