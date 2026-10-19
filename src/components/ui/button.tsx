import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button
 *
 * Radius is `rounded-lg` on every control (brief §3), so nothing has to be
 * overridden per call site. Hover is a colour change — the old `hover:scale-105`
 * plus a shadow and a ripple overlay was the loudest generic-template tell in
 * the app, and a filled button that grows under the cursor is not premium.
 *
 * The base carries `gap-2`, so an icon child and the label are always spaced;
 * `mr-2` is deliberately NOT applied to the spinner below, or the two would
 * stack into a 16px gap.
 *
 * Variants, in descending emphasis:
 *   default      one per view — the primary action
 *   destructive  delete / irreversible
 *   success      confirm a handover
 *   outline      secondary action next to a filled one
 *   secondary    neutral filled, for toolbars
 *   ghost        icon and utility buttons (transparent, fills on hover)
 *   quiet        tertiary text actions — no fill, muted until hovered
 *   link         inline text link styled as a button
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        quiet: "text-muted-foreground hover:text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        info: "bg-info text-info-foreground hover:bg-info/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "size-10",
        // Square icon button that sits flush with `size="sm"` controls.
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // Loading state overrides disabled
    const isDisabled = disabled || loading;

    // When asChild is true, Slot accepts exactly one child, so the spinner
    // cannot be injected — callers that need it pass a disabled/loading label.
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={isDisabled}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
