import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { TaskStatus } from "@/features/tasks/types";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        [TaskStatus.TODO]:
          "border-transparent bg-gray-400 text-gray-900 dark:bg-gray-500 dark:text-gray-50 hover:bg-gray-400/80 dark:hover:bg-gray-500/80",
        [TaskStatus.ASSIGNED]:
          "border-transparent bg-red-400 text-red-900 dark:bg-red-500 dark:text-red-50 hover:bg-red-400/80 dark:hover:bg-red-500/80",
        [TaskStatus.IN_PROGRESS]:
          "border-transparent bg-yellow-400 text-yellow-900 dark:bg-yellow-500 dark:text-yellow-50 hover:bg-yellow-400/80 dark:hover:bg-yellow-500/80",
        [TaskStatus.IN_REVIEW]:
          "border-transparent bg-blue-400 text-blue-900 dark:bg-blue-500 dark:text-blue-50 hover:bg-blue-400/80 dark:hover:bg-blue-500/80",
        [TaskStatus.DONE]:
          "border-transparent bg-emerald-400 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-50 hover:bg-emerald-400/80 dark:hover:bg-emerald-500/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
