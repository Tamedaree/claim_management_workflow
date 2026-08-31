"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>} ProgressProps
 */

const Progress = React.forwardRef(
  /**
   * @param {ProgressProps} props
   * @param {React.Ref<React.ElementRef<typeof ProgressPrimitive.Root>>} ref
   */
  ({ className, ...props }, ref) => (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-border",
        className
      )}
      {...props}
    />
  )
)

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
