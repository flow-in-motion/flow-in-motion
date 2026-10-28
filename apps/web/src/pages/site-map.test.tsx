import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import SiteMapPage from "@/pages/site-map";
import { navGroups } from "@/config/nav-items";

describe("SiteMapPage", () => {
  it("goes back to the previous page", () => {
    render(
      <MemoryRouter initialEntries={["/settings", "/site-map"]} initialIndex={1}>
        <Routes>
          <Route path="/settings" element={<p>Settings page</p>} />
          <Route path="/site-map" element={<SiteMapPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });

  it("goes to Settings when opened directly", () => {
    render(
      <MemoryRouter initialEntries={["/site-map"]}>
        <Routes>
          <Route path="/settings" element={<p>Settings page</p>} />
          <Route path="/site-map" element={<SiteMapPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Settings page")).toBeInTheDocument();
  });

  it("links to every section from every nav group", () => {
    render(
      <MemoryRouter initialEntries={["/site-map"]}>
        <SiteMapPage />
      </MemoryRouter>,
    );

    for (const group of navGroups) {
      for (const item of group.items) {
        const link = screen.getByRole("link", { name: new RegExp(item.label) });
        expect(link).toHaveAttribute("href", item.to);
      }
    }
  });
});
