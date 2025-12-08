"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

// Simple Checkbox implementation without Radix UI primitive to avoid new deps
const Checkbox = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      ref={ref}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white data-[state=checked]:border-purple-600 border-gray-300",
        className
      )}
      {...props}
    >
      <span className={cn("flex items-center justify-center text-current", checked ? "opacity-100" : "opacity-0")}>
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
    </button>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
