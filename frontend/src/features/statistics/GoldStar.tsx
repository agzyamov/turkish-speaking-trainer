import { cn } from "../../shared/lib/utils";

/** The reward star for a day with twenty or more attempts; drawn in the tulip glass's gold. */
export function GoldStar({ className }: { className?: string }) {
  return (
    <svg className={cn("gold-star block shrink-0 text-reward", className)} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1Z" fill="currentColor" />
    </svg>
  );
}
