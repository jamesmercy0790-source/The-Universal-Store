import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-sm px-5 py-3 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brass-500 text-ink-950 hover:bg-brass-400",
        variant === "secondary" && "border border-brass-500/40 text-bone-100 hover:border-brass-400 hover:text-brass-400",
        variant === "ghost" && "text-bone-300 hover:text-bone-100",
        className
      )}
      {...props}
    />
  );
}
