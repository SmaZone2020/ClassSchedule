import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { SPRING_LAYOUT } from "./motion";
import { cn } from "./utils";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Pill tab bar with a shared-layout indicator that glides between items
 * (beUI `tabs` pattern, trimmed to the horizontal pill variant).
 */
export function Tabs({ items, value, onChange, className }: TabsProps) {
  const reduce = useReducedMotion();
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "relative flex items-center gap-1 rounded-full border border-border bg-card/80 p-1 shadow-xs backdrop-blur",
        className
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium",
              "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
