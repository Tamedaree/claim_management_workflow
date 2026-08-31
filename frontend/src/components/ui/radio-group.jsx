import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>} RadioGroupProps
 */

const RadioGroup = React.forwardRef(
  /**
   * @param {RadioGroupProps} props
   * @param {React.Ref<React.ElementRef<typeof RadioGroupPrimitive.Root>>} ref
   */
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Root 
      className={cn("grid gap-2", className)} 
      {...props} 
      ref={ref} 
    />
  )
)
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>} RadioGroupItemProps
 */

const RadioGroupItem = React.forwardRef(
  /**
   * @param {RadioGroupItemProps} props
   * @param {React.Ref<React.ElementRef<typeof RadioGroupPrimitive.Item>>} ref
   */
  ({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
)
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }