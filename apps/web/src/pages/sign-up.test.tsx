import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignUpPage from "@/pages/sign-up";

const signUpWithPassword = vi.fn();

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({
    error: null,
    isLoading: false,
    signUpWithPassword,
  }),
}));

beforeEach(() => {
  signUpWithPassword.mockReset();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SignUpPage />
    </MemoryRouter>,
  );
}

function fillForm(password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "new.user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignUpPage", () => {
  it("does not submit passwords that do not match", () => {
    renderPage();
    fillForm("a-secure-password", "a-different-password");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passwords do not match.",
    );
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });

  it("creates an account and explains email confirmation", async () => {
    signUpWithPassword.mockResolvedValue({ requiresEmailConfirmation: true });
    renderPage();
    fillForm("a-secure-password", "a-secure-password");

    await waitFor(() =>
      expect(signUpWithPassword).toHaveBeenCalledWith(
        "new.user@example.com",
        "a-secure-password",
        "/",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("new.user@example.com", { exact: false }),
    ).toBeInTheDocument();
  });
});
