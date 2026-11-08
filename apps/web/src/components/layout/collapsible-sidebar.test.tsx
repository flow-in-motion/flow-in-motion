import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CollapsibleSidebar } from "./collapsible-sidebar";
function Menu({ name }: { name: string }) {
  const [value, setValue] = useState("");
  return (
    <nav aria-label={name}>
      <Link to="/projects">Projects</Link>
      <input
        aria-label="Menu state"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </nav>
  );
}
vi.mock("./sidebar", () => ({ Sidebar: () => <Menu name="Full menu" /> }));
vi.mock("./compact-sidebar", () => ({
  CompactSidebar: () => <Menu name="Compact menu" />,
}));
function Location() {
  return <p>Route: {useLocation().pathname}</p>;
}
describe("Left menu expand/close", () => {
  it.each([false, true])(
    "closes and reopens the %s compact menu without losing navigation or state",
    (compact) => {
      render(
        <MemoryRouter>
          <CollapsibleSidebar compact={compact} />
          <Location />
        </MemoryRouter>,
      );
      const label = compact ? "Compact menu" : "Full menu";
      const toggle = screen.getByRole("button", { name: "Close menu" });
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      fireEvent.change(screen.getByLabelText("Menu state"), {
        target: { value: "Kept" },
      });
      fireEvent.click(screen.getByRole("link", { name: "Projects" }));
      expect(screen.getByText("Route: /projects")).toBeInTheDocument();
      toggle.focus();
      fireEvent.click(toggle);
      expect(
        screen.queryByRole("navigation", { name: label }),
      ).not.toBeInTheDocument();
      const reopen = screen.getByRole("button", { name: "Expand menu" });
      expect(reopen).toHaveAttribute("aria-expanded", "false");
      expect(reopen).toHaveFocus();
      fireEvent.click(reopen);
      expect(screen.getByRole("navigation", { name: label })).toBeVisible();
      expect(screen.getByLabelText("Menu state")).toHaveValue("Kept");
      expect(screen.getByText("Route: /projects")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();
    },
  );
});
