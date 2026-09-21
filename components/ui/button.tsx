import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-mono text-[11px] font-medium tracking-[0.14em] uppercase transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus active:not-aria-[haspopup]:scale-98 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent-primary text-surface-card hover:bg-accent-hover",
        outline:
          "border-hairline bg-transparent text-text-primary hover:bg-surface-muted",
        secondary:
          "bg-surface-muted text-text-primary hover:bg-border-subtle",
        ghost:
          "hover:bg-surface-muted text-text-primary",
        destructive:
          "bg-badge-alert/10 text-badge-alert hover:bg-badge-alert/20 focus-visible:outline-badge-alert",
        link: "text-accent-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4",
        xs: "h-6 gap-1 px-2.5 text-[10px]",
        sm: "h-7 gap-1 px-3 text-[10px]",
        lg: "h-10 gap-2 px-5 text-[12px]",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-7",
        "icon-lg": "size-10",
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
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
