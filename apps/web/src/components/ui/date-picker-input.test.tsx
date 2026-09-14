import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { DatePickerInput } from "@/components/ui/date-picker-input";

function TestDatePicker({ allowTyped }: { allowTyped?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <DatePickerInput id="test-date" label="Test date" value={value} onChange={setValue} allowTyped={allowTyped} />
  );
}

describe("DatePickerInput", () => {
  it("displays a picked date as DD/MM/YYYY and allows it to be cleared", () => {
    const { container } = render(<TestDatePicker />);
    const nativeDateInput = container.querySelector<HTMLInputElement>('input[type="date"]');

    expect(nativeDateInput).not.toBeNull();
    fireEvent.change(nativeDateInput!, { target: { value: "2026-08-05" } });

    expect(screen.getByRole("textbox")).toHaveValue("05/08/2026");

    fireEvent.click(screen.getByRole("button", { name: "Clear test date" }));

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("accepts a typed DD/MM/YYYY date by default", () => {
    render(<TestDatePicker />);
    const textbox = screen.getByRole("textbox");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("readonly");

    expect(textbox).not.toHaveAttribute("readonly");

    fireEvent.change(textbox, { target: { value: "05/08/2026" } });

    expect(textbox).toHaveValue("05/08/2026");
    const nativeDateInput = document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(nativeDateInput!.value).toBe("2026-08-05");
  });

  it("reverts an unparsable typed date back to the last valid value on blur", () => {
    render(<TestDatePicker />);
    const textbox = screen.getByRole("textbox");

    fireEvent.change(textbox, { target: { value: "05/08/2026" } });
    fireEvent.change(textbox, { target: { value: "05/08/20" } });
    fireEvent.blur(textbox);

    expect(textbox).toHaveValue("05/08/2026");
  });
});
