export const MAX_VOICE_MS = 60_000;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function voiceInputSupported(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      navigator.mediaDevices?.getUserMedia,
  );
}

export function audioFilenameForMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "voice.m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "voice.mp3";
  if (mime.includes("wav")) return "voice.wav";
  if (mime.includes("ogg") || mime.includes("oga")) return "voice.ogg";
  return "voice.webm";
}

