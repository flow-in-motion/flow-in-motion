import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type InlineFieldSelectProps = {
  value: string | null;
  options: readonly string[];
  fieldLabel: string;
  itemLabel: string;
  onChange: (value: string) => Promise<unknown>;
  onError?: (message: string) => void;
  valueClassName?: (value: string | null) => string;
  disabled?: boolean;
};

export function InlineFieldSelect({
  value,
  options,
  fieldLabel,
  itemLabel,
  onChange,
  onError,
  valueClassName,
  disabled = false,
}: InlineFieldSelectProps) {
  const [displayedValue, setDisplayedValue] = useState<string | null>(value);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayedValue(value);
  }, [value]);

  async function changeValue(nextValue: string) {
    if (nextValue === displayedValue || isSaving || disabled) return;

    const previousValue = displayedValue;
    setDisplayedValue(nextValue);
    setIsSaving(true);

    try {
      await onChange(nextValue);
    } catch (error) {
      setDisplayedValue(previousValue);
      onError?.(
        error instanceof Error ? error.message : `The ${fieldLabel} could not be updated.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Select
      value={displayedValue ?? undefined}
      onValueChange={(nextValue) => void changeValue(nextValue)}
      disabled={disabled || isSaving}
    >
      <SelectTrigger
        aria-label={`Change ${fieldLabel} for ${itemLabel}`}
        aria-busy={isSaving}
        className={cn(
          "h-8 min-w-0 px-2 text-xs font-medium",
          valueClassName?.(displayedValue),
        )}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
