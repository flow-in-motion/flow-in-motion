import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountAuditPage from "@/pages/account-audit";
import { clearSessionListState } from "@/hooks/use-session-list-state";

vi.mock("@/api/hooks", () => ({
  useCurrentWorkspace: () => ({ data: { id: "workspace-1" } }),
  useMe: () => ({ data: { id: "user-owner" } }),
}));

beforeEach(() => {
  window.sessionStorage.clear();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountAuditPage />
    </MemoryRouter>,
  );
}

describe("AccountAuditPage session selections", () => {
  it("restores search and filters after returning", () => {
    const first = renderPage();

    fireEvent.change(screen.getByPlaceholderText("Search audit log…"), {
      target: { value: "security" },
    });

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter by event type" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Security" }));

    fireEvent.click(screen.getByRole("combobox", { name: "Filter by result" }));
    fireEvent.click(screen.getByRole("option", { name: "Blocked" }));

    first.unmount();
    renderPage();

    expect(screen.getByPlaceholderText("Search audit log…")).toHaveValue(
      "security",
    );
    expect(
      screen.getByRole("combobox", { name: "Filter by event type" }),
    ).toHaveTextContent("Security");
    expect(
      screen.getByRole("combobox", { name: "Filter by result" }),
    ).toHaveTextContent("Blocked");
  });

  it("resets search when session selections are cleared", () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText("Search audit log…"), {
      target: { value: "security" },
    });

    act(() => clearSessionListState());

    expect(screen.getByPlaceholderText("Search audit log…")).toHaveValue("");
  });
});
