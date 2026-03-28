import { useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabase';
import { useSessionStore } from '../store/sessionStore';

const CHUNK_SECONDS = parseInt(process.env.EXPO_PUBLIC_AUDIO_CHUNK_SECONDS ?? '5');

export const useAmbientRecorder = () => {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const chunkLoopRef = useRef(false);
  const { sessionId, chunkIndex, incrementChunk, setStatus } = useSessionStore();

  const recordChunk = async (): Promise<string | null> => {
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'aac' as any,
          audioQuality: 0x60,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });
      recordingRef.current = recording;
      await recording.startAsync();
      await new Promise(r => setTimeout(r, CHUNK_SECONDS * 1000));
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) return null;

      // Read as base64
    //   const base64 = await FileSystem.readAsStringAsync(uri, {
    //     encoding: FileSystem.EncodingType.Base64,
    //   });

    const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as const,
    });

      return base64;
    } catch (e) {
      console.error('Chunk recording error:', e);
      return null;
    }
  };

  const startChunkLoop = useCallback(async () => {
    if (!sessionId) return;
    chunkLoopRef.current = true;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    let index = 0;
    while (chunkLoopRef.current) {
      const base64 = await recordChunk();
      if (!base64 || !chunkLoopRef.current) break;

      try {
        await supabase.functions.invoke(`sessions/${sessionId}/chunk`, {
          body: { audio_b64: base64, chunk_index: index },
        });
        incrementChunk();
        index++;
      } catch (e) {
        console.error('Chunk upload error:', e);
      }
    }
  }, [sessionId]);

  const stopChunkLoop = useCallback(async () => {
    chunkLoopRef.current = false;
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch {}

    if (sessionId) {
      try {
        await supabase.functions.invoke(`sessions/${sessionId}/end`, { body: {} });
        setStatus('PROCESSING');
      } catch (e) {
        console.error('End session error:', e);
      }
    }
  }, [sessionId]);

  return { startChunkLoop, stopChunkLoop };
};