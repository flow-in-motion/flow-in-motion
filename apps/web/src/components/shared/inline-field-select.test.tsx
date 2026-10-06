import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineFieldSelect } from "@/components/shared/inline-field-select";

describe("InlineFieldSelect", () => {
  it("restores the previous value and reports an unsuccessful update", async () => {
    const onError = vi.fn();

    render(
      <InlineFieldSelect
        value="Active"
        options={["Active", "Review"]}
        fieldLabel="status"
        itemLabel="Research paper"
        onChange={vi.fn().mockRejectedValue(new Error("Permission denied"))}
        onError={onError}
      />,
    );

    const field = screen.getByRole("combobox", {
      name: "Change status for Research paper",
    });
    fireEvent.click(field);
    fireEvent.click(screen.getByRole("option", { name: "Review" }));

    await waitFor(() => expect(field).toHaveTextContent("Active"));
    expect(onError).toHaveBeenCalledWith("Permission denied");
  });
});
