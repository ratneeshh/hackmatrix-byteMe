import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSessionStore } from '../../../store/sessionStore';
import { useSession } from '../../../hooks/useSession';
import { useFHIRBundle } from '../../../hooks/useFHIRBundle';
import { SOAPNote } from '../../../components/SOAPNote';
import { FHIRBundleViewer } from '../../../components/FHIRBundleViewer';
import { PrescriptionPDF } from '../../../components/PrescriptionPDF';

type Tab = 'soap' | 'fhir' | 'pdf';
const TABS: Tab[] = ['soap', 'fhir', 'pdf'];
const TAB_LABEL: Record<Tab, string> = {
  soap: '📋 SOAP',
  fhir: '🏥 FHIR',
  pdf:  '📄 PDF',
};

export default function ReviewScreen() {
  const router = useRouter();
  const { soapNote, fhirBundle, pdfUrl, sessionId, status } = useSessionStore();
  const { finaliseSession } = useSession();

  // Fallback fetch for FHIR bundle if Realtime event was missed
  useFHIRBundle(sessionId);

  const [activeTab, setActiveTab]       = useState<Tab>('soap');
  const [edits, setEdits]               = useState<Record<string, string>>({});
  const [finalising, setFinalising]     = useState(false);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (!soapNote) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#00d4aa" size="large" />
        <Text style={styles.loadingText}>Loading SOAP note...</Text>
      </View>
    );
  }

  // ─── Collect inline edits from SOAPNote component ─────────────────────────
  const handleEdit = (field: string, value: string) => {
    setEdits(prev => ({ ...prev, [field]: value }));
  };

  // ─── Finalise ──────────────────────────────────────────────────────────────
  const handleFinalise = async () => {
    setFinalising(true);
    const pdfUrl = await finaliseSession(edits);
    setFinalising(false);

    if (pdfUrl !== null) {
      Alert.alert(
        '✅ Session Complete!',
        'SOAP note finalised. Prescription PDF is ready.',
        [
          {
            text: 'View History',
            onPress: () => router.replace('/(app)/history'),
          },
        ]
      );
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review & Finalise</Text>
        <Text style={styles.subtitle}>Review AI-generated notes before finalising</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABEL[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── SOAP Tab ── */}
        {activeTab === 'soap' && (
          <SOAPNote
            note={soapNote}
            onEdit={handleEdit}
            readOnly={status === 'COMPLETE'}
          />
        )}

        {/* ── FHIR Tab ── */}
        {activeTab === 'fhir' && (
          <View>
            {fhirBundle ? (
              <>
                <View style={styles.fhirBanner}>
                  <Text style={{ fontSize: 20 }}>✅</Text>
                  <View>
                    <Text style={styles.fhirBannerTitle}>FHIR R4 Bundle Ready</Text>
                    <Text style={styles.fhirBannerSub}>
                      {fhirBundle.resource_types?.join(' · ')}
                    </Text>
                  </View>
                </View>
                <FHIRBundleViewer bundle={fhirBundle.bundle} />
              </>
            ) : (
              <View style={styles.centred}>
                <ActivityIndicator color="#00d4aa" />
                <Text style={styles.centredText}>Generating FHIR R4 bundle...</Text>
              </View>
            )}
          </View>
        )}

        {/* ── PDF Tab ── */}
        {activeTab === 'pdf' && (
          <PrescriptionPDF
            pdfUrl={pdfUrl}
            loading={!pdfUrl && status !== 'COMPLETE'}
          />
        )}

        {/* Space for sticky footer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Finalise button — hidden once session is COMPLETE */}
      {status !== 'COMPLETE' && (
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleFinalise}
            disabled={finalising}
            style={styles.finaliseBtn}
          >
            {finalising ? (
              <ActivityIndicator color="#0a0f1e" />
            ) : (
              <Text style={styles.finaliseBtnText}>✅ Finalise & Save</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#0a0f1e' },
  loading:      { flex: 1, backgroundColor: '#0a0f1e', alignItems: 'center', justifyContent: 'center' },
  loadingText:  { color: '#4a5568', marginTop: 16, fontSize: 15 },

  header: {
    paddingTop: 60, paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a2744',
  },
  back:     { color: '#4a5568', fontSize: 15 },
  title:    { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#4a5568', fontSize: 13, marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 24, paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1, borderColor: '#1a2744',
  },
  tabActive:     { backgroundColor: '#00d4aa20', borderColor: '#00d4aa' },
  tabText:       { color: '#4a5568', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: '#00d4aa' },

  scrollContent: { padding: 24, paddingTop: 8 },

  fhirBanner: {
    backgroundColor: '#00d4aa20', borderRadius: 12,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#00d4aa40',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  fhirBannerTitle: { color: '#00d4aa', fontSize: 14, fontWeight: '700' },
  fhirBannerSub:   { color: '#4a9eff', fontSize: 12, marginTop: 2 },

  centred:     { alignItems: 'center', paddingVertical: 60, gap: 16 },
  centredText: { color: '#4a5568', fontSize: 14, marginTop: 16 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24,
    backgroundColor: '#0a0f1e',
    borderTopWidth: 1, borderTopColor: '#1a2744',
  },
  finaliseBtn: {
    backgroundColor: '#00d4aa', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  finaliseBtnText: { color: '#0a0f1e', fontSize: 17, fontWeight: '800' },
});