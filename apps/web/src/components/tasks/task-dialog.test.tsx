import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskDialog } from "@/components/tasks/task-dialog";

describe("TaskDialog", () => {
  it("shows an error and keeps the dialog open when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Task limit reached"));
    const onOpenChange = vi.fn();

    render(
      <TaskDialog
        open
        onOpenChange={onOpenChange}
        tenantId="tenant-1"
        projects={[]}
        modules={[]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Task title/), {
      target: { value: "Calibrate sensors" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(await screen.findByText("Task limit reached")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/Task title/)).toHaveValue("Calibrate sensors");
  });

  it("closes after a successful save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <TaskDialog
        open
        onOpenChange={onOpenChange}
        tenantId="tenant-1"
        projects={[]}
        modules={[]}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Task title/), {
      target: { value: "Calibrate sensors" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
