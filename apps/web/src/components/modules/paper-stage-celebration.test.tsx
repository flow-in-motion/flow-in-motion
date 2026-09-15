import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enteredSubmittedUnderReview,
  PaperStageCelebration,
} from "@/components/modules/paper-stage-celebration";

const confettiMock = vi.fn();

vi.mock("canvas-confetti", () => ({
  default: (...args: unknown[]) => confettiMock(...args),
}));

describe("enteredSubmittedUnderReview", () => {
  it("returns true only when entering the submitted stage", () => {
    expect(
      enteredSubmittedUnderReview(
        "Drafting, Writing & Revising",
        "Submitted, Under Review",
      ),
    ).toBe(true);

    expect(
      enteredSubmittedUnderReview(
        "Submitted, Under Review",
        "Submitted, Under Review",
      ),
    ).toBe(false);

    expect(
      enteredSubmittedUnderReview("Under review", "Published"),
    ).toBe(false);
  });
});

describe("PaperStageCelebration", () => {
  afterEach(() => {
    vi.useRealTimers();
    confettiMock.mockClear();
  });

  it("shows an accessible celebration and can be closed", () => {
    const onOpenChange = vi.fn();

    render(
      <PaperStageCelebration
        open
        onOpenChange={onOpenChange}
        paperTitle="Genome analysis"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Paper submitted — congratulations!",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Genome analysis");
    expect(confettiMock).toHaveBeenCalledOnce();

    fireEvent.click(
      screen.getByRole("button", { name: "Close celebration" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dismisses automatically", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();

    render(
      <PaperStageCelebration
        open
        onOpenChange={onOpenChange}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
