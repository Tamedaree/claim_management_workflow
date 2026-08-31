"use client";
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Controller, FormProvider, useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

/**
 * @typedef {{ name: string }} FormFieldContextValue
 */

/** @type {React.Context<FormFieldContextValue>} */
const FormFieldContext = React.createContext(/** @type {FormFieldContextValue} */ ({}))

/**
 * @param {import('react-hook-form').ControllerProps<any, any>} props
 */
const FormField = (
  {
    ...props
  }
) => {
  return (
    (<FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>)
  );
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

/**
 * @typedef {{ id: string }} FormItemContextValue
 */

/** @type {React.Context<FormItemContextValue>} */
const FormItemContext = React.createContext(/** @type {FormItemContextValue} */ ({}))

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'>} FormItemProps
 */

const FormItem = React.forwardRef(
  /**
   * @param {FormItemProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ className, ...props }, ref) => {
    const id = React.useId()

    return (
      (<FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>)
    );
  }
)
FormItem.displayName = "FormItem"

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof Label>} FormLabelProps
 */

const FormLabel = React.forwardRef(
  /**
   * @param {FormLabelProps} props
   * @param {React.Ref<React.ElementRef<typeof Label>>} ref
   */
  ({ className, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    return (
      (<Label
        ref={ref}
        className={cn(error && "text-destructive", className)}
        htmlFor={formItemId}
        {...props} />)
    );
  }
)
FormLabel.displayName = "FormLabel"

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof Slot>} FormControlProps
 */

const FormControl = React.forwardRef(
  /**
   * @param {FormControlProps} props
   * @param {React.Ref<React.ElementRef<typeof Slot>>} ref
   */
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

    return (
      (<Slot
        ref={ref}
        id={formItemId}
        aria-describedby={
          !error
            ? `${formDescriptionId}`
            : `${formDescriptionId} ${formMessageId}`
        }
        aria-invalid={!!error}
        {...props} />)
    );
  }
)
FormControl.displayName = "FormControl"

/**
 * @typedef {React.ComponentPropsWithoutRef<'p'>} FormDescriptionProps
 */

const FormDescription = React.forwardRef(
  /**
   * @param {FormDescriptionProps} props
   * @param {React.Ref<HTMLParagraphElement>} ref
   */
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField()

    return (
      (<p
        ref={ref}
        id={formDescriptionId}
        className={cn("text-[0.8rem] text-muted-foreground", className)}
        {...props} />)
    );
  }
)
FormDescription.displayName = "FormDescription"

/**
 * @typedef {React.ComponentPropsWithoutRef<'p'>} FormMessageProps
 */

const FormMessage = React.forwardRef(
  /**
   * @param {FormMessageProps} props
   * @param {React.Ref<HTMLParagraphElement>} ref
   */
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error?.message) : children

    if (!body) {
      return null
    }

    return (
      (<p
        ref={ref}
        id={formMessageId}
        className={cn("text-[0.8rem] font-medium text-destructive", className)}
        {...props}>
        {body}
      </p>)
    );
  }
)
FormMessage.displayName = "FormMessage"

export {
  // eslint-disable-next-line react-refresh/only-export-components
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}