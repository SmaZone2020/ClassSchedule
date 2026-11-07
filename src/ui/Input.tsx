import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import { cn } from "./utils";
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  fieldClassName?: string;
  /** `pill` for text, `box` for compact numeric fields. */
  shape?: "pill" | "box";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    value,
    onChange,
    leftIcon,
    rightIcon,
    className,
    fieldClassName,
    shape = "pill",
    disabled,
    id: idProp,
    ...rest
  },
  ref
) {
  const reactId = useId();
  const id = idProp ?? reactId;
  const [focused, setFocused] = useState(false);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="px-1 text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <div
        data-state={focused ? "focused" : "idle"}
        className={cn(
          "relative flex h-9 items-center border border-border bg-card transition-colors duration-200",
          shape === "pill" ? "rounded-full" : "rounded-lg",
          focused && "border-foreground/30 ring-2 ring-ring/25",
          disabled && "opacity-60",
          fieldClassName
        )}
      >
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground [&_svg]:size-4">
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          className={cn(
            "peer h-full w-full min-w-0 bg-transparent text-[13px] leading-6 text-foreground caret-foreground outline-none",
            "placeholder:text-muted-foreground/60",
            "[&::-webkit-calendar-picker-indicator]:opacity-55",
            leftIcon ? "pl-9" : "pl-3.5",
            rightIcon ? "pr-9" : "pr-3.5",
            disabled && "cursor-not-allowed",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
          {...rest}
        />
        {rightIcon ? (
          <span className="absolute right-3 flex items-center text-muted-foreground [&_svg]:size-4">
            {rightIcon}
          </span>
        ) : null}
      </div>
    </div>
  );
});
