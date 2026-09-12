import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold tracking-wide transition-all disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-orange-400 to-orange-600 text-black shadow-[0_0_24px_rgba(255,120,40,0.35)] hover:from-orange-300 hover:to-orange-500",
        cyan: "bg-gradient-to-b from-cyan-300 to-cyan-500 text-black shadow-[0_0_24px_rgba(34,211,238,0.35)] hover:from-cyan-200",
        ghost:
          "border border-cyan-400/30 bg-white/5 text-cyan-100 hover:bg-white/10",
        danger:
          "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_24px_rgba(239,68,68,0.4)]",
        warn: "bg-gradient-to-b from-amber-300 to-amber-500 text-black",
      },
      size: {
        default: "h-12 px-5 text-sm",
        lg: "h-14 px-6 text-base",
        xl: "h-16 px-8 text-lg",
        sm: "h-9 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
