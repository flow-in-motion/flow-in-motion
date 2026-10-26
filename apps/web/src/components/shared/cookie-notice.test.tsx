import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { CookieNotice } from "@/components/shared/cookie-notice";

describe("CookieNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the notice on first visit and hides it once dismissed", () => {
    const { unmount } = render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );

    expect(screen.getByText(/only necessary storage/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/only necessary storage/)).not.toBeInTheDocument();

    unmount();
    render(
      <MemoryRouter>
        <CookieNotice />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/only necessary storage/)).not.toBeInTheDocument();
  });
});
