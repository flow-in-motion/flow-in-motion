import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { RequireAuth } from "@/auth/require-auth";

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    isSessionExpired: true,
  }),
}));

function SessionExpiredDestination() {
  const location = useLocation();
  return <p>Session expired destination: {location.search}</p>;
}

describe("RequireAuth session expiry", () => {
  it("preserves the requested path when redirecting an expired session", () => {
    render(
      <MemoryRouter initialEntries={["/protected?view=recent"]}>
        <Routes>
          <Route
            path="session-expired"
            element={<SessionExpiredDestination />}
          />
          <Route element={<RequireAuth />}>
            <Route path="protected" element={<p>Protected content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "Session expired destination: ?returnTo=%2Fprotected%3Fview%3Drecent",
      ),
    ).toBeInTheDocument();
  });
});
