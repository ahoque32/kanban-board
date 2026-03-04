import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "min-h-24 w-full rounded-xl border border-white/30 bg-white/40 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
