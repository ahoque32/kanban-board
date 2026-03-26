import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
  {
    variants: {
      variant: {
        default:
          "bg-white/80 text-slate-900 shadow-sm hover:bg-white hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
        primary:
          "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-lg shadow-cyan-900/30 hover:from-sky-400 hover:to-cyan-400 hover:scale-[1.01] active:scale-[0.99]",
        ghost:
          "bg-white/15 text-white border border-white/25 hover:bg-white/25 hover:scale-[1.01] active:scale-[0.99]",
        danger: "bg-rose-500 text-white hover:bg-rose-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
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
