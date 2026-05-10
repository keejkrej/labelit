import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SidebarSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border/50 bg-card/60 backdrop-blur-sm not-dark:bg-clip-padding px-3 py-2.5",
        "shadow-xs transition-colors duration-300",
        className,
      )}
    >
      <h3 className="mb-2 font-semibold text-foreground text-xs uppercase tracking-wide">
        {title}
      </h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
      <label className="text-muted-foreground text-xs">
        {label}
        {hint && (
          <span className="ml-1 text-muted-foreground/60 text-[10px]">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
