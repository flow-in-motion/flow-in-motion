import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TagInput } from "./tag-input";

describe("TagInput", () => {
  it("keeps a comma as part of the name instead of adding the entry", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="" onChange={onChange} placeholder="Add a journal" />);

    const input = screen.getByPlaceholderText("Add a journal");
    fireEvent.change(input, { target: { value: "Accounting, Organizations and Society" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("Accounting, Organizations and Society");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Accounting, Organizations and Society");
  });

  it("renders each semicolon-separated entry from the stored value as its own chip", () => {
    render(
      <TagInput
        id="journals"
        value="Nature; Accounting, Organizations and Society"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Nature")).toBeInTheDocument();
    expect(screen.getByText("Accounting, Organizations and Society")).toBeInTheDocument();
    expect(screen.queryByText("Accounting")).not.toBeInTheDocument();
  });

  it("adds the in-progress entry when leaving the field", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature" onChange={onChange} />);

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Journal of Finance, Economics" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith("Nature; Journal of Finance, Economics");
  });

  it("commits the in-progress entry on Enter", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature" onChange={onChange} />);

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Cell" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("Nature; Cell");
  });

  it("removes a tag via its remove button", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature; Cell" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Nature" }));

    expect(onChange).toHaveBeenCalledWith("Cell");
  });

  it("removes the last tag on Backspace when the draft is empty", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature; Cell" onChange={onChange} />);

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith("Nature");
  });

  it("filters remembered suggestions and adds one without preventing new entries", () => {
    const onChange = vi.fn();
    render(
      <TagInput
        id="journals"
        value="Nature"
        onChange={onChange}
        suggestions={["Nature", "Cell", "PLOS ONE"]}
      />,
    );

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "cell" } });

    expect(screen.queryByRole("option", { name: "Nature" })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("option", { name: "Cell" }));
    fireEvent.click(screen.getByRole("option", { name: "Cell" }));

    expect(onChange).toHaveBeenCalledWith("Nature; Cell");
  });
  it("shows remembered names on focus without typing", () => {
    render(
      <TagInput
        id="target-venues"
        value=""
        onChange={vi.fn()}
        suggestions={["Nature Communications", "Cell"]}
      />,
    );

    fireEvent.focus(screen.getByRole("combobox"));

    expect(
      screen.getByRole("option", { name: "Nature Communications" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("option", { name: "Cell" }),
    ).toBeInTheDocument();
  });
});
