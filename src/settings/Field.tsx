import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A labelled control, matching the label rhythm of beUI's Input.
 * Plain layout only: no surface, no decoration.
 */
export function Field({
  label,
  value,
  hint,
  children,
  className
}: {
  label?: ReactNode;
  /** Small readout on the right of the label, e.g. "72%". */
  value?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label || value ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {value ? (
            <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
          ) : null}
        </div>
      ) : null}
      {children}
      {hint ? (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** A label on the left, a single control on the right. */
export function ToggleRow({
  label,
  hint,
  children
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-1">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</div>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
