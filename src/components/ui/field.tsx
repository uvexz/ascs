import * as React from "react"
import { Field as BaseField } from '@base-ui-components/react/field'
import { cn } from "@/lib/utils"

const Field = BaseField.Root

const FieldLabel = React.forwardRef<
  React.ElementRef<typeof BaseField.Label>,
  React.ComponentPropsWithoutRef<typeof BaseField.Label>
>(({ className, ...props }, ref) => (
  <BaseField.Label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
FieldLabel.displayName = BaseField.Label.displayName

const FieldControl = React.forwardRef<
  React.ElementRef<typeof BaseField.Control>,
  React.ComponentPropsWithoutRef<typeof BaseField.Control>
>(({ className, ...props }, ref) => (
  <BaseField.Control
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
))
FieldControl.displayName = BaseField.Control.displayName

const FieldDescription = React.forwardRef<
  React.ElementRef<typeof BaseField.Description>,
  React.ComponentPropsWithoutRef<typeof BaseField.Description>
>(({ className, ...props }, ref) => (
  <BaseField.Description
    ref={ref}
    className={cn("text-sm text-gray-500", className)}
    {...props}
  />
))
FieldDescription.displayName = BaseField.Description.displayName

const FieldError = React.forwardRef<
  React.ElementRef<typeof BaseField.Error>,
  React.ComponentPropsWithoutRef<typeof BaseField.Error>
>(({ className, ...props }, ref) => (
  <BaseField.Error
    ref={ref}
    className={cn("text-sm font-medium text-red-600", className)}
    {...props}
  />
))
FieldError.displayName = BaseField.Error.displayName

export { Field, FieldLabel, FieldControl, FieldDescription, FieldError }