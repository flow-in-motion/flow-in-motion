import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoadingState } from "@/components/shared/loading-state";
import { AppShellSkeleton, PageSkeleton } from "@/components/shared/page-skeleton";
import { ErrorState } from "@/components/shared/error-state";

describe("PageSkeleton", () => {
  it.each(["list", "detail", "dashboard", "canvas"] as const)(
    "announces what is loading for the %s layout and hides the placeholders",
    (layout) => {
      const { container } = render(<PageSkeleton title="Loading papers" layout={layout} />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("Loading papers");
      expect(status).toHaveAttribute("aria-busy", "true");
      expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it("is what LoadingState renders when given a page layout", () => {
    render(<LoadingState title="Loading projects" layout="list" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
    expect(
      screen.queryByText("Please wait while this information is prepared."),
    ).not.toBeInTheDocument();
  });

  it("keeps the small spinner card for panels", () => {
    render(<LoadingState title="Loading members" />);

    expect(
      screen.getByText("Please wait while this information is prepared."),
    ).toBeInTheDocument();
  });
});

describe("AppShellSkeleton", () => {
  it("renders the app frame even outside the theme provider", () => {
    render(<AppShellSkeleton title="Loading your account" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your account");
  });
});

describe("ErrorState", () => {
  it("shows the message as an alert with a retry button", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Papers could not be loaded"
        description="Failed to fetch"
        onRetry={onRetry}
        className="min-h-screen"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Papers could not be loaded");
    expect(alert).toHaveTextContent("Failed to fetch");
    // The sizing goes on the surrounding area, not the message card.
    expect(alert).not.toHaveClass("min-h-screen");
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
