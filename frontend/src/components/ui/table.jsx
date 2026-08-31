import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {React.ComponentPropsWithoutRef<'table'>} TableProps
 */

const Table = React.forwardRef(
  /**
   * @param {TableProps} props
   * @param {React.Ref<HTMLTableElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props} />
    </div>
  )
)
Table.displayName = "Table"

/**
 * @typedef {React.ComponentPropsWithoutRef<'thead'>} TableHeaderProps
 */

const TableHeader = React.forwardRef(
  /**
   * @param {TableHeaderProps} props
   * @param {React.Ref<HTMLTableSectionElement>} ref
   */
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )
)
TableHeader.displayName = "TableHeader"

/**
 * @typedef {React.ComponentPropsWithoutRef<'tbody'>} TableBodyProps
 */

const TableBody = React.forwardRef(
  /**
   * @param {TableBodyProps} props
   * @param {React.Ref<HTMLTableSectionElement>} ref
   */
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  )
)
TableBody.displayName = "TableBody"

/**
 * @typedef {React.ComponentPropsWithoutRef<'tfoot'>} TableFooterProps
 */

const TableFooter = React.forwardRef(
  /**
   * @param {TableFooterProps} props
   * @param {React.Ref<HTMLTableSectionElement>} ref
   */
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props} />
  )
)
TableFooter.displayName = "TableFooter"

/**
 * @typedef {React.ComponentPropsWithoutRef<'tr'>} TableRowProps
 */

const TableRow = React.forwardRef(
  /**
   * @param {TableRowProps} props
   * @param {React.Ref<HTMLTableRowElement>} ref
   */
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props} />
  )
)
TableRow.displayName = "TableRow"

/**
 * @typedef {React.ComponentPropsWithoutRef<'th'>} TableHeadProps
 */

const TableHead = React.forwardRef(
  /**
   * @param {TableHeadProps} props
   * @param {React.Ref<HTMLTableCellElement>} ref
   */
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  )
)
TableHead.displayName = "TableHead"

/**
 * @typedef {React.ComponentPropsWithoutRef<'td'>} TableCellProps
 */

const TableCell = React.forwardRef(
  /**
   * @param {TableCellProps} props
   * @param {React.Ref<HTMLTableCellElement>} ref
   */
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  )
)
TableCell.displayName = "TableCell"

/**
 * @typedef {React.ComponentPropsWithoutRef<'caption'>} TableCaptionProps
 */

const TableCaption = React.forwardRef(
  /**
   * @param {TableCaptionProps} props
   * @param {React.Ref<HTMLTableCaptionElement>} ref
   */
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props} />
  )
)
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}