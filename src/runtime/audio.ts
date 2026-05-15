import type { FeedbackMode } from "@/types/posture";

let audioContext: AudioContext | null = null;

type CueAudioLevel = 1 | 2 | 3 | 4;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    try {
      audioContext = new AudioContextConstructor();
    } catch {
      return null;
    }
  }

  return audioContext;
}

function resumeAudioContext(context: AudioContext) {
  if (context.state === "suspended") {
    void context.resume().catch(() => {});
  }
}

export function unlockAudioFeedback() {
  const context = getAudioContext();
  if (!context || context.state === "closed") return;

  resumeAudioContext(context);
}

export function resetAudioFeedbackForTests() {
  audioContext = null;
}

export function playCueSound(level: CueAudioLevel) {
  const context = getAudioContext();
  if (!context || context.state === "closed") return;

  resumeAudioContext(context);

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = level === 1 ? 660 : level === 2 ? 520 : level === 3 ? 420 : 300;
  gain.gain.value = level === 1 ? 0.022 : level === 2 ? 0.03 : level === 3 ? 0.05 : 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + (level === 1 ? 0.12 : level === 4 ? 0.32 : 0.18));
}

export function speakCue(text: string) {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    return;
  }

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function performCueFeedback(mode: FeedbackMode, title: string, detail: string, level: CueAudioLevel) {
  if (mode === "sound") {
    playCueSound(level);
    return;
  }

  if (mode === "voice") {
    playCueSound(level);
    speakCue(`${title}. ${detail}`);
  }
}
