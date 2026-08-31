import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} ToastProviderProps
 */

const ToastProvider = React.forwardRef(
  /**
   * @param {ToastProviderProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ ...props }, ref) => (
    <div
      ref={ref}
      className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
      {...props}
    />
  )
);
ToastProvider.displayName = "ToastProvider";

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} ToastViewportProps
 */

const ToastViewport = React.forwardRef(
  /**
   * @param {ToastViewportProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ ...props }, ref) => (
    <div
      ref={ref}
      className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
      {...props}
    />
  )
);
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'> &
 *   import('class-variance-authority').VariantProps<typeof toastVariants>} ToastProps
 */

const Toast = React.forwardRef(
  /**
   * @param {ToastProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Toast.displayName = "Toast";

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} ToastActionProps
 */

const ToastAction = React.forwardRef(
  /**
   * @param {ToastActionProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
        className
      )}
      {...props}
    />
  )
);
ToastAction.displayName = "ToastAction";

/**
 * @typedef {React.ComponentPropsWithoutRef<'button'>} ToastCloseProps
 */

const ToastClose = React.forwardRef(
  /**
   * @param {ToastCloseProps} props
   * @param {React.Ref<HTMLButtonElement>} ref
   */
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </button>
  )
);
ToastClose.displayName = "ToastClose";

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} ToastTitleProps
 */

const ToastTitle = React.forwardRef(
  /**
   * @param {ToastTitleProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm font-semibold", className)}
      {...props}
    />
  )
);
ToastTitle.displayName = "ToastTitle";

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} ToastDescriptionProps
 */

const ToastDescription = React.forwardRef(
  /**
   * @param {ToastDescriptionProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  )
);
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};