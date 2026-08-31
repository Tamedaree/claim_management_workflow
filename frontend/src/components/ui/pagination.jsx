import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * @typedef {React.ComponentPropsWithoutRef<"nav">} PaginationProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"ul">} PaginationContentProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"li">} PaginationItemProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"a"> & {
 *   isActive?: boolean,
 *   size?: import("class-variance-authority").VariantProps<typeof buttonVariants>["size"]
 * }} PaginationLinkProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"a">} PaginationPreviousProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"a">} PaginationNextProps
 */

/**
 * @typedef {React.ComponentPropsWithoutRef<"span">} PaginationEllipsisProps
 */

/**
 * @param {PaginationProps} props
 */
const Pagination = ({ className, ...props }) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);

Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef(
  /**
   * @param {PaginationContentProps} props
   * @param {React.Ref<HTMLUListElement>} ref
   */
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  )
);

PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef(
  /**
   * @param {PaginationItemProps} props
   * @param {React.Ref<HTMLLIElement>} ref
   */
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn("", className)}
      {...props}
    />
  )
);

PaginationItem.displayName = "PaginationItem";

/**
 * @param {PaginationLinkProps} props
 */
const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
);

PaginationLink.displayName = "PaginationLink";

/**
 * @param {PaginationPreviousProps} props
 */
const PaginationPrevious = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
);

PaginationPrevious.displayName = "PaginationPrevious";

/**
 * @param {PaginationNextProps} props
 */
const PaginationNext = ({ className, ...props }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);

PaginationNext.displayName = "PaginationNext";

/**
 * @param {PaginationEllipsisProps} props
 */
const PaginationEllipsis = ({ className, ...props }) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);

PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};