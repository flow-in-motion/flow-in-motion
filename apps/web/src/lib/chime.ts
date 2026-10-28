/**
 * A short, soft chime made in the browser (no sound file needed). Browsers
 * only allow sound after someone has clicked or typed on the page, so
 * primeChime() is called on the first click to get audio ready.
 */
type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContext() {
  if (context) return context;
  const Constructor: AudioContextConstructor | undefined =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextConstructor })
          .webkitAudioContext);
  if (!Constructor) return null;
  context = new Constructor();
  return context;
}

/** Gets audio ready during a click, so a later chime is allowed to play. */
export function primeChime() {
  try {
    const audio = audioContext();
    if (audio?.state === "suspended") void audio.resume();
  } catch {
    // No audio in this browser.
  }
}

/** Notes, in hertz: rising for "time for a break", falling for "break's over". */
const CHIMES = {
  reminder: [523.25, 659.25, 783.99],
  "break-over": [783.99, 659.25, 880],
} as const;

export function playChime(kind: keyof typeof CHIMES = "reminder") {
  try {
    const audio = audioContext();
    if (!audio) return false;
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime + 0.05;
    CHIMES[kind].forEach((frequency, index) => {
      const at = start + index * 0.16;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.85);
    });
    return true;
  } catch {
    return false;
  }
}
