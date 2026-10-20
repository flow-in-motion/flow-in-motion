import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CELEBRATION_DURATION_MS,
  CELEBRATION_VIDEO_SRC,
  enteredSubmittedUnderReview,
  PaperStageCelebration,
} from "@/components/modules/paper-stage-celebration";

const playMock = vi.fn(() => Promise.resolve());

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
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(playMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    playMock.mockClear();
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

    fireEvent.click(
      screen.getByRole("button", { name: "Close celebration" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("plays the fireworks video with sound by default", () => {
    render(<PaperStageCelebration open onOpenChange={vi.fn()} />);

    const video = screen.getByTestId("celebration-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", CELEBRATION_VIDEO_SRC);
    expect(video.muted).toBe(false);
    expect(playMock).toHaveBeenCalled();
  });

  it("dismisses automatically", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();

    render(<PaperStageCelebration open onOpenChange={onOpenChange} />);

    act(() => {
      vi.advanceTimersByTime(CELEBRATION_DURATION_MS - 1);
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes with the Escape key", () => {
    const onOpenChange = vi.fn();

    render(<PaperStageCelebration open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("mutes the video and remembers the choice", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PaperStageCelebration open onOpenChange={onOpenChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Mute celebration sound" }),
    );
    expect(
      (screen.getByTestId("celebration-video") as HTMLVideoElement).muted,
    ).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    unmount();
    render(<PaperStageCelebration open onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Unmute celebration sound" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      (screen.getByTestId("celebration-video") as HTMLVideoElement).muted,
    ).toBe(true);
  });

  it("skips the video when the user prefers reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("reduce"),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );

    render(<PaperStageCelebration open onOpenChange={vi.fn()} />);

    expect(screen.queryByTestId("celebration-video")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
