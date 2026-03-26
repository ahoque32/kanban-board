import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-md)]",
        primary:
          "border-transparent bg-[var(--accent-primary)] text-white shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_srgb,var(--accent-primary)_84%,white)] hover:shadow-[var(--shadow-lg)]",
        ghost:
          "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)]",
        danger:
          "border-transparent bg-[var(--accent-danger)] text-white shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-[color:color-mix(in_srgb,var(--accent-danger)_88%,black)] hover:shadow-[var(--shadow-md)]",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
