import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Animated, Easing, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useWakeWord } from '../../../hooks/useWakeWord';
import { useAmbientRecorder } from '../../../components/AmbientRecorder';
import { useTranscriptStream } from '../../../hooks/useTranscriptStream';

export default function RecordingScreen() {
  const router = useRouter();
  const {
    sessionId, isRecording, isWakeWordActive,
    transcriptChunks, status, setRecording, setStatus
  } = useSessionStore();

  const { state: wakeState, startListening, stopListening } = useWakeWord();
  const { startChunkLoop, stopChunkLoop } = useAmbientRecorder();
  useTranscriptStream(sessionId);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3, duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1, duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
      // Start timer
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } else {
      pulseAnim.setValue(1);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // Start wake word listening on mount
  useEffect(() => {
    startListening(
      // On wake word detected
      async () => {
        setRecording(true);
        setStatus('RECORDING');
        await startChunkLoop();
      },
      // On stop word detected
      async () => {
        await handleEndSession();
      }
    );
    return () => { stopListening(); };
  }, []);

  const handleEndSession = async () => {
    setRecording(false);
    await stopChunkLoop();
    await stopListening();
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const speakerColor = (label: string) =>
    label === 'DOCTOR' ? '#4a9eff' : label === 'PATIENT' ? '#00d4aa' : '#a78bfa';

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>

      {/* Status Bar */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#4a5568', fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        {isRecording && (
          <View style={{
            backgroundColor: '#ff444420', borderRadius: 8,
            paddingHorizontal: 12, paddingVertical: 4,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4444' }} />
            <Text style={{ color: '#ff4444', fontSize: 13, fontWeight: '700' }}>
              {formatTime(elapsedSeconds)}
            </Text>
          </View>
        )}
      </View>

      {/* Centre Wake Word Indicator */}
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
          width: 140, height: 140, borderRadius: 70,
          backgroundColor: isRecording ? '#00d4aa20' : '#1a2744',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2,
          borderColor: isRecording ? '#00d4aa' :
            wakeState === 'LISTENING' ? '#4a9eff40' : '#1a2744',
        }}>
          <Text style={{ fontSize: 48 }}>
            {isRecording ? '🎙️' : wakeState === 'LISTENING' ? '👂' : '😴'}
          </Text>
        </Animated.View>

        <Text style={{
          color: isRecording ? '#00d4aa' : '#4a9eff',
          fontSize: 18, fontWeight: '700', marginTop: 20,
        }}>
          {isRecording ? 'Recording...' :
            wakeState === 'LISTENING' ? 'Listening for "Hey Nesh"' :
            status === 'PROCESSING' ? 'Generating SOAP note...' : 'Initialising...'}
        </Text>

        <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 6 }}>
          {isRecording
            ? 'Say "Hey Nesh stop" or tap End to finish'
            : 'Speak naturally — MediScribe is ambient'}
        </Text>
      </View>

      {/* Live Transcript */}
      <View style={{
        flex: 1, marginHorizontal: 16,
        backgroundColor: '#111827', borderRadius: 20,
        borderWidth: 1, borderColor: '#1a2744',
        overflow: 'hidden',
      }}>
        <View style={{
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: 1, borderBottomColor: '#1a2744',
          flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: isRecording ? '#00d4aa' : '#4a5568',
          }} />
          <Text style={{ color: '#8892a4', fontSize: 13, fontWeight: '600' }}>
            LIVE TRANSCRIPT
          </Text>
          <Text style={{ color: '#4a5568', fontSize: 12, marginLeft: 'auto' }}>
            {transcriptChunks.length} chunks
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {transcriptChunks.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 32, marginBottom: 12 }}>🩺</Text>
              <Text style={{ color: '#4a5568', fontSize: 14, textAlign: 'center' }}>
                {isRecording
                  ? 'Transcription will appear here...'
                  : 'Say "Hey Nesh" to start recording'}
              </Text>
            </View>
          ) : (
            transcriptChunks.map((chunk, i) => (
              <View key={chunk.id} style={{ marginBottom: 12 }}>
                <Text style={{
                  color: speakerColor(chunk.speaker_label),
                  fontSize: 11, fontWeight: '700',
                  letterSpacing: 0.8, marginBottom: 3,
                }}>
                  [{chunk.speaker_label}]
                </Text>
                <Text style={{ color: '#e2e8f0', fontSize: 15, lineHeight: 22 }}>
                  {chunk.text}
                </Text>
                <Text style={{ color: '#2d3748', fontSize: 11, marginTop: 3 }}>
                  {Math.round(chunk.confidence * 100)}% confidence
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* End Session Button */}
      <View style={{ padding: 24 }}>
        {status === 'PROCESSING' ? (
          <View style={{
            backgroundColor: '#111827', borderRadius: 16,
            paddingVertical: 18, alignItems: 'center',
            borderWidth: 1, borderColor: '#1a2744',
          }}>
            <Text style={{ color: '#4a9eff', fontSize: 16, fontWeight: '600' }}>
              ⚙️ Generating SOAP Note...
            </Text>
            <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 4 }}>
              LLaMA 3 is processing your consultation
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={isRecording ? handleManualStop : undefined}
            disabled={!isRecording}
            style={{
              backgroundColor: isRecording ? '#ff444420' : '#1a2744',
              borderRadius: 16, paddingVertical: 18,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isRecording ? '#ff4444' : '#1a2744',
            }}
          >
            <Text style={{
              color: isRecording ? '#ff4444' : '#4a5568',
              fontSize: 16, fontWeight: '700'
            }}>
              {isRecording ? '⏹ End Session' : '👂 Waiting for "Hey Nesh"...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}