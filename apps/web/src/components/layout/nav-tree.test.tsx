import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { navGroups } from "@/config/nav-items";
import { NavTree } from "@/components/layout/nav-tree";

describe("NavTree", () => {
  it("places Reviews/HDR examinations in Plan & review while preserving the existing route", () => {
    expect(navGroups.find((group) => group.label === "Plan & review")?.items).toContainEqual(expect.objectContaining({ label: "Reviews, HDR examinations", to: "/future/reviews-hdr-examinations" }));
    expect(navGroups.find((group) => group.label === "Future features")?.items.some((entry) => entry.label === "Reviews, HDR examinations")).toBe(false);
    render(<MemoryRouter><NavTree /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Reviews, HDR examinations" })).toHaveAttribute("href", "/future/reviews-hdr-examinations");
  });
  it("does not list Settings (moved to the account menu at the bottom of the sidebar)", () => {
    render(
      <MemoryRouter>
        <NavTree />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("keeps future feature links available behind a compact disclosure", () => {
    render(
      <MemoryRouter>
        <NavTree />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /Account Audit/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Export$/ })).toHaveAttribute(
      "href",
      "/export",
    );
    fireEvent.click(screen.getByRole("button", { name: "Future features" }));
    expect(screen.getAllByRole("link", { name: /^Export$/ })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Account Audit/ })).toHaveAttribute(
      "href",
      "/settings/account-audit",
    );
    expect(screen.getByRole("link", { name: /^Impact, Engagement$/ })).toHaveAttribute(
      "href",
      "/future/impact",
    );
  });
});
