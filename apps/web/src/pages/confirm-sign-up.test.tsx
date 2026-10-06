import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConfirmSignUpPage from "@/pages/confirm-sign-up";

const confirmEmail = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
  confirmEmail.mockReset().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    error: null,
    isLoading: false,
    isAuthenticated: false,
    confirmEmail,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/confirm" element={<ConfirmSignUpPage />} />
        <Route path="/" element={<p>Workspace home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConfirmSignUpPage", () => {
  it("verifies the token_hash from the link instead of trusting an already-set session", async () => {
    renderPage("/auth/confirm?token_hash=abc123&type=signup&returnTo=%2Fprojects");

    await waitFor(() =>
      expect(confirmEmail).toHaveBeenCalledWith("abc123", "signup"),
    );
  });

  it("defaults to the signup OTP type when the link omits it", async () => {
    renderPage("/auth/confirm?token_hash=abc123");

    await waitFor(() =>
      expect(confirmEmail).toHaveBeenCalledWith("abc123", "signup"),
    );
  });

  it("does nothing when there is no token_hash to verify", () => {
    renderPage("/auth/confirm");

    expect(confirmEmail).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Confirming your email…" }),
    ).toBeInTheDocument();
  });

  it("only attempts verification once even if the page re-renders", async () => {
    renderPage("/auth/confirm?token_hash=abc123&type=signup");

    await waitFor(() => expect(confirmEmail).toHaveBeenCalledTimes(1));
  });

  it("shows the confirmation-failed state when verification errors", () => {
    mockUseAuth.mockReturnValue({
      error: new Error("This link has expired."),
      isLoading: false,
      isAuthenticated: false,
      confirmEmail,
    });

    renderPage("/auth/confirm?token_hash=abc123&type=signup");

    expect(
      screen.getByRole("heading", { name: "Confirmation failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("This link has expired.")).toBeInTheDocument();
  });

  it("redirects to the safe return path once authenticated", () => {
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({
      error: null,
      isLoading: false,
      isAuthenticated: true,
      confirmEmail,
    });

    renderPage("/auth/confirm?token_hash=abc123&type=signup&returnTo=%2F");

    expect(
      screen.getByRole("heading", { name: "Email confirmed" }),
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(900));

    expect(screen.getByText("Workspace home")).toBeInTheDocument();
  });
});
