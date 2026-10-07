import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackDialog } from "./feedback-dialog";

const mocks = vi.hoisted(() => ({
  createFeedback: vi.fn(),
}));

vi.mock("@/api/hooks", () => ({
  useCreateFeedback: () => ({
    mutateAsync: mocks.createFeedback,
    isPending: false,
  }),
}));

describe("FeedbackDialog", () => {
  beforeEach(() => {
    mocks.createFeedback.mockReset();
  });

  it("submits the message and optional rating", async () => {
    mocks.createFeedback.mockResolvedValue({
      id: "feedback-1",
    });

    render(
      <FeedbackDialog
        open
        tenantId="tenant-1"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("What were you trying to do?"), {
      target: {
        value: "The project workflow is easy to understand.",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rate 5 out of 5",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Send feedback",
      }),
    );

    await waitFor(() => {
      expect(mocks.createFeedback).toHaveBeenCalledWith({
        message: "The project workflow is easy to understand.",
        rating: 5,
        screenshotDataUrl: undefined,
      });
    });

    expect(
      screen.getByText("Thank you for your feedback"),
    ).toBeInTheDocument();
  });

  it("fills the first three stars when rating 3 is selected", () => {
    render(
      <FeedbackDialog
        open
        tenantId="tenant-1"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rate 3 out of 5" }));

    const stars = [1, 2, 3, 4, 5].map((value) =>
      screen.getByRole("button", { name: `Rate ${value} out of 5` }).querySelector("svg"),
    );

    expect(stars[0]).toHaveClass("fill-amber-400");
    expect(stars[1]).toHaveClass("fill-amber-400");
    expect(stars[2]).toHaveClass("fill-amber-400");
    expect(stars[3]).not.toHaveClass("fill-amber-400");
    expect(stars[4]).not.toHaveClass("fill-amber-400");
  });

  it("shows an error when submission fails", async () => {
    mocks.createFeedback.mockRejectedValue(
      new Error("Feedback service unavailable"),
    );

    render(
      <FeedbackDialog
        open
        tenantId="tenant-1"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("What were you trying to do?"), {
      target: {
        value: "Please improve the dashboard loading time.",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Send feedback",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Feedback service unavailable");
  });

  it("shows a pre-captured screenshot and includes it on submit", async () => {
    mocks.createFeedback.mockResolvedValue({ id: "feedback-2" });

    render(
      <FeedbackDialog
        open
        tenantId="tenant-1"
        initialScreenshotDataUrl="data:image/jpeg;base64,abc123"
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      screen.getByAltText("Screenshot of the current page"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What were you trying to do?"), {
      target: { value: "Trying to export a report." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Send feedback" }),
    );

    await waitFor(() => {
      expect(mocks.createFeedback).toHaveBeenCalledWith({
        message: "Trying to export a report.",
        rating: undefined,
        screenshotDataUrl: "data:image/jpeg;base64,abc123",
      });
    });
  });

  it("lets the person remove the pre-captured screenshot before submitting", async () => {
    mocks.createFeedback.mockResolvedValue({ id: "feedback-3" });

    render(
      <FeedbackDialog
        open
        tenantId="tenant-1"
        initialScreenshotDataUrl="data:image/jpeg;base64,abc123"
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot" }));

    expect(
      screen.queryByAltText("Screenshot of the current page"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What were you trying to do?"), {
      target: { value: "Trying to export a report." },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Send feedback" }),
    );

    await waitFor(() => {
      expect(mocks.createFeedback).toHaveBeenCalledWith({
        message: "Trying to export a report.",
        rating: undefined,
        screenshotDataUrl: undefined,
      });
    });
  });
});
