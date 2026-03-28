import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useWakeWord } from '../../../hooks/useWakeWord';
import { useAmbientRecorder } from '../../../components/AmbientRecorder';
import { useTranscriptStream } from '../../../hooks/useTranscriptStream';
import { useSession } from '../../../hooks/useSession';
import { WakeWordListener } from '../../../components/WakeWordListener';
import { LiveTranscript } from '../../../components/LiveTranscript';

export default function RecordingScreen() {
  const router = useRouter();

  const {
    sessionId,
    isRecording,
    transcriptChunks,
    status,
    setRecording,
  } = useSessionStore();

  const { endSession } = useSession();
  const { state: wakeState, startListening, stopListening } = useWakeWord();
  const { startChunkLoop, stopChunkLoop } = useAmbientRecorder();

  // Subscribe to Realtime — auto-navigates to review on analysis_complete
  useTranscriptStream(sessionId);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // ── Start wake-word listening on mount ───────────────────────────────────
  useEffect(() => {
    startListening(
      // onWakeWord: begin ambient recording
      async () => {
        setRecording(true);
        await startChunkLoop();
      },
      // onStopWord: "Hey Nesh stop" voice command
      async () => {
        await handleEndSession();
      },
    );

    return () => {
      stopListening();
    };
  }, []);

  // ── Navigate to review when analysis_complete fires ──────────────────────
  useEffect(() => {
    if (status === 'REVIEW') {
      router.replace('/(app)/session/review');
    }
  }, [status]);

  // ── End session ──────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    if (!isRecording) return;
    await stopChunkLoop();   // flushes last chunk + calls /sessions/{id}/end
    await stopListening();
    await endSession();      // updates local state → PROCESSING
  };

  const handleManualStop = () => {
    Alert.alert(
      'End Consultation?',
      'This will stop recording and generate your SOAP note.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: handleEndSession },
      ]
    );
  };

  const handleBack = () => {
    if (isRecording) {
      Alert.alert(
        'Recording in progress',
        'End the session before going back.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.back();
  };

  const isProcessing = status === 'PROCESSING';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>

      {/* ── Top bar ── */}
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>MediScribe</Text>

          {/* Session ID pill (debug / demo) */}
          {sessionId && (
            <View style={styles.sessionPill}>
              <Text style={styles.sessionPillText}>
                #{sessionId.slice(0, 6).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ── Hero wake-word indicator ── */}
      <WakeWordListener
        wakeState={wakeState}
        isRecording={isRecording}
        sessionStatus={status}
        elapsedSeconds={elapsedSeconds}
        chunkCount={transcriptChunks.length}
      />

      {/* ── Live transcript card ── */}
      <LiveTranscript
        chunks={transcriptChunks}
        isRecording={isRecording}
      />

      {/* ── Bottom action area ── */}
      <View style={styles.bottomArea}>
        {isProcessing ? (
          /* Processing state — read-only feedback */
          <View style={styles.processingCard}>
            <Text style={styles.processingTitle}>⚙️  Analysing Consultation</Text>
            <Text style={styles.processingSubtitle}>
              LLaMA 3 is reading {transcriptChunks.length} transcript segments…
            </Text>
          </View>

        ) : isRecording ? (
          /* Active recording — show End button */
          <TouchableOpacity
            onPress={handleManualStop}
            activeOpacity={0.8}
            style={styles.endBtn}
          >
            <Text style={styles.endBtnText}>⏹  End Session</Text>
          </TouchableOpacity>

        ) : (
          /* Waiting for wake word — greyed out placeholder */
          <View style={styles.waitingCard}>
            <Text style={styles.waitingText}>
              👂  Waiting for "Hey Nesh"…
            </Text>
            <Text style={styles.waitingSubtext}>
              Speak naturally — recording starts automatically
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },

  // Top bar
  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 24,
    paddingTop:      16,
    paddingBottom:   8,
  },
  backText: {
    color:    '#4a5568',
    fontSize: 15,
  },
  topBarTitle: {
    color:      '#8892a4',
    fontSize:   13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sessionPill: {
    backgroundColor: '#1a2744',
    borderRadius:    6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sessionPillText: {
    color:      '#4a5568',
    fontSize:   11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },

  // Bottom
  bottomArea: {
    padding: 20,
    paddingBottom: 32,
  },

  // End button
  endBtn: {
    backgroundColor: '#ff444415',
    borderRadius:    16,
    paddingVertical: 18,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#ff444450',
  },
  endBtnText: {
    color:      '#ff4444',
    fontSize:   16,
    fontWeight: '800',
  },

  // Waiting card
  waitingCard: {
    backgroundColor: '#111827',
    borderRadius:    16,
    paddingVertical: 20,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#1a2744',
    gap:             6,
  },
  waitingText: {
    color:      '#4a5568',
    fontSize:   15,
    fontWeight: '600',
  },
  waitingSubtext: {
    color:    '#2d3748',
    fontSize: 12,
  },

  // Processing card
  processingCard: {
    backgroundColor: '#4a9eff10',
    borderRadius:    16,
    paddingVertical: 20,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     '#4a9eff30',
    gap:             6,
  },
  processingTitle: {
    color:      '#4a9eff',
    fontSize:   15,
    fontWeight: '700',
  },
  processingSubtitle: {
    color:    '#4a5568',
    fontSize: 13,
  },
});
