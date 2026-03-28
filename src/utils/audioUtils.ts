/**
 * audioUtils.ts
 * Helpers for audio processing: base64 encoding, chunk splitting,
 * RMS energy calculation for VAD, and audio mode setup.
 */

import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

// ─────────────────────────────────────────────────────────────────────────────
// Base64 helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read an audio file at `uri` and return its contents as a Base64 string.
 * Uses Expo FileSystem — works on Android and iOS.
 */
export async function audioFileToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as const,
  });
  return base64;
}

/**
 * Estimate the size in bytes of a Base64 payload before sending.
 * Useful for checking we're staying under Groq's 25MB audio limit.
 */
export function base64ByteSize(b64: string): number {
  // Each base64 char encodes 6 bits → 4 chars = 3 bytes
  const padding = (b64.match(/=+$/) ?? [''])[0].length;
  return (b64.length * 3) / 4 - padding;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recording options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard recording options for a 5-second chunk capture.
 * 16kHz mono M4A/AAC — best tradeoff between Groq Whisper accuracy and file size.
 */
export const CHUNK_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: 2,   // MPEG_4
    audioEncoder: 3,   // AAC
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac' as any,
    audioQuality: 0x60, // Medium
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

/**
 * Lighter recording options for the 1.5-second wake-word VAD samples.
 * Lower bitrate since we only need energy / keyword detection.
 */
export const WAKEWORD_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: 2,
    audioEncoder: 3,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac' as any,
    audioQuality: 0x7F,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio mode helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set Audio mode for active recording.
 * Must be called before starting any Audio.Recording instance.
 */
export async function enableRecordingMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
}

/**
 * Restore Audio mode to playback-only after recording stops.
 */
export async function restorePlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RMS / energy helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a dBFS metering value (typically -160 to 0) to a 0–1 normalised
 * energy level. Used for Voice Activity Detection in the wake-word pipeline.
 *
 * @param dbfs  - Value from recording.getStatusAsync().metering (dBFS)
 * @returns     - Normalised 0-1 energy level
 */
export function dbfsToNormalized(dbfs: number): number {
  // Clamp to [-160, 0] range then map to [0, 1]
  const clamped = Math.max(-160, Math.min(0, dbfs));
  return (clamped + 160) / 160;
}

/**
 * Extract the metering (energy) value from an active recording's status.
 * Returns 0 if recording is not active or metering is unavailable.
 */
export async function getRecordingEnergy(recording: Audio.Recording): Promise<number> {
  try {
    const status = await recording.getStatusAsync();
    if (!status.isRecording) return 0;
    const db: number = (status as any).metering ?? -160;
    return dbfsToNormalized(db);
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timing helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format elapsed seconds as MM:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Human-readable duration string, e.g. "2m 34s" or "45s" */
export function humanDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}