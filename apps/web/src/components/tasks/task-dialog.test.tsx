import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskDialog } from "@/components/tasks/task-dialog";

const hookMocks = vi.hoisted(() => ({
  useModules: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useModule: () => ({ data: undefined }),
  useModules: (
    tenantId: string,
    projectId?: string,
    page?: number,
    enabled?: boolean,
    options?: Record<string, unknown>,
  ) => {
    hookMocks.useModules(tenantId, projectId, page, enabled, options);
    return {
      data: {
        data:
          enabled && options?.search === "twenty fourth"
            ? [
                {
                  id: "paper-24",
                  displayId: "MOD-0024",
                  shortTitle: "Twenty fourth paper",
                  title: "Twenty fourth paper",
                },
              ]
            : [],
      },
      isFetching: false,
    };
  },
}));

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

  it("searches all papers before pagination and selects a result", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskDialog
        open
        onOpenChange={vi.fn()}
        tenantId="tenant-1"
        projects={[]}
        modules={[]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Paper" }));
    const paperSearch = screen.getByRole("combobox", { name: /^Paper/ });
    fireEvent.focus(paperSearch);
    fireEvent.change(paperSearch, {
      target: { value: "twenty fourth" },
    });

    expect(
      await screen.findByRole("option", { name: /Twenty fourth paper/ }),
    ).toBeInTheDocument();
    expect(hookMocks.useModules).toHaveBeenLastCalledWith(
      "tenant-1",
      undefined,
      1,
      true,
      { pageSize: "all", search: "twenty fourth" },
    );

    fireEvent.click(
      screen.getByRole("option", { name: /Twenty fourth paper/ }),
    );
    fireEvent.change(screen.getByLabelText(/Task title/), {
      target: { value: "Review paper" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Task" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          linkTarget: "module",
          moduleId: "paper-24",
        }),
      ),
    );
  });
});
