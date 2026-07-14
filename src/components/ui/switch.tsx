"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer focus-visible:ring-ring/40 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // Off: a clearly visible track (not the page background) with a defined
        // border and inner shadow so the control reads as switchable.
        "data-[state=unchecked]:border-black/15 data-[state=unchecked]:bg-black/10 dark:data-[state=unchecked]:border-white/15 dark:data-[state=unchecked]:bg-white/12 data-[state=unchecked]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]",
        // On: brand gradient + gloss, matching buttons and checkboxes.
        "data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=checked]:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.28),rgba(255,255,255,0)_50%,rgba(0,0,0,0.14))] data-[state=checked]:shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.3)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
