import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    // Filter out form-specific props that aren't valid HTML attributes
    const {
      // Form validation props from libraries like React Hook Form
      error,
      touched,
      isValid,
      // Spread the rest to the textarea element
      ...restProps
    } = props as TextareaProps & {
      error?: unknown;
      touched?: unknown;
      isValid?: unknown;
    };

    // These props are intentionally not forwarded to the DOM
    void error;
    void touched;
    void isValid;

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border bg-background px-3 py-2 text-base shadow-xs placeholder:text-muted-foreground transition-colors",
          // Controls share one radius (rounded-lg) and one visible focus ring
          // with Button — `focus:ring-0` used to erase the indicator entirely.
          "border-input focus:border-ring",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
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
