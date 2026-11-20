import type * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

/** On/off control (shadcn/ui pattern on Radix). Renders role="switch" with aria-checked. */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-line bg-surface-raised p-0",
        "transition-colors duration-(--duration-quick) ease-(--ease-standard)",
        "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:cursor-wait disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-ink shadow-sm",
          "transition-transform duration-(--duration-quick) ease-(--ease-standard)",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
