// Two soft rising notes: E5, then A5.
const NOTES = [
  { hz: 659.25, at: 0 },
  { hz: 880, at: 0.15 },
];
const PEAK = 0.18;
const RING_SECONDS = 0.8;

/**
 * Plays a short chime, synthesised with the Web Audio API so there's no sound
 * file to ship. Browsers keep audio off until the user has clicked or typed on
 * the page, so this resolves false when sound is blocked.
 */
export async function playChime(): Promise<boolean> {
  if (typeof AudioContext === "undefined") return false;
  const ctx = new AudioContext();
  if (ctx.state !== "running") {
    // While audio is blocked, resume() never settles. Give it a moment, no more.
    await Promise.race([
      ctx.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  }
  if (ctx.state !== "running") {
    void ctx.close();
    return false;
  }

  for (const note of NOTES) {
    const start = ctx.currentTime + note.at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.hz;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(PEAK, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + RING_SECONDS);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + RING_SECONDS);
  }
  setTimeout(() => void ctx.close(), 1500);
  return true;
}
