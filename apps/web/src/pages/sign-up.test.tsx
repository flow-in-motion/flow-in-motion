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
  it("rejects a seven-character password before calling auth", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Ab3!xyZ" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Ab3!xyZ" },
    });

    fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use at least 8 characters for your password.",
    );
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });

  it("does not submit passwords that do not match", () => {
    renderPage();
    fillForm("a-secure-password", "a-different-password");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passwords do not match.",
    );
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });

  it.each(["Ab3!xyZ9", "a-secure-password"])(
    "creates an account with an eight-character or longer password: %s",
    async (password) => {
      signUpWithPassword.mockResolvedValue({
        requiresEmailConfirmation: true,
      });
      renderPage();

      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "minlength",
        "8",
      );
      expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
        "minlength",
        "8",
      );

      fillForm(password, password);

      await waitFor(() =>
        expect(signUpWithPassword).toHaveBeenCalledWith(
          "new.user@example.com",
          password,
          "/",
        ),
      );

      expect(
        await screen.findByRole("heading", { name: "Check your email" }),
      ).toBeInTheDocument();
    },
  );
});
