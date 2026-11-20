import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border px-4 py-2 font-semibold",
    "transition-colors duration-(--duration-quick) ease-(--ease-standard)",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:cursor-default disabled:opacity-60",
  ],
  {
    variants: {
      variant: {
        primary: "border-accent bg-accent text-accent-ink hover:bg-accent-bright",
        secondary: "border-line bg-surface text-ink hover:border-line-strong",
        danger: "border-danger/60 bg-surface text-danger hover:border-danger",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

/** Action button (shadcn/ui pattern). At least 44px tall for touch targets. */
export function Button({ className, variant, type = "button", ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" type={type} className={cn(buttonVariants({ variant }), className)} {...props} />;
}
