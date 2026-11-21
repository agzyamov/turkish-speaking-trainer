import type * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

/** Single choice from a set (shadcn/ui pattern on Radix). Arrow keys move between items. */
export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-surface-raised p-0 text-accent-ink",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator">
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}
