import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TagInput } from "./tag-input";

describe("TagInput", () => {
  it("commits an entry as a separate tag when a comma is typed", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="" onChange={onChange} placeholder="Add a journal" />);

    const input = screen.getByPlaceholderText("Add a journal");
    fireEvent.change(input, { target: { value: "Nature," } });

    expect(onChange).toHaveBeenCalledWith("Nature");
  });

  it("renders each comma-separated entry from the stored value as its own chip", () => {
    render(<TagInput id="journals" value="Nature, Cell" onChange={vi.fn()} />);

    expect(screen.getByText("Nature")).toBeInTheDocument();
    expect(screen.getByText("Cell")).toBeInTheDocument();
  });

  it("commits the in-progress entry on Enter", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature" onChange={onChange} />);

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Cell" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("Nature, Cell");
  });

  it("removes a tag via its remove button", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature, Cell" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Nature" }));

    expect(onChange).toHaveBeenCalledWith("Cell");
  });

  it("removes the last tag on Backspace when the draft is empty", () => {
    const onChange = vi.fn();
    render(<TagInput id="journals" value="Nature, Cell" onChange={onChange} />);

    const input = document.getElementById("journals") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith("Nature");
  });
});
