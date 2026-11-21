import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge must know the project's custom text-size tokens (tokens.css: --text-*);
// otherwise it treats `text-answer` and a colour such as `text-ink` as the same group and drops one.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["phrase", "phrase-lg", "answer", "title", "title-compact", "caption", "micro"] }],
    },
  },
});

/** Join class names; later Tailwind utilities replace conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
