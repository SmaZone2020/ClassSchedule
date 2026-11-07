import { ArrowChevronDown } from "@gravity-ui/icons";
import { useId, type ReactNode } from "react";
import { cn } from "./utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  icon?: ReactNode;
}

/**
 * Native `<select>` under a styled shell. A real select keeps the OS popup,
 * keyboard behaviour and IME support that a hand-rolled listbox would lose.
 */
export function Select({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
  id: idProp,
  "aria-label": ariaLabel,
  icon
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="px-1 text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          "relative flex h-9 items-center rounded-full border border-border bg-card",
          "transition-colors focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/25",
          disabled && "opacity-60"
        )}
      >
        {icon ? (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent text-[13px] text-foreground outline-none",
            icon ? "pl-9" : "pl-3.5",
            "pr-8"
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ArrowChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}
