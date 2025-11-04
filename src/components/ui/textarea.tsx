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
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Default border and ring colors
          "border-input focus-visible:border-ring focus-visible:ring-ring/50",
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
