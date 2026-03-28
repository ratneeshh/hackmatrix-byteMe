import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { useSessionStore } from '../store/sessionStore';

const THRESHOLD = parseFloat(process.env.EXPO_PUBLIC_WAKE_WORD_THRESHOLD ?? '0.72');
const MAX_EDIT_DISTANCE = parseInt(process.env.EXPO_PUBLIC_WAKE_WORD_EDIT_DISTANCE ?? '2');
const WAKE_WORD = 'hey nesh';
const STOP_WORDS = ['hey nesh stop', 'end session', 'stop recording'];

// Levenshtein edit distance for fuzzy keyword matching
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function matchesWakeWord(transcript: string, target: string): boolean {
  const t = transcript.toLowerCase().trim();
  if (t.includes(target)) return true;
  // Check each word window of same length
  const words = t.split(' ');
  const targetWords = target.split(' ');
  for (let i = 0; i <= words.length - targetWords.length; i++) {
    const window = words.slice(i, i + targetWords.length).join(' ');
    if (editDistance(window, target) <= MAX_EDIT_DISTANCE) return true;
  }
  return false;
}

export type WakeWordState = 'IDLE' | 'LISTENING' | 'WAKE_DETECTED' | 'STOP_DETECTED';

export const useWakeWord = () => {
  const [state, setState] = useState<WakeWordState>('IDLE');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const listeningRef = useRef(false);
  const { setWakeWordActive } = useSessionStore();

  const requestPermission = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    setPermissionGranted(granted);
    return granted;
  };

  // Simulate on-device VAD with RMS energy check via recording status
  const checkEnergyLevel = async (recording: Audio.Recording): Promise<number> => {
    try {
      const status = await recording.getStatusAsync();
      if (!status.isRecording) return 0;
      // metering gives dBFS value — convert to 0-1 range
      const db = (status as any).metering ?? -160;
      const normalized = Math.max(0, (db + 160) / 160);
      return normalized;
    } catch {
      return 0;
    }
  };

  const startListening = useCallback(async (
    onWakeWord: () => void,
    onStopWord: () => void
  ) => {
    const granted = await requestPermission();
    if (!granted) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    listeningRef.current = true;
    setState('LISTENING');

    // Continuous 1.5s sample loop for VAD + keyword spotting
    const sampleLoop = async () => {
      while (listeningRef.current) {
        try {
          // Record 1.5s sample
          const recording = new Audio.Recording();
          await recording.prepareToRecordAsync({
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
          });
          recordingRef.current = recording;
          await recording.startAsync();

          // Wait 1.5s
          await new Promise(r => setTimeout(r, 1500));

          // Check energy level
          const energy = await checkEnergyLevel(recording);
          await recording.stopAndUnloadAsync();

          // Only run keyword spotting if energy above threshold
          if (energy >= THRESHOLD && listeningRef.current) {
            const uri = recording.getURI();
            if (uri) {
              // Convert to base64 and check with a lightweight transcription
              // For demo: use simple energy + pattern matching
              // In production: call Groq Whisper on this 1.5s chunk
              const result = await quickTranscribe(uri);
              if (result) {
                const isStop = STOP_WORDS.some(sw => matchesWakeWord(result, sw));
                const isWake = matchesWakeWord(result, WAKE_WORD);
                if (isStop && listeningRef.current) {
                  setState('STOP_DETECTED');
                  setWakeWordActive(false);
                  onStopWord();
                  break;
                } else if (isWake && listeningRef.current) {
                  setState('WAKE_DETECTED');
                  setWakeWordActive(true);
                  onWakeWord();
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.log('Wake word sample error:', e);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    };

    sampleLoop();
  }, []);

  const stopListening = useCallback(async () => {
    listeningRef.current = false;
    setState('IDLE');
    setWakeWordActive(false);
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {}
  }, []);

  return { state, permissionGranted, startListening, stopListening, requestPermission };
};

// Lightweight transcription helper — calls Groq Whisper on short sample
async function quickTranscribe(uri: string): Promise<string | null> {
  try {
    const { supabase } = await import('../api/supabase');
    // Read file as base64
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const { data, error } = await supabase.functions.invoke('transcribe', {
      body: { audio_b64: base64, chunk_index: -1, is_wake_word_check: true },
    });
    if (error || !data) return null;
    return data.transcript_chunk ?? null;
  } catch {
    return null;
  }
}