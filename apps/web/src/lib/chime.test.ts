import { afterEach, describe, expect, it, vi } from "vitest";

describe("playChime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("plays three soft notes", async () => {
    const started: number[] = [];
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn();
      createOscillator() {
        const oscillator = {
          type: "",
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(() => started.push(oscillator.frequency.value)),
          stop: vi.fn(),
        };
        return oscillator;
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const { playChime } = await import("@/lib/chime");

    expect(playChime("reminder")).toBe(true);
    expect(started).toEqual([523.25, 659.25, 783.99]);
  });

  it("does nothing where the browser has no audio", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { playChime } = await import("@/lib/chime");
    expect(playChime()).toBe(false);
  });
});
