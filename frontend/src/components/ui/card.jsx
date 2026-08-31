import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardProps
 */

const Card = React.forwardRef(
  /**
   * @param {CardProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
      {...props} />
  )
)
Card.displayName = "Card"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardHeaderProps
 */

const CardHeader = React.forwardRef(
  /**
   * @param {CardHeaderProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props} />
  )
)
CardHeader.displayName = "CardHeader"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardTitleProps
 */

const CardTitle = React.forwardRef(
  /**
   * @param {CardTitleProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props} />
  )
)
CardTitle.displayName = "CardTitle"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardDescriptionProps
 */

const CardDescription = React.forwardRef(
  /**
   * @param {CardDescriptionProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  )
)
CardDescription.displayName = "CardDescription"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardContentProps
 */

const CardContent = React.forwardRef(
  /**
   * @param {CardContentProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} CardFooterProps
 */

const CardFooter = React.forwardRef(
  /**
   * @param {CardFooterProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }