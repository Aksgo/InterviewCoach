// Web Audio API Synthesized Call Waiting, Call Start, and Call End Sounds (MS Teams Style)
let audioCtx: AudioContext | null = null;
let intervalId: any = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// MS Teams-Style Call Start / Join Chime
export function playCallStartSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Ascending 4-tone melodic chord: C5 (523.25) -> E5 (659.25) -> G5 (783.99) -> C6 (1046.50)
    const notes = [
      { freq: 523.25, time: 0.0,  duration: 0.16 },
      { freq: 659.25, time: 0.12, duration: 0.16 },
      { freq: 783.99, time: 0.24, duration: 0.20 },
      { freq: 1046.50, time: 0.38, duration: 0.45 },
    ];

    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(note.freq * 2, now + note.time); // warm harmonic

      const startTime = now + note.time;
      const stopTime = startTime + note.duration;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(stopTime);
      osc2.stop(stopTime);
    });
  } catch (err) {
    console.warn("Call start sound error:", err);
  }
}

// MS Teams-Style Call End / Disconnect Chime
export function playCallEndSound(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) {
        resolve();
        return;
      }

      const now = ctx.currentTime;

      // Descending 3-tone disconnect chime: G5 (783.99) -> E5 (659.25) -> C5 (523.25)
      const notes = [
        { freq: 783.99, time: 0.0,  duration: 0.15 },
        { freq: 659.25, time: 0.12, duration: 0.15 },
        { freq: 523.25, time: 0.24, duration: 0.50 },
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(note.freq * 0.5, now + note.time); // warm sub octave

        const startTime = now + note.time;
        const stopTime = startTime + note.duration;

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(0.14, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc2.start(startTime);
        osc.stop(stopTime);
        osc2.stop(stopTime);
      });

      // Wait for audio to complete before resolving promise
      setTimeout(() => {
        resolve();
      }, 700);
    } catch (err) {
      console.warn("Call end sound error:", err);
      resolve();
    }
  });
}

export function startThinkingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    stopThinkingSound();

    // Gentle 2-step call processing chime tone (E5 -> G#5) played every 1.1s
    const playChime = () => {
      if (!audioCtx) return;
      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.exponentialRampToValueAtTime(830.61, now + 0.12); // G#5

        gain.gain.setValueAtTime(0.025, now); // Gentle, subtle background chime
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.38);
      } catch (e) {
        console.warn("Chime playback error:", e);
      }
    };

    playChime();
    intervalId = setInterval(playChime, 1100);
  } catch (err) {
    console.warn("Thinking sound start failed:", err);
  }
}

export function stopThinkingSound() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

