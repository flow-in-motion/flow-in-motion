import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CELEBRATION_DURATION_MS,
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
    window.localStorage.clear();
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
    expect(confettiMock).toHaveBeenCalled();

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
      vi.advanceTimersByTime(CELEBRATION_DURATION_MS - 1);
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fires follow-up confetti bursts after the first one", () => {
    vi.useFakeTimers();

    render(<PaperStageCelebration open onOpenChange={vi.fn()} />);

    expect(confettiMock).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(confettiMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("closes with the Escape key", () => {
    const onOpenChange = vi.fn();

    render(<PaperStageCelebration open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("remembers when the sound is muted", () => {
    const { unmount } = render(
      <PaperStageCelebration open onOpenChange={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Mute celebration sound" }),
    );
    expect(
      screen.getByRole("button", { name: "Unmute celebration sound" }),
    ).toHaveAttribute("aria-pressed", "true");

    unmount();
    render(<PaperStageCelebration open onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Unmute celebration sound" }),
    ).toBeInTheDocument();
  });
});
