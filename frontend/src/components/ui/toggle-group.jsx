"use client";
import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

/**
 * @typedef {import('class-variance-authority').VariantProps<typeof toggleVariants>} ToggleVariantProps
 */

/** @type {React.Context<ToggleVariantProps>} */
const ToggleGroupContext = React.createContext(
  /** @type {ToggleVariantProps} */ ({
    size: "default",
    variant: "default",
  })
)

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & ToggleVariantProps} ToggleGroupProps
 */

const ToggleGroup = React.forwardRef(
  /**
   * @param {ToggleGroupProps} props
   * @param {React.Ref<React.ElementRef<typeof ToggleGroupPrimitive.Root>>} ref
   */
  ({ className, variant, size, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn("flex items-center justify-center gap-1", className)}
      {...props}>
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
)

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & ToggleVariantProps} ToggleGroupItemProps
 */

const ToggleGroupItem = React.forwardRef(
  /**
   * @param {ToggleGroupItemProps} props
   * @param {React.Ref<React.ElementRef<typeof ToggleGroupPrimitive.Item>>} ref
   */
  ({ className, children, variant, size, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)

    return (
      (<ToggleGroupPrimitive.Item
        ref={ref}
        className={cn(toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }), className)}
        {...props}>
        {children}
      </ToggleGroupPrimitive.Item>)
    );
  }
)

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }