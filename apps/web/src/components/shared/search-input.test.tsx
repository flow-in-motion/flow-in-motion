import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SearchInput } from "@/components/shared/search-input";

function SearchInputFixture() {
  const [value, setValue] = useState("");
  return (
    <SearchInput
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClear={() => setValue("")}
      clearLabel="Clear project search"
      placeholder="Search projects…"
    />
  );
}

describe("SearchInput", () => {
  it("shows a clear button only while text is present and clears the input", () => {
    render(<SearchInputFixture />);

    const input = screen.getByPlaceholderText("Search projects…");
    expect(screen.queryByRole("button", { name: "Clear project search" })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "telco" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear project search" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear project search" })).not.toBeInTheDocument();
  });
});
