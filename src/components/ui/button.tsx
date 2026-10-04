import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";

const styles: Record<Variant, string> = {
  primary:
    "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]",
  secondary:
    "bg-[var(--card)] text-white border border-[var(--border)] hover:bg-[var(--card-hover)] active:scale-[0.98]",
  ghost: "bg-transparent text-white hover:bg-white/5 active:scale-[0.98]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90 active:scale-[0.98]",
  accent:
    "bg-[var(--accent)] text-black hover:brightness-110 active:scale-[0.98]",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" && "h-10 px-3 text-sm",
        size === "md" && "h-12 px-4 text-[15px]",
        size === "lg" && "h-14 px-5 text-base",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
});
