"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[5px] border outline-none transition-[box-shadow,background-color,border-color] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Unchecked: recessed field, matching inputs.
        "border-black/15 bg-black/[0.03] dark:border-white/15 dark:bg-black/25",
        // Checked: brand gradient + gloss sheen + top inner-light, like buttons.
        "data-[state=checked]:text-brand-foreground data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=checked]:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.28),rgba(255,255,255,0)_50%,rgba(0,0,0,0.14))] data-[state=checked]:shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.3)]",
        "focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
