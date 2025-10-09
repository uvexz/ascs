import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
  {
    variants: {
      variant: {
        default:
          "bg-gray-900 text-white hover:bg-gray-800 focus-visible:outline-gray-900",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
        outline:
          "border border-gray-200 bg-white hover:bg-gray-50 focus-visible:outline-gray-900",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline-gray-900",
        ghost:
          "hover:bg-gray-100 focus-visible:outline-gray-900",
        link: "text-blue-600 underline-offset-4 hover:underline focus-visible:outline-blue-600",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
