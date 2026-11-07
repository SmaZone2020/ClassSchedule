import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/motion/select";
import { Field } from "./Field";

export interface ChoiceOption {
  value: string;
  label: string;
}

/**
 * A labelled beUI Select. Only composes the beUI parts; no styling of its own.
 */
export function Choice({
  label,
  value,
  onChange,
  options,
  placeholder
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
