import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card
 *
 * One surface, one elevation level (brief §3): `rounded-xl`, a faint
 * `border-border-subtle` outline, `shadow-card`. The old default was
 * `hover:shadow-lg hover:-translate-y-1` on *every* card, which is what made the
 * app read as a generic template — a panel that is not clickable should not lift
 * when the cursor crosses it.
 *
 * Elevation is therefore opt-in: pass `hover` for cards that really are
 * interactive. Prefer a SectionHeader plus whitespace over a Card when grouping
 * content that is not a discrete object.
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hover?: boolean;
    glow?: boolean;
  }
>(({ className, hover = false, glow = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-border-subtle bg-card text-card-foreground shadow-card transition-shadow duration-200 ease-out",
      hover && "hover:shadow-card-hover",
      glow && "glow-blue",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    animated?: boolean;
  }
>(({ className, animated = true, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // A card title sits at body size and lets weight do the work: 16px/500,
      // one step under a SectionHeader without shouting over the body copy.
      "text-base font-medium leading-snug tracking-tight",
      animated && "transition-colors duration-200 ease-in-out hover:text-primary",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground transition-colors duration-200", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
