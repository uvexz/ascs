import * as React from "react"
import { Menu as BaseMenu } from '@base-ui-components/react/menu'
import { cn } from "@/lib/utils"

const Menu = BaseMenu.Root

const MenuTrigger = React.forwardRef<
  React.ElementRef<typeof BaseMenu.Trigger>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Trigger>
>(({ className, ...props }, ref) => (
  <BaseMenu.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
))
MenuTrigger.displayName = BaseMenu.Trigger.displayName

const MenuPortal = BaseMenu.Portal

const MenuPositioner = React.forwardRef<
  React.ElementRef<typeof BaseMenu.Positioner>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>
>(({ className, ...props }, ref) => (
  <BaseMenu.Positioner
    ref={ref}
    className={cn("z-50", className)}
    {...props}
  />
))
MenuPositioner.displayName = BaseMenu.Positioner.displayName

const MenuPopup = React.forwardRef<
  React.ElementRef<typeof BaseMenu.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Popup>
>(({ className, ...props }, ref) => (
  <BaseMenu.Popup
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md",
      className
    )}
    {...props}
  />
))
MenuPopup.displayName = BaseMenu.Popup.displayName

const MenuItem = React.forwardRef<
  React.ElementRef<typeof BaseMenu.Item>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Item>
>(({ className, ...props }, ref) => (
  <BaseMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))
MenuItem.displayName = BaseMenu.Item.displayName

const MenuSeparator = React.forwardRef<
  React.ElementRef<typeof BaseMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Separator>
>(({ className, ...props }, ref) => (
  <BaseMenu.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-gray-200", className)}
    {...props}
  />
))
MenuSeparator.displayName = BaseMenu.Separator.displayName

export {
  Menu,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
  MenuSeparator,
}