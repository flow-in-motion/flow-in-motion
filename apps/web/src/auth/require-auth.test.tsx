import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { RequireAuth } from "@/auth/require-auth";

const mockUseAuth = vi.fn();

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderAtRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/sign-in" element={<div>Sign in page</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("redirects unauthenticated users to /sign-in", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    renderAtRoute("/protected");

    expect(screen.getByText("Sign in page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content for authenticated users", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });

    renderAtRoute("/protected");

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByText("Sign in page")).not.toBeInTheDocument();
  });

  it("shows a loading state while auth is initializing", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });

    renderAtRoute("/protected");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
