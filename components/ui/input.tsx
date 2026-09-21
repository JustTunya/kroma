import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-hairline bg-transparent px-3 py-1.5 font-mono text-[15px] tracking-[0.02em] text-text-primary placeholder:text-text-tertiary transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-tertiary aria-invalid:border-badge-alert",
        className
      )}
      {...props}
    />
  )
}

export { Input }
