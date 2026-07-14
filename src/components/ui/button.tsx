import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,border-color,box-shadow,color] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/60 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Brand highlight — a glossy vertical sheen (lighter top → deeper
        // bottom) over the brand fill, plus a top inner-light and defined
        // shadow, so the control reads as raised rather than a flat fill.
        default:
          "bg-brand text-brand-foreground bg-[linear-gradient(to_bottom,rgba(255,255,255,0.22),rgba(255,255,255,0)_45%,rgba(0,0,0,0.12))] shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-brand-hover active:bg-brand-active active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] disabled:shadow-none",
        destructive:
          "bg-destructive text-white bg-[linear-gradient(to_bottom,rgba(255,255,255,0.22),rgba(255,255,255,0)_45%,rgba(0,0,0,0.12))] shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-destructive/90 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] focus-visible:ring-destructive/30 dark:focus-visible:ring-destructive/40 dark:bg-destructive/80 disabled:shadow-none",
        outline:
          "border border-black/12 dark:border-white/14 bg-surface-2 text-foreground shadow-xs hover:bg-[var(--surface-hover)] active:bg-[var(--surface-selected)]",
        secondary:
          "bg-secondary text-secondary-foreground border border-black/8 dark:border-white/8 shadow-xs hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "hover:bg-[var(--surface-hover)] active:bg-[var(--surface-selected)] text-foreground",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
