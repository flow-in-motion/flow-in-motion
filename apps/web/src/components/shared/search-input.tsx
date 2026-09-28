import { X } from "lucide-react";
import { useRef, type ChangeEventHandler } from "react";

import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<InputProps, "className" | "onChange" | "value"> {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear: () => void;
  clearLabel: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onClear,
  clearLabel,
  className,
  ...inputProps
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative w-full", className)}>
      <Input ref={inputRef} value={value} onChange={onChange} className="pr-9" {...inputProps} />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
