import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { EASE_OUT } from "./motion";
import { cn } from "./utils";

export interface CardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Stagger index for the entrance animation. */
  index?: number;
}

/**
 * Settings card: hairline border, soft shadow, and a short rise-in on mount
 * (beUI card pattern, reduced to a static surface).
 */
export function Card({
  title,
  description,
  icon,
  actions,
  children,
  className,
  index = 0
}: CardProps) {
  const reduce = useReducedMotion();
  const id = useId();

  return (
    <motion.section
      aria-labelledby={title ? id : undefined}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: EASE_OUT, delay: Math.min(index, 6) * 0.035 }}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.24)]",
        className
      )}
    >
      {title || actions ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon ? (
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? (
                <h2 id={id} className="text-[15px] font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </motion.section>
  );
}

export interface RowProps {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Stack the control under the label instead of beside it. */
  stacked?: boolean;
}

/** One labelled control row, shared by every settings section. */
export function Row({ label, hint, children, className, stacked }: RowProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-2",
        stacked ? "flex-col" : "items-center justify-between",
        className
      )}
    >
      {label ? (
        <div className="min-w-0 shrink-0">
          <div className="text-[13px] font-medium text-foreground">{label}</div>
          {hint ? (
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("min-w-0", stacked ? "w-full" : "flex items-center gap-2")}>
        {children}
      </div>
    </div>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-6 sm:grid-cols-2", className)}>{children}</div>;
}
