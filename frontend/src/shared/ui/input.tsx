import type * as React from "react";
import { cn } from "../lib/utils";

const control = cn(
  "w-full min-w-0 rounded-control border border-line bg-surface-raised px-3 py-2.5 text-ink [color-scheme:dark] placeholder:text-ink-muted",
  "transition-colors duration-(--duration-quick) hover:border-line-strong focus:border-line-strong",
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  "disabled:cursor-default disabled:opacity-60 disabled:hover:border-line",
);

/** Text, number or date input on the walnut control surface. */
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(control, className)} {...props} />;
}

/** Native select styled like Input; options inherit the dark surface. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(control, "cursor-pointer [&>option]:bg-surface-raised [&>option]:text-ink", className)} {...props} />;
}

/** A label stacked above its control, with the caption in muted ink. */
export function Field({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="field" className={cn("grid gap-1.5 text-sm text-ink-soft", className)} {...props} />;
}

/** Multi-line text input styled like Input. */
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(control, "resize-y leading-normal", className)} {...props} />;
}
