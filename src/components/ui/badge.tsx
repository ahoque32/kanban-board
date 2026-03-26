import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.02em]", {
  variants: {
    variant: {
      neutral: "border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]",
      low: "bg-[color:color-mix(in_srgb,var(--accent-success)_16%,transparent)] text-[var(--accent-success)]",
      med: "bg-[color:color-mix(in_srgb,var(--accent-warning)_16%,transparent)] text-[var(--accent-warning)]",
      high: "bg-[color:color-mix(in_srgb,var(--accent-danger)_16%,transparent)] text-[var(--accent-danger)]",
      label: "bg-[color:color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--accent-primary)]",
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
