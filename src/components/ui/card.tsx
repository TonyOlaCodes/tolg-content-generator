import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  interactive,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "card-surface w-full text-left p-4",
        interactive && "transition hover:bg-[var(--card-hover)] active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
