import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("shows the current item range and changes pages", () => {
    const onPageChange = vi.fn();

    render(
      <PaginationControls
        page={2}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText("Showing 21–40 of 45")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables navigation at the first and last pages", () => {
    const { rerender } = render(
      <PaginationControls
        page={1}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    rerender(
      <PaginationControls
        page={3}
        pageSize={20}
        totalItems={45}
        totalPages={3}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("does not render when there are no items", () => {
    const { container } = render(
      <PaginationControls
        page={1}
        pageSize={20}
        totalItems={0}
        totalPages={0}
        onPageChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});