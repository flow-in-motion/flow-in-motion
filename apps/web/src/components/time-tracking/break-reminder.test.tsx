import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiTimer } from "@/api/time-tracking";
import { getBreakState, resetBreakState, setBreakState } from "@/lib/break-state";
import { playChime } from "@/lib/chime";
import { timeTrackingState } from "@/test/time-tracking-mock";

import { BreakReminder } from "./break-reminder";
import { BreakReminderSettingsCard } from "./break-reminder-settings";
import { RunningTimerBar } from "./running-timer-bar";

vi.mock("@/api/time-tracking", () => import("@/test/time-tracking-mock"));
vi.mock("@/lib/chime", () => ({ playChime: vi.fn(), primeChime: vi.fn() }));

const MINUTE = 60_000;
const NOW = new Date("2026-10-28T01:00:00.000Z").getTime();

function timer(overrides: Partial<ApiTimer> = {}): ApiTimer {
  return {
    id: "entry-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    taskTitle: "Literature review",
    taskDisplayId: "TSK-0001",
    startedAt: new Date(NOW - 60 * MINUTE).toISOString(),
    isOpen: true,
    isRunning: true,
    durationSeconds: 0,
    runningSeconds: 0,
    elapsedSeconds: 0,
    ...overrides,
  };
}

function showTimer(value: ApiTimer | null) {
  timeTrackingState.current = { timer: value, receivedAt: Date.now() };
}

beforeEach(() => {
  timeTrackingState.pauseTimer = vi.fn().mockResolvedValue({ timer: null });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetBreakState();
  timeTrackingState.breakReminders = {
    enabled: true,
    workMinutes: 50,
    breakMinutes: 10,
    notifications: false,
    sound: true,
  };
  vi.mocked(playChime).mockClear();
  showTimer(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("BreakReminder", () => {
  it("stays quiet before the chosen time", () => {
    showTimer(timer({ runningSeconds: 20 * 60 }));
    render(<BreakReminder />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reminds after the chosen time of work, and can be snoozed", () => {
    showTimer(timer({ runningSeconds: 52 * 60 }));
    const { rerender } = render(<BreakReminder />);

    const dialog = screen.getByRole("dialog", { name: "Time for a break" });
    expect(dialog).toHaveTextContent(
      "You've been working for 52m on “Literature review”",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Snooze 10 minutes" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getBreakState().snoozeUntil).toBe(NOW + 10 * MINUTE);

    vi.setSystemTime(NOW + 10 * MINUTE);
    rerender(<BreakReminder />);
    expect(screen.getByRole("dialog", { name: "Time for a break" })).toBeInTheDocument();
  });

  it("pauses the timer for a break of the chosen length", async () => {
    showTimer(timer({ runningSeconds: 50 * 60 }));
    timeTrackingState.pauseTimer = vi.fn(async () => {
      showTimer(timer({ isRunning: false, durationSeconds: 50 * 60 }));
      return { timer: timeTrackingState.current.timer };
    });
    const { rerender } = render(<BreakReminder />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Take a 10-minute break" }),
      );
    });
    rerender(<BreakReminder />);

    expect(timeTrackingState.pauseTimer).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getBreakState()).toEqual(
      expect.objectContaining({
        breakEndsAt: NOW + 10 * MINUTE,
        streakStart: null,
      }),
    );
  });

  it("chimes once when the reminder pops up", () => {
    showTimer(timer({ runningSeconds: 50 * 60 }));
    const { rerender } = render(<BreakReminder />);
    rerender(<BreakReminder />);
    rerender(<BreakReminder />);

    expect(playChime).toHaveBeenCalledTimes(1);
    expect(playChime).toHaveBeenCalledWith("reminder");
  });

  it("stays silent when the sound is turned off", () => {
    timeTrackingState.breakReminders.sound = false;
    showTimer(timer({ runningSeconds: 50 * 60 }));
    render(<BreakReminder />);

    expect(screen.getByRole("dialog", { name: "Time for a break" })).toBeInTheDocument();
    expect(playChime).not.toHaveBeenCalled();
  });

  it("chimes when a break is over", () => {
    showTimer(timer({ isRunning: false, durationSeconds: 3000 }));
    setBreakState({ breakEndsAt: NOW - 1, lastSeenRunningAt: NOW - 11 * MINUTE });
    const { rerender } = render(<BreakReminder />);
    rerender(<BreakReminder />);

    expect(playChime).toHaveBeenCalledTimes(1);
    expect(playChime).toHaveBeenCalledWith("break-over");
  });

  it("doesn't remind when reminders are turned off", () => {
    timeTrackingState.breakReminders.enabled = false;
    showTimer(timer({ runningSeconds: 120 * 60 }));
    render(<BreakReminder />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("notifies when another app is in front, even though the tab is showing", () => {
    const shown: string[] = [];
    class FakeNotification {
      static permission = "granted";
      onclick: (() => void) | null = null;
      constructor(title: string) {
        shown.push(title);
      }
      close() {}
    }
    vi.stubGlobal("Notification", FakeNotification);
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    timeTrackingState.breakReminders.notifications = true;
    showTimer(timer({ runningSeconds: 50 * 60 }));

    render(<BreakReminder />);

    expect(shown).toEqual(["Time for a break"]);
    hasFocus.mockRestore();
  });

  it("doesn't send a notification while the app is in front", () => {
    const shown: string[] = [];
    class FakeNotification {
      static permission = "granted";
      onclick: (() => void) | null = null;
      constructor(title: string) {
        shown.push(title);
      }
      close() {}
    }
    vi.stubGlobal("Notification", FakeNotification);
    const hasFocus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    timeTrackingState.breakReminders.notifications = true;
    showTimer(timer({ runningSeconds: 50 * 60 }));

    render(<BreakReminder />);

    expect(screen.getByRole("dialog", { name: "Time for a break" })).toBeInTheDocument();
    expect(shown).toEqual([]);
    hasFocus.mockRestore();
  });

  it("shows a system notification when the app is in the background", () => {
    const shown: Array<{ title: string; body?: string }> = [];
    class FakeNotification {
      static permission = "granted";
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        shown.push({ title, body: options?.body });
      }
      close() {}
    }
    vi.stubGlobal("Notification", FakeNotification);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    timeTrackingState.breakReminders.notifications = true;
    showTimer(timer({ runningSeconds: 50 * 60 }));

    const { rerender } = render(<BreakReminder />);
    rerender(<BreakReminder />);

    expect(shown).toEqual([
      {
        title: "Time for a break",
        body: "You've been working for 50m. Step away for 10 minutes.",
      },
    ]);
  });
});

describe("RunningTimerBar during a break", () => {
  function renderBar() {
    return render(
      <MemoryRouter>
        <RunningTimerBar />
      </MemoryRouter>,
    );
  }

  it("counts the break down", () => {
    showTimer(timer({ isRunning: false, durationSeconds: 3000 }));
    setBreakState({ breakEndsAt: NOW + 4 * MINUTE });
    renderBar();

    const bar = screen.getByRole("region", { name: "Task timer" });
    expect(bar).toHaveTextContent("On a break");
    expect(within(bar).getByRole("timer", { name: "Break time left" })).toHaveTextContent(
      "04:00",
    );
    expect(within(bar).getByRole("button", { name: "End break" })).toBeInTheDocument();
  });

  it("says when the break is over", () => {
    showTimer(timer({ isRunning: false, durationSeconds: 3000 }));
    setBreakState({ breakEndsAt: NOW - 1 });
    renderBar();

    const bar = screen.getByRole("region", { name: "Task timer" });
    expect(bar).toHaveTextContent("Break's over");
    expect(within(bar).getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });
});

describe("BreakReminderSettingsCard", () => {
  beforeEach(() => {
    timeTrackingState.saveBreakReminders = vi.fn().mockResolvedValue(undefined);
  });

  it("saves the chosen rhythm", async () => {
    render(<BreakReminderSettingsCard />);

    expect(screen.getByRole("button", { name: "50 min" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "25 min" }));
    });
    expect(timeTrackingState.saveBreakReminders).toHaveBeenCalledWith({
      enabled: true,
      workMinutes: 25,
      breakMinutes: 10,
      notifications: false,
      sound: true,
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("saves a custom reminder time and break length", async () => {
    render(<BreakReminderSettingsCard />);

    const [customWork, customBreak] = screen.getAllByRole("button", {
      name: "Custom",
    });
    fireEvent.click(customWork!);
    const workInput = screen.getByLabelText("Remind me after, in minutes");
    fireEvent.change(workInput, { target: { value: "35" } });
    await act(async () => {
      fireEvent.keyDown(workInput, { key: "Enter" });
    });
    expect(timeTrackingState.saveBreakReminders).toHaveBeenLastCalledWith(
      expect.objectContaining({ workMinutes: 35 }),
    );

    fireEvent.click(customBreak!);
    const breakInput = screen.getByLabelText("Break length, in minutes");
    fireEvent.change(breakInput, { target: { value: "7" } });
    await act(async () => {
      fireEvent.blur(breakInput);
    });
    expect(timeTrackingState.saveBreakReminders).toHaveBeenLastCalledWith(
      expect.objectContaining({ breakMinutes: 7 }),
    );
  });

  it("explains the allowed range for a custom time", async () => {
    render(<BreakReminderSettingsCard />);

    fireEvent.click(screen.getAllByRole("button", { name: "Custom" })[1]!);
    const breakInput = screen.getByLabelText("Break length, in minutes");
    fireEvent.change(breakInput, { target: { value: "90" } });
    await act(async () => {
      fireEvent.blur(breakInput);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose between 1 and 60 minutes.",
    );
    expect(timeTrackingState.saveBreakReminders).not.toHaveBeenCalled();
  });

  it("shows a saved custom time as Custom", () => {
    timeTrackingState.breakReminders = {
      ...timeTrackingState.breakReminders,
      workMinutes: 35,
    };
    render(<BreakReminderSettingsCard />);

    expect(screen.getAllByRole("button", { name: "Custom" })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Remind me after, in minutes")).toHaveValue(35);
    expect(screen.getByRole("button", { name: "50 min" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("asks the browser before turning on notifications", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    render(<BreakReminderSettingsCard />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", { name: /Also show a system notification/ }),
      );
    });

    expect(requestPermission).toHaveBeenCalled();
    expect(timeTrackingState.saveBreakReminders).toHaveBeenCalledWith(
      expect.objectContaining({ notifications: true }),
    );
  });

  it("explains when notifications are blocked", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("denied"),
    });
    render(<BreakReminderSettingsCard />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", { name: /Also show a system notification/ }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Notifications are blocked for this site",
    );
    expect(timeTrackingState.saveBreakReminders).not.toHaveBeenCalled();
  });

  it("waits for the browser when notifications are on but not yet allowed", async () => {
    timeTrackingState.breakReminders.notifications = true;
    const requestPermission = vi.fn(async () => {
      fakeNotification.permission = "granted";
      return "granted";
    });
    const fakeNotification = { permission: "default", requestPermission };
    vi.stubGlobal("Notification", fakeNotification);
    render(<BreakReminderSettingsCard />);

    const checkbox = screen.getByRole("checkbox", {
      name: /Also show a system notification/,
    });
    expect(checkbox).not.toBeChecked();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Allow notifications" }));
    });

    expect(requestPermission).toHaveBeenCalled();
    expect(checkbox).toBeChecked();
    expect(screen.getByText("Notifications are on")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allow notifications" })).toBeNull();
  });

  it("explains how to allow notifications when the browser doesn't ask", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("default"),
    });
    render(<BreakReminderSettingsCard />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", { name: /Also show a system notification/ }),
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "open Site settings, set Notifications to Allow",
    );
    expect(timeTrackingState.saveBreakReminders).not.toHaveBeenCalled();
  });

  it("can turn the sound off, and play it to hear it", async () => {
    render(<BreakReminderSettingsCard />);

    fireEvent.click(screen.getByRole("button", { name: "Play sound" }));
    expect(playChime).toHaveBeenCalledWith("reminder");

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /Play a sound/ }));
    });
    expect(timeTrackingState.saveBreakReminders).toHaveBeenCalledWith(
      expect.objectContaining({ sound: false }),
    );
  });

  it("can turn reminders off", async () => {
    render(<BreakReminderSettingsCard />);
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: /Remind me to take breaks/ }));
    });
    expect(timeTrackingState.saveBreakReminders).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
});
