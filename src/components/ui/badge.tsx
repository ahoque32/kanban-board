import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-white/40 text-slate-700",
      low: "bg-emerald-100/90 text-emerald-700",
      med: "bg-amber-100/90 text-amber-700",
      high: "bg-rose-100/90 text-rose-700",
      label: "bg-sky-100/90 text-sky-700",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
