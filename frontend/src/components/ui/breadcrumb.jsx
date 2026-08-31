import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<'nav'>} BreadcrumbProps
 */

const Breadcrumb = React.forwardRef(
  /**
   * @param {BreadcrumbProps} props
   * @param {React.Ref<HTMLElement>} ref
   */
  ({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />
)
Breadcrumb.displayName = "Breadcrumb"

/**
 * @typedef {React.ComponentPropsWithoutRef<'ol'>} BreadcrumbListProps
 */

const BreadcrumbList = React.forwardRef(
  /**
   * @param {BreadcrumbListProps} props
   * @param {React.Ref<HTMLOListElement>} ref
   */
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        className
      )}
      {...props} />
  )
)
BreadcrumbList.displayName = "BreadcrumbList"

/**
 * @typedef {React.ComponentPropsWithoutRef<'li'>} BreadcrumbItemProps
 */

const BreadcrumbItem = React.forwardRef(
  /**
   * @param {BreadcrumbItemProps} props
   * @param {React.Ref<HTMLLIElement>} ref
   */
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props} />
  )
)
BreadcrumbItem.displayName = "BreadcrumbItem"

/**
 * @typedef {React.ComponentPropsWithoutRef<'a'> & { asChild?: boolean }} BreadcrumbLinkProps
 */

const BreadcrumbLink = React.forwardRef(
  /**
   * @param {BreadcrumbLinkProps} props
   * @param {React.Ref<HTMLAnchorElement>} ref
   */
  ({ asChild, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "a"

    return (
      (<Comp
        ref={ref}
        className={cn("transition-colors hover:text-foreground", className)}
        {...props} />)
    );
  }
)
BreadcrumbLink.displayName = "BreadcrumbLink"

/**
 * @typedef {React.ComponentPropsWithoutRef<'span'>} BreadcrumbPageProps
 */

const BreadcrumbPage = React.forwardRef(
  /**
   * @param {BreadcrumbPageProps} props
   * @param {React.Ref<HTMLSpanElement>} ref
   */
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props} />
  )
)
BreadcrumbPage.displayName = "BreadcrumbPage"

/**
 * @param {React.ComponentPropsWithoutRef<'li'>} props
 */
const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}>
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

/**
 * @param {React.ComponentPropsWithoutRef<'span'>} props
 */
const BreadcrumbEllipsis = ({
  className,
  ...props
}) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}>
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}