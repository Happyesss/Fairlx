import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-tr from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_1px_2px_0_rgba(59,130,246,0.2)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_3px_6px_0_rgba(59,130,246,0.25)] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:-translate-x-full hover:before:animate-[shimmer_1s_ease-in-out]",
        destructive:
          "bg-gradient-to-tr from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 shadow-[0_0_0_1px_rgba(239,68,68,0.1),0_1px_2px_0_rgba(239,68,68,0.2)] hover:shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_3px_6px_0_rgba(239,68,68,0.25)]",
        outline:
          "border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50/50 hover:border-neutral-300 hover:shadow-md transition-all",
        secondary:
          "bg-white text-black shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.05)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_3px_6px_0_rgba(0,0,0,0.1)] hover:bg-neutral-50/80",
        ghost:
          "hover:bg-neutral-100/50 hover:text-neutral-900 transition-colors",
        muted:
          "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 transition-colors",
        teritary:
          "bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-[0_0_0_1px_rgba(59,130,246,0.1)] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_3px_6px_0_rgba(59,130,246,0.1)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        xs: "h-7 rounded-md px-2 text-xs",
        lg: "h-12 rounded-md px-8",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
