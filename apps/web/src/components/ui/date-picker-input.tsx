import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface DatePickerInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Lets the user type a DD/MM/YYYY date directly, instead of only picking one from the calendar. */
  allowTyped?: boolean;
}

function formatDisplayDate(iso: string) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isRealDate =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);
  return isRealDate ? `${year}-${month}-${day}` : null;
}

export function DatePickerInput({
  id,
  label,
  value,
  onChange,
  allowTyped = true,
}: DatePickerInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [typedText, setTypedText] = useState(formatDisplayDate(value));

  useEffect(() => {
    setTypedText(formatDisplayDate(value));
  }, [value]);

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;

    try {
      picker.showPicker();
    } catch {
      picker.click();
    }
  }

  function handleTypedChange(next: string) {
    setTypedText(next);
    if (next.trim() === "") {
      onChange("");
      return;
    }
    const iso = parseDisplayDate(next);
    if (iso) onChange(iso);
  }

  function handleTypedBlur() {
    if (parseDisplayDate(typedText) === null && typedText.trim() !== "") {
      setTypedText(formatDisplayDate(value));
    }
  }

  return (
    <div className="relative">
      {allowTyped ? (
        <Input
          id={id}
          type="text"
          value={typedText}
          placeholder="DD/MM/YYYY"
          onChange={(event) => handleTypedChange(event.target.value)}
          onBlur={handleTypedBlur}
          className="pr-16 tabular-nums"
        />
      ) : (
        <Input
          id={id}
          type="text"
          inputMode="none"
          value={formatDisplayDate(value)}
          placeholder="DD/MM/YYYY"
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          readOnly
          className="cursor-pointer pr-16 tabular-nums"
        />
      )}

      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-8 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={openPicker}
        aria-label={`Choose ${label.toLowerCase()}`}
        className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      <input
        ref={pickerRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </div>
  );
}
