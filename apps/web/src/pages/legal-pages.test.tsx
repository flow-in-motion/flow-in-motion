import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";

describe("TermsPage", () => {
  it("renders the terms of service", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.queryByText(/has not been reviewed by a lawyer/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "5. Usage data and monitoring" }),
    ).toBeInTheDocument();
  });
});

describe("PrivacyPage", () => {
  it("renders the privacy policy", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getAllByText(/14 days/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/lists each member by name and email address/),
    ).toBeInTheDocument();
  });
});
