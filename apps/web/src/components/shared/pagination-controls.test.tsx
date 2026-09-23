import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaginationControls } from "./pagination-controls";

describe("PaginationControls", () => {
  it("keeps All selected as the total changes, including totals of 20", () => {
    const onPageSizeChange = vi.fn();
    const props = { page: 1, pageSize: 5000, totalPages: 1, onPageChange: vi.fn(), onPageSizeChange, selectedPageSize: "all" as const };
    const { rerender } = render(<PaginationControls {...props} totalItems={3} />);
    expect(screen.getByRole("combobox", { name: "Items per page" })).toHaveValue("all");
    rerender(<PaginationControls {...props} totalItems={20} />);
    expect(screen.getByRole("combobox", { name: "Items per page" })).toHaveValue("all");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    expect(onPageSizeChange).toHaveBeenLastCalledWith("all");
  });

  it("disables oversized All requests before they are sent", () => {
    render(<PaginationControls page={1} pageSize={20} totalItems={5001} totalPages={251} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "All (limit 5,000)" })).toBeDisabled();
  });

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
