import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 rounded-lg border px-3.5 py-1 text-base outline-none transition-[color,box-shadow,border-color] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Recessed field: darker inset bg + defined border so it reads as a
        // distinct surface rather than blending into the container behind it.
        "bg-black/[0.03] dark:bg-black/25 border-black/12 dark:border-white/12 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:bg-black/[0.02] dark:focus-visible:bg-black/20",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
