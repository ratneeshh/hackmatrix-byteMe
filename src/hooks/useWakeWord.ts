import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';

const RMS_THRESHOLD    = parseFloat(process.env.WAKE_WORD_THRESHOLD   ?? '0.72');
const MAX_EDIT_DIST    = parseInt(process.env.WAKE_WORD_EDIT_DISTANCE  ?? '2', 10);
const SAMPLE_WINDOW_MS = 1500;

export type WakeWordState = 'IDLE' | 'LISTENING' | 'WAKE_DETECTED' | 'RECORDING' | 'STOPPED';

interface UseWakeWordResult {
  state:          WakeWordState;
  startListening: (
    onWakeWord: () => Promise<void>,
    onStopWord:  () => Promise<void>,
  ) => Promise<void>;
  stopListening:  () => Promise<void>;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

const WAKE_TARGETS = ['hey nesh', 'hey nash', 'nesh'];
const STOP_TARGETS = ['hey nesh stop', 'stop', 'end session', 'nesh stop'];

export function isWakeWord(phrase: string): boolean {
  const norm = normalise(phrase);
  return WAKE_TARGETS.some(t => editDistance(norm, t) <= MAX_EDIT_DIST);
}

export function isStopWord(phrase: string): boolean {
  const norm = normalise(phrase);
  return STOP_TARGETS.some(t => editDistance(norm, t) <= MAX_EDIT_DIST);
}

export function useWakeWord(): UseWakeWordResult {
  const [state, setState] = useState<WakeWordState>('IDLE');
  const recordingRef  = useRef<Audio.Recording | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef     = useRef(false);
  const onWakeRef     = useRef<(() => Promise<void>) | null>(null);
  const onStopRef     = useRef<(() => Promise<void>) | null>(null);
  const stateRef      = useRef<WakeWordState>('IDLE');

  const setStateSync = (s: WakeWordState) => {
    stateRef.current = s;
    setState(s);
  };

  const startListening = useCallback(async (
    onWakeWord: () => Promise<void>,
    onStopWord:  () => Promise<void>,
  ) => {
    onWakeRef.current = onWakeWord;
    onStopRef.current = onStopWord;

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[WakeWord] Microphone permission denied');
      return;
    }

    activeRef.current = true;
    setStateSync('LISTENING');
  }, []);

  const stopListening = useCallback(async () => {
    activeRef.current = false;
    setStateSync('STOPPED');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
  }, []);

  // Called by WakeWordListener.tsx when wake phrase confirmed
  const triggerWake = useCallback(async () => {
    if (stateRef.current !== 'LISTENING') return;
    setStateSync('RECORDING');
    if (onWakeRef.current) await onWakeRef.current();
  }, []);

  // Called by WakeWordListener.tsx when stop phrase confirmed
  const triggerStop = useCallback(async () => {
    if (stateRef.current !== 'RECORDING') return;
    setStateSync('STOPPED');
    if (onStopRef.current) await onStopRef.current();
  }, []);

  return {
    state,
    startListening,
    stopListening,
    // @ts-ignore — extra exports for WakeWordListener.tsx
    triggerWake,
    triggerStop,
  };
}