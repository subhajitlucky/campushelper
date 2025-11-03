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
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
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
