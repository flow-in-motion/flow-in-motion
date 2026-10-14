import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { RequireApiSession } from "@/auth/require-api-session";

const hooks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useCurrentWorkspace: vi.fn(),
}));

vi.mock("@/api/hooks", () => hooks);

describe("RequireApiSession", () => {
  it("starts loading the workspace while the account is still loading", () => {
    hooks.useMe.mockReturnValue({ isPending: true });
    hooks.useCurrentWorkspace.mockReturnValue({ isPending: true });

    render(
      <MemoryRouter>
        <Routes>
          <Route element={<RequireApiSession />}>
            <Route index element={<p>Dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading your account")).toBeInTheDocument();
    expect(hooks.useCurrentWorkspace).toHaveBeenCalled();
  });
});
