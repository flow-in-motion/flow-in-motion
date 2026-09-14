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

    fireEvent.change(screen.getByLabelText("Feedback"), {
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
      });
    });

    expect(
      screen.getByText("Thank you for your feedback"),
    ).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("Feedback"), {
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
});
