import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-md border border-cyan-400/25 bg-black/40 px-4 text-lg tracking-wide text-cyan-50 placeholder:text-cyan-200/30 outline-none focus:border-orange-400/70 focus:ring-2 focus:ring-orange-400/30",
        className,
      )}
      {...props}
    />
  );
}
