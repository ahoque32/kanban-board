import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "h-10 w-full rounded-xl border border-white/30 bg-white/78 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
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
