import type * as React from "react";
import { cn } from "../lib/utils";

/** Bordered surface that groups related content. */
export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="card" className={cn("grid gap-4 rounded-card border border-line bg-surface p-5 text-ink", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("m-0 text-base font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("m-0 text-caption text-ink-muted", className)} {...props} />;
}
