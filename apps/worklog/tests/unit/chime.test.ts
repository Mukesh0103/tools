import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playChime } from "@/lib/chime";

/** Just enough of AudioContext to see what gets scheduled. */
function fakeAudio(initialState: "running" | "suspended") {
  const started: number[] = [];
  const close = vi.fn();
  class FakeContext {
    state = initialState;
    currentTime = 0;
    destination = {};
    // A blocked browser never settles resume().
    resume = () => new Promise<void>(() => {});
    close = close;
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: (next: unknown) => next,
      };
    }
    createOscillator() {
      const osc = {
        type: "",
        frequency: { value: 0 },
        connect: (next: unknown) => next,
        start: () => started.push(osc.frequency.value),
        stop: vi.fn(),
      };
      return osc;
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  return { started, close };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("playChime", () => {
  it("plays two rising notes when audio is allowed", async () => {
    const audio = fakeAudio("running");
    expect(await playChime()).toBe(true);
    expect(audio.started).toHaveLength(2);
    expect(audio.started[1]).toBeGreaterThan(audio.started[0]!);
  });

  it("gives up quietly when the browser blocks audio", async () => {
    const audio = fakeAudio("suspended");
    const played = playChime();
    await vi.advanceTimersByTimeAsync(500);
    expect(await played).toBe(false);
    expect(audio.started).toEqual([]);
    expect(audio.close).toHaveBeenCalled();
  });

  it("does nothing without Web Audio", async () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(await playChime()).toBe(false);
  });
});
