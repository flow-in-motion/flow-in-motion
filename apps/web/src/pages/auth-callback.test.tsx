import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthCallbackPage from "@/pages/auth-callback";

const confirmEmail = vi.fn();
const updatePassword = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  confirmEmail.mockReset().mockResolvedValue(undefined);
  updatePassword.mockReset().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    error: null,
    isLoading: false,
    isAuthenticated: false,
    confirmEmail,
    updatePassword,
  });
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<p>Workspace home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthCallbackPage", () => {
  it("verifies a recovery link's token_hash through supabase-js instead of relying on a raw Supabase redirect", async () => {
    renderPage("/auth/callback?token_hash=def456&type=recovery");

    await waitFor(() =>
      expect(confirmEmail).toHaveBeenCalledWith("def456", "recovery"),
    );
  });

  it("verifies an invitation link's token_hash with the invite OTP type", async () => {
    renderPage("/auth/callback?token_hash=inv789&type=invite");

    await waitFor(() =>
      expect(confirmEmail).toHaveBeenCalledWith("inv789", "invite"),
    );
  });

  it("does nothing when the link carries no token_hash, deferring to detectSessionInUrl", () => {
    renderPage("/auth/callback?code=some-pkce-code");

    expect(confirmEmail).not.toHaveBeenCalled();
  });

  it("does nothing when a token_hash is present without a type", () => {
    renderPage("/auth/callback?token_hash=def456");

    expect(confirmEmail).not.toHaveBeenCalled();
  });

  it("shows the sign-in-failed state when verification errors", () => {
    mockUseAuth.mockReturnValue({
      error: new Error("This link has already been used."),
      isLoading: false,
      isAuthenticated: false,
      confirmEmail,
      updatePassword,
    });

    renderPage("/auth/callback?token_hash=def456&type=recovery");

    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    expect(
      screen.getByText("This link has already been used."),
    ).toBeInTheDocument();
  });

  it("lets a verified user choose a new password and continues into the app", async () => {
    mockUseAuth.mockReturnValue({
      error: null,
      isLoading: false,
      isAuthenticated: true,
      confirmEmail,
      updatePassword,
    });

    renderPage("/auth/callback?token_hash=def456&type=recovery");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-strong-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save password and continue" }),
    );

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith("a-strong-password"),
    );
    await waitFor(() =>
      expect(screen.getByText("Workspace home")).toBeInTheDocument(),
    );
  });
});
