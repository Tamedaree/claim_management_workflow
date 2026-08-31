"use client"

import * as React from "react"
import * as MenubarPrimitive from "@radix-ui/react-menubar"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"


/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Menu>} MenubarMenuProps
 */

/**
 * @param {MenubarMenuProps} props
 */
function MenubarMenu({ ...props }) {
  return <MenubarPrimitive.Menu {...props} />;
}

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Group>} MenubarGroupProps
 */

/**
 * @param {MenubarGroupProps} props
 */
function MenubarGroup({ ...props }) {
  return <MenubarPrimitive.Group {...props} />;
}

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Portal>} MenubarPortalProps
 */

/**
 * @param {MenubarPortalProps} props
 */
function MenubarPortal({ ...props }) {
  return <MenubarPrimitive.Portal {...props} />;
}

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioGroup>} MenubarRadioGroupProps
 */

/**
 * @param {MenubarRadioGroupProps} props
 */
function MenubarRadioGroup({ ...props }) {
  return <MenubarPrimitive.RadioGroup {...props} />;
}

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Sub>} MenubarSubProps
 */

/**
 * @param {MenubarSubProps} props
 */
function MenubarSub({ ...props }) {
  return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>} MenubarProps
 */

const Menubar = React.forwardRef(
  /**
   * @param {MenubarProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <MenubarPrimitive.Root
      ref={ref}
      className={cn(
        "flex h-9 items-center space-x-1 rounded-md border bg-background p-1 shadow-sm",
        className
      )}
      {...props}
    />
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>} MenubarTriggerProps
 */

const MenubarTrigger = React.forwardRef(
  /**
   * @param {MenubarTriggerProps} props
   * @param {React.Ref<HTMLButtonElement>} ref
   */
  ({ className, ...props }, ref) => (
    <MenubarPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none",
        className
      )}
      {...props}
    />
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
 *   inset?: boolean
 * }} MenubarSubTriggerProps
 */

const MenubarSubTrigger = React.forwardRef(
  /**
   * @param {MenubarSubTriggerProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, inset, children, ...props }, ref) => (
    // ...
    <MenubarPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        inset && "pl-8",
        className
      )}
      {...props}>
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </MenubarPrimitive.SubTrigger>
  )
);  

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>} MenubarSubContentProps
 */

const MenubarSubContent = React.forwardRef(
  /**
   * @param {MenubarSubContentProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <MenubarPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>} MenubarContentProps
 */

const MenubarContent = React.forwardRef(
  /**
   * @param {MenubarContentProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        ref={ref}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </MenubarPrimitive.Portal>
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
 *   inset?: boolean
 * }} MenubarItemProps
 */

const MenubarItem = React.forwardRef(
  /**
   * @param {MenubarItemProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, inset, ...props }, ref) => (
    <MenubarPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>} MenubarCheckboxItemProps
 */

const MenubarCheckboxItem = React.forwardRef(
  /**
   * @param {MenubarCheckboxItemProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, children, checked, ...props }, ref) => (
    <MenubarPrimitive.CheckboxItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        className
      )}
      checked={checked}
      {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>} MenubarRadioItemProps
 */

const MenubarRadioItem = React.forwardRef(
  /**
   * @param {MenubarRadioItemProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, children, ...props }, ref) => (
    <MenubarPrimitive.RadioItem
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        className
      )}
      {...props}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Circle className="h-4 w-4 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.RadioItem>
  )
);  

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
 *   inset?: boolean
 * }} MenubarLabelProps
 */

const MenubarLabel = React.forwardRef(
  /**
   * @param {MenubarLabelProps} props
   * @param {React.Ref<HTMLParagraphElement>} ref
   */
  ({ className, inset, ...props }, ref) => (
    <MenubarPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
      {...props}
    />
  )
);

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>} MenubarSeparatorProps
 */

const MenubarSeparator = React.forwardRef(
  /**
   * @param {MenubarSeparatorProps} props
   * @param {React.Ref<HTMLHRElement>} ref
   */
  ({ className, ...props }, ref) => (
    <MenubarPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  )
);  

/**
 * @param {React.ComponentPropsWithoutRef<'span'>} props
 */
const MenubarShortcut = ({
  className,
  ...props
}) => {
  return (
    (<span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props} />)
  );
}

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}
