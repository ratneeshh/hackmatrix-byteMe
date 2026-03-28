import { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { TranscriptChunk } from '../../shared/types/db';

interface LiveTranscriptProps {
  chunks: TranscriptChunk[];
  isRecording: boolean;
}

function speakerColor(label: string): string {
  switch (label) {
    case 'DOCTOR':  return '#4a9eff';
    case 'PATIENT': return '#00d4aa';
    default:        return '#a78bfa';
  }
}

export function LiveTranscript({ chunks, isRecording }: LiveTranscriptProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom on new chunks
  useEffect(() => {
    if (chunks.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [chunks.length]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: isRecording ? '#00d4aa' : '#4a5568' }]} />
        <Text style={styles.headerText}>LIVE TRANSCRIPT</Text>
        <Text style={styles.chunkCount}>{chunks.length} chunks</Text>
      </View>

      {/* Transcript body */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {chunks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🩺</Text>
            <Text style={styles.emptyText}>
              {isRecording
                ? 'Transcription will appear here...'
                : 'Say "Hey Nesh" to start recording'}
            </Text>
          </View>
        ) : (
          chunks.map((chunk) => (
            <View key={chunk.id} style={styles.chunk}>
              <Text style={[styles.speaker, { color: speakerColor(chunk.speaker_label) }]}>
                [{chunk.speaker_label}]
              </Text>
              <Text style={styles.text}>{chunk.text}</Text>
              <Text style={styles.confidence}>
                {Math.round(chunk.confidence * 100)}% confidence
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a2744',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2744',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  headerText: {
    color: '#8892a4', fontSize: 13, fontWeight: '600',
  },
  chunkCount: {
    color: '#4a5568', fontSize: 12, marginLeft: 'auto',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  empty: {
    alignItems: 'center', paddingVertical: 40,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyText: {
    color: '#4a5568', fontSize: 14, textAlign: 'center',
  },
  chunk: { marginBottom: 14 },
  speaker: {
    fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 3,
  },
  text: {
    color: '#e2e8f0', fontSize: 15, lineHeight: 22,
  },
  confidence: {
    color: '#2d3748', fontSize: 11, marginTop: 3,
  },
});