import { View, Text, TouchableOpacity, Linking, StyleSheet, ActivityIndicator } from 'react-native';

interface PrescriptionPDFProps {
  pdfUrl: string | null;
  loading?: boolean;
}

export function PrescriptionPDF({ pdfUrl, loading = false }: PrescriptionPDFProps) {
  const handleOpen = () => {
    if (pdfUrl) Linking.openURL(pdfUrl);
  };

  if (loading || !pdfUrl) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#00d4aa" />
        <Text style={styles.waitingText}>
          {loading ? 'Generating prescription PDF...' : 'PDF not available yet'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.ready}>
      <Text style={styles.icon}>📄</Text>
      <Text style={styles.title}>Prescription Ready</Text>
      <Text style={styles.subtitle}>
        Download the prescription PDF to share with the patient
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleOpen}>
        <Text style={styles.buttonText}>📥 Download PDF</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  waiting: {
    alignItems: 'center', paddingVertical: 60, gap: 16,
  },
  waitingText: { color: '#4a5568', fontSize: 14 },
  ready: {
    alignItems: 'center', paddingVertical: 40,
  },
  icon:     { fontSize: 48, marginBottom: 16 },
  title:    { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  subtitle: {
    color: '#4a5568', fontSize: 14, marginBottom: 24, textAlign: 'center',
  },
  button: {
    backgroundColor: '#00d4aa', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  buttonText: { color: '#0a0f1e', fontSize: 16, fontWeight: '700' },
});