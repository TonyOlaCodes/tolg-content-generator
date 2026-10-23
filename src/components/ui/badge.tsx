import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "accent" | "muted" | "danger" | "success" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-white/10 text-white",
        variant === "accent" && "bg-[var(--accent)]/20 text-[var(--accent)]",
        variant === "muted" && "bg-white/5 text-white/60",
        variant === "danger" && "bg-red-500/15 text-red-300",
        variant === "success" && "bg-emerald-500/15 text-emerald-300",
        className,
      )}
      {...props}
    />
  );
}
