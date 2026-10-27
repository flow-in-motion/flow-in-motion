import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardResizeHandle } from "./dashboard-resize-handle";

function rectangle(width: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 200,
    width,
    height: 200,
    toJSON: () => ({}),
  };
}

function pointer(
  element: HTMLElement,
  type: string,
  clientX: number,
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperties(event, {
    pointerId: { value: 1 },
    button: { value: 0 },
    clientX: { value: clientX },
  });

  fireEvent(element, event);
}

function setup() {
  const onPreview = vi.fn();
  const onCommit = vi.fn();

  render(
    <div data-testid="container" style={{ columnGap: "16px" }}>
      <div data-testid="widget">
        <DashboardResizeHandle
          label="Pipeline"
          width={50}
          onPreview={onPreview}
          onCommit={onCommit}
        />
      </div>
    </div>,
  );

  vi.spyOn(
    screen.getByTestId("container"),
    "getBoundingClientRect",
  ).mockReturnValue(rectangle(1000));

  vi.spyOn(
    screen.getByTestId("widget"),
    "getBoundingClientRect",
  ).mockReturnValue(rectangle(492));

  const handle = screen.getByRole("slider", {
    name: "Resize Pipeline",
  });

  Object.defineProperties(handle, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn().mockReturnValue(true) },
    releasePointerCapture: { value: vi.fn() },
  });

  return { handle, onPreview, onCommit };
}

describe("DashboardResizeHandle", () => {
  it("previews dragging and saves only when released", () => {
    const { handle, onPreview, onCommit } = setup();

    pointer(handle, "pointerdown", 492);
    pointer(handle, "pointermove", 644);

    expect(onPreview).toHaveBeenLastCalledWith(65);
    expect(onCommit).not.toHaveBeenCalled();

    pointer(handle, "pointerup", 644);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(65);
  });

  it.each([
    [-1000, 25],
    [2000, 100],
  ])("limits dragging to the allowed range", (position, expected) => {
    const { handle, onCommit } = setup();

    pointer(handle, "pointerdown", 492);
    pointer(handle, "pointermove", position);
    pointer(handle, "pointerup", position);

    expect(onCommit).toHaveBeenCalledWith(expected);
  });

  it("discards the preview when a pointer gesture is cancelled", () => {
    const { handle, onPreview, onCommit } = setup();

    pointer(handle, "pointerdown", 492);
    pointer(handle, "pointermove", 644);
    pointer(handle, "pointercancel", 644);

    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("cancels an active drag with Escape", () => {
    const { handle, onPreview, onCommit } = setup();

    pointer(handle, "pointerdown", 492);
    pointer(handle, "pointermove", 644);
    fireEvent.keyDown(handle, { key: "Escape" });
    pointer(handle, "pointerup", 644);

    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("supports keyboard resizing", () => {
    const { handle, onCommit } = setup();

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenLastCalledWith(55);

    fireEvent.keyDown(handle, {
      key: "ArrowLeft",
      shiftKey: true,
    });
    expect(onCommit).toHaveBeenLastCalledWith(49);

    fireEvent.keyDown(handle, { key: "Home" });
    expect(onCommit).toHaveBeenLastCalledWith(25);

    fireEvent.keyDown(handle, { key: "End" });
    expect(onCommit).toHaveBeenLastCalledWith(100);
  });
});
