/**
 * WakeWordListener.tsx — MediScribe Hero UI Component
 *
 * Renders the ambient recording indicator:
 *   IDLE       → sleeping icon, grey ring
 *   LISTENING  → ear icon, slow blue breathe pulse
 *   RECORDING  → mic icon, green ripple rings, live timer, red LIVE pill
 *   PROCESSING → gear icon, amber spin ring
 *
 * This is purely presentational — all state comes from props.
 * The actual audio logic lives in useWakeWord.ts + AmbientRecorder.tsx.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import type { WakeWordState } from '../hooks/useWakeWord';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WakeWordListenerProps {
  /** Current wake-word detection state */
  wakeState:       WakeWordState;
  /** True while AmbientRecorder chunk loop is running */
  isRecording:     boolean;
  /** Session status — used to show "Generating SOAP note…" */
  sessionStatus?:  'IDLE' | 'RECORDING' | 'PROCESSING' | 'REVIEW' | 'COMPLETE' | 'FAILED';
  /** Elapsed seconds since recording started (passed from recording.tsx timer) */
  elapsedSeconds?: number;
  /** How many transcript chunks have arrived */
  chunkCount?:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Ripple ring that expands outward and fades */
function RippleRing({ delay, color }: { delay: number; color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 2.2,  duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,    duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,    duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7,  duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position:     'absolute',
        width:        120,
        height:       120,
        borderRadius: 60,
        borderWidth:  1.5,
        borderColor:  color,
        transform:    [{ scale }],
        opacity,
      }}
    />
  );
}

/** Slow breathe pulse for LISTENING state */
function BreathePulse({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position:         'absolute',
        width:            120,
        height:           120,
        borderRadius:     60,
        borderWidth:      1.5,
        borderColor:      color,
        opacity:          0.35,
        transform:        [{ scale }],
      }}
    />
  );
}

/** Spinning dashed ring for PROCESSING state */
function SpinRing({ color }: { color: string }) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotate, {
        toValue:         1,
        duration:        1400,
        easing:          Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={{
        position:     'absolute',
        width:        132,
        height:       132,
        borderRadius: 66,
        borderWidth:  2,
        borderColor:  'transparent',
        borderTopColor: color,
        transform:    [{ rotate: spin }],
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Core glow that pulses while recording
// ─────────────────────────────────────────────────────────────────────────────

function CoreGlow({ color, active }: { color: string; active: boolean }) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      glow.setValue(0);
    }
  }, [active]);

  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });

  return (
    <Animated.View
      style={{
        position:     'absolute',
        width:        100,
        height:       100,
        borderRadius: 50,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function WakeWordListener({
  wakeState,
  isRecording,
  sessionStatus,
  elapsedSeconds = 0,
  chunkCount     = 0,
}: WakeWordListenerProps) {

  const isProcessing = sessionStatus === 'PROCESSING';

  // Determine icon + color based on state
  const icon = isProcessing        ? '⚙️'
             : isRecording          ? '🎙️'
             : wakeState === 'LISTENING' ? '👂'
             : wakeState === 'WAKE_DETECTED' ? '🎙️'
             : wakeState === 'STOP_DETECTED' ? '⏹'
             : '😴';

  const ringColor = isProcessing           ? '#f59e0b'
                  : isRecording             ? '#00d4aa'
                  : wakeState === 'LISTENING' ? '#4a9eff'
                  : '#1a2744';

  const statusLabel = isProcessing
    ? 'Generating SOAP Note…'
    : isRecording
      ? `Recording  ${formatTime(elapsedSeconds)}`
      : wakeState === 'LISTENING'
        ? 'Say "Hey Nesh" to begin'
        : wakeState === 'WAKE_DETECTED'
          ? 'Wake word detected!'
          : wakeState === 'STOP_DETECTED'
            ? 'Stopping recording…'
            : 'Initialising…';

  const statusSub = isProcessing
    ? 'LLaMA 3 is analysing your consultation'
    : isRecording
      ? 'Say "Hey Nesh stop" or tap End Session'
      : wakeState === 'LISTENING'
        ? 'MediScribe is listening in the background'
        : 'Ambient AI Clinical Scribe';

  const statusColor = isProcessing           ? '#f59e0b'
                    : isRecording             ? '#00d4aa'
                    : wakeState === 'LISTENING' ? '#4a9eff'
                    : '#4a5568';

  return (
    <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16 }}>

      {/* ── Ring canvas ─────────────────────────────────────────────────── */}
      <View style={{
        width:             200,
        height:            200,
        alignItems:        'center',
        justifyContent:    'center',
        marginBottom:      8,
      }}>
        {/* Outermost ripple rings (recording only) */}
        {isRecording && (
          <>
            <RippleRing delay={0}    color={ringColor} />
            <RippleRing delay={600}  color={ringColor} />
            <RippleRing delay={1200} color={ringColor} />
          </>
        )}

        {/* Breathe ring (listening idle) */}
        {wakeState === 'LISTENING' && !isRecording && !isProcessing && (
          <BreathePulse color={ringColor} />
        )}

        {/* Spin ring (processing) */}
        {isProcessing && <SpinRing color={ringColor} />}

        {/* Core circle */}
        <View style={{
          width:           120,
          height:          120,
          borderRadius:    60,
          backgroundColor: '#0d1425',
          alignItems:      'center',
          justifyContent:  'center',
          borderWidth:     2,
          borderColor:     ringColor,
        }}>
          <CoreGlow color={ringColor} active={isRecording || isProcessing} />
          <Text style={{ fontSize: 52 }}>{icon}</Text>
        </View>
      </View>

      {/* ── Status label ────────────────────────────────────────────────── */}
      <Text style={{
        color:      statusColor,
        fontSize:   17,
        fontWeight: '700',
        marginBottom: 6,
        letterSpacing: 0.2,
      }}>
        {statusLabel}
      </Text>

      <Text style={{
        color:       '#4a5568',
        fontSize:    13,
        textAlign:   'center',
        paddingHorizontal: 40,
        lineHeight:  18,
      }}>
        {statusSub}
      </Text>

      {/* ── Live pill + chunk counter ────────────────────────────────────── */}
      {isRecording && (
        <View style={{
          flexDirection:  'row',
          alignItems:     'center',
          gap:            12,
          marginTop:      16,
        }}>
          {/* LIVE pill */}
          <View style={{
            backgroundColor:  '#ff444415',
            borderRadius:     20,
            paddingHorizontal: 12,
            paddingVertical:  5,
            flexDirection:    'row',
            alignItems:       'center',
            gap:              6,
            borderWidth:      1,
            borderColor:      '#ff444440',
          }}>
            <View style={{
              width:           7,
              height:          7,
              borderRadius:    4,
              backgroundColor: '#ff4444',
            }} />
            <Text style={{ color: '#ff4444', fontSize: 12, fontWeight: '800' }}>
              LIVE
            </Text>
          </View>

          {/* Chunk counter */}
          {chunkCount > 0 && (
            <View style={{
              backgroundColor:  '#4a9eff15',
              borderRadius:     20,
              paddingHorizontal: 12,
              paddingVertical:  5,
              borderWidth:      1,
              borderColor:      '#4a9eff30',
            }}>
              <Text style={{ color: '#4a9eff', fontSize: 12, fontWeight: '600' }}>
                {chunkCount} {chunkCount === 1 ? 'segment' : 'segments'} captured
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Processing progress hint ─────────────────────────────────────── */}
      {isProcessing && (
        <View style={{
          marginTop:        16,
          backgroundColor:  '#f59e0b10',
          borderRadius:     12,
          paddingHorizontal: 20,
          paddingVertical:  10,
          borderWidth:      1,
          borderColor:      '#f59e0b30',
        }}>
          <Text style={{ color: '#f59e0b', fontSize: 13, textAlign: 'center' }}>
            ⏱ Usually takes 8–15 seconds
          </Text>
        </View>
      )}
    </View>
  );
}
