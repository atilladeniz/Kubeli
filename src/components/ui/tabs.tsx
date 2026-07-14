"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

/**
 * TabsList with a sliding pill that tweens between triggers (transitions.dev
 * pattern). The active trigger's offsetLeft/offsetWidth are written onto the
 * pill; first paint and resize snap without a transition so it never animates
 * in from the corner. Falls back to a static highlight under reduced-motion.
 */
function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLSpanElement>(null)
  const firstPaint = React.useRef(true)

  React.useLayoutEffect(() => {
    const list = listRef.current
    const pill = pillRef.current
    if (!list || !pill) return

    const place = () => {
      const active = list.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]'
      )
      if (!active) {
        pill.style.opacity = "0"
        return
      }
      if (firstPaint.current) {
        pill.style.transition = "none"
      }
      pill.style.opacity = "1"
      pill.style.transform = `translateX(${active.offsetLeft}px)`
      pill.style.width = `${active.offsetWidth}px`
      pill.style.height = `${active.offsetHeight}px`
      if (firstPaint.current) {
        // Force reflow, then restore the transition for later moves.
        void pill.offsetWidth
        pill.style.transition = ""
        firstPaint.current = false
      }
    }

    place()
    const mo = new MutationObserver(place)
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state"],
    })
    const ro = new ResizeObserver(place)
    ro.observe(list)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        "bg-[var(--surface-hover)] text-muted-foreground relative inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="bg-surface-3 shadow-surface-2 pointer-events-none absolute top-[3px] left-0 z-0 rounded-md opacity-0 [transition:transform_250ms_cubic-bezier(0.22,1,0.36,1),width_250ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground dark:text-muted-foreground data-[state=active]:text-foreground focus-visible:ring-ring/50 relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // Radix mounts only the active panel, so page-enter fires on each switch.
      className={cn("page-enter flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
