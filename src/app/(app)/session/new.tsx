import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../../hooks/useSession';
import { useCreatePatient } from '../../../api/patient.queries';
import { PatientSearch } from '../../../components/PatientSearch';
import { Patient } from '../../../../shared/types/db';

export default function NewSessionScreen() {
  const router   = useRouter();
  const { startSession } = useSession();
  const createPatient    = useCreatePatient();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewForm, setShowNewForm]          = useState(false);
  const [newName, setNewName]                  = useState('');
  const [newAge, setNewAge]                    = useState('');
  const [newGender, setNewGender]              = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [starting, setStarting]                = useState(false);

  // ─── Create new patient + start session ───────────────────────────────────
  const handleStart = async () => {
    setStarting(true);
    try {
      let patient = selectedPatient;

      // If the new-patient form is shown, create the patient first
      if (!patient && showNewForm) {
        if (!newName.trim() || !newAge.trim()) {
          Alert.alert('Missing Info', 'Please enter patient name and age.');
          return;
        }
        patient = await createPatient.mutateAsync({
          name:   newName.trim(),
          age:    parseInt(newAge, 10),
          gender: newGender,
        });
      }

      if (!patient) {
        Alert.alert('Select Patient', 'Please select or create a patient first.');
        return;
      }

      // useSession.startSession does: resetSession → setPatientId → Edge Fn call → setSessionId
      const sessionId = await startSession(patient.id);
      if (sessionId) {
        router.push('/(app)/session/recording');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const canStart = (selectedPatient !== null) || showNewForm;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 24 }}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>New Session</Text>
      <Text style={styles.subtitle}>Select a patient to begin consultation</Text>

      {/* ── Patient search (only when not showing new-form) ── */}
      {!showNewForm && (
        <>
          <PatientSearch
            selectedPatient={selectedPatient}
            onSelect={(p) => setSelectedPatient(p)}
          />

          <TouchableOpacity
            onPress={() => { setShowNewForm(true); setSelectedPatient(null); }}
            style={styles.newPatientBtn}
          >
            <Text style={styles.newPatientBtnText}>+ New Patient</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── New patient form ── */}
      {showNewForm && (
        <View>
          <View style={styles.newFormHeader}>
            <Text style={styles.newFormTitle}>New Patient</Text>
            <TouchableOpacity onPress={() => setShowNewForm(false)}>
              <Text style={styles.switchLink}>Search existing</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>PATIENT NAME</Text>
          <TextInput
            value={newName} onChangeText={setNewName}
            placeholder="Full name" placeholderTextColor="#4a5568"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>AGE</Text>
          <TextInput
            value={newAge} onChangeText={setNewAge}
            placeholder="Age in years" placeholderTextColor="#4a5568"
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>GENDER</Text>
          <View style={styles.genderRow}>
            {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setNewGender(g)}
                style={[
                  styles.genderBtn,
                  newGender === g && styles.genderBtnActive,
                ]}
              >
                <Text style={[
                  styles.genderBtnText,
                  newGender === g && styles.genderBtnTextActive,
                ]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Start button ── */}
      <TouchableOpacity
        onPress={handleStart}
        disabled={starting || createPatient.isPending || !canStart}
        style={[
          styles.startBtn,
          canStart ? styles.startBtnActive : styles.startBtnIdle,
        ]}
      >
        {(starting || createPatient.isPending) ? (
          <ActivityIndicator color="#0a0f1e" />
        ) : (
          <Text style={[
            styles.startBtnText,
            { color: canStart ? '#0a0f1e' : '#4a5568' },
          ]}>
            🎙️ Start Consultation
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: '#0a0f1e' },
  content:  { padding: 24, paddingTop: 60 },

  back:     { color: '#4a9eff', fontSize: 16, marginBottom: 24 },
  title:    { color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#4a5568', fontSize: 14, marginBottom: 32 },

  newPatientBtn: {
    borderWidth: 1, borderColor: '#1a2744', borderStyle: 'dashed',
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 8,
  },
  newPatientBtnText: { color: '#4a9eff', fontSize: 15, fontWeight: '600' },

  newFormHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  newFormTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  switchLink:   { color: '#4a9eff', fontSize: 14 },

  fieldLabel: {
    color: '#8892a4', fontSize: 12, fontWeight: '600',
    letterSpacing: 1, marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2744',
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#ffffff', fontSize: 15, marginBottom: 16,
  },

  genderRow:          { flexDirection: 'row', gap: 8, marginBottom: 16 },
  genderBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1, borderColor: '#1a2744',
  },
  genderBtnActive:     { backgroundColor: '#00d4aa20', borderColor: '#00d4aa' },
  genderBtnText:       { color: '#4a5568', fontWeight: '600', fontSize: 13 },
  genderBtnTextActive: { color: '#00d4aa' },

  startBtn: {
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 24,
  },
  startBtnActive: { backgroundColor: '#00d4aa' },
  startBtnIdle:   { backgroundColor: '#1a2744' },
  startBtnText:   { fontSize: 17, fontWeight: '800' },
});