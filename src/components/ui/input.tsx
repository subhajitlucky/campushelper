import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // Don't destruct form props that aren't valid HTML attributes
  // These will be filtered out by the spread operator
  const restProps = props;

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base shadow-xs transition-colors",
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        // The old `focus:ring-0` plus `outline-none` meant a focused field was
        // indistinguishable from an unfocused one. Controls share one radius
        // (rounded-lg) and one visible focus ring with Button.
        "border-input focus:border-ring",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "md:text-sm",
        className
      )}
      {...restProps}
    />
  )
}

export { Input }
