import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "h-11 w-full rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[var(--shadow-sm)] backdrop-blur-md transition-all duration-200 focus-visible:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
