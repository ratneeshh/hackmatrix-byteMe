import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Patient } from '../../shared/types/db';
import { usePatientSearch } from '../api/patient.queries';

interface PatientSearchProps {
  onSelect: (patient: Patient) => void;
  selectedPatient: Patient | null;
}

export function PatientSearch({ onSelect, selectedPatient }: PatientSearchProps) {
  const [query, setQuery] = useState(selectedPatient?.name ?? '');

  const { data: results, isFetching } = usePatientSearch(query);

  return (
    <View>
      <Text style={styles.label}>SEARCH PATIENT</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Type patient name..."
        placeholderTextColor="#4a5568"
        style={styles.input}
      />

      {isFetching && (
        <ActivityIndicator color="#00d4aa" style={{ marginBottom: 12 }} />
      )}

      {results?.map((p) => (
        <TouchableOpacity
          key={p.id}
          onPress={() => { onSelect(p); setQuery(p.name); }}
          style={[
            styles.result,
            selectedPatient?.id === p.id && styles.resultSelected,
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{p.name}</Text>
            <Text style={styles.patientMeta}>{p.age}y · {p.gender}</Text>
          </View>
          {selectedPatient?.id === p.id && (
            <Text style={styles.check}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#8892a4', fontSize: 12, fontWeight: '600',
    letterSpacing: 1, marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2744',
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#ffffff', fontSize: 15, marginBottom: 12,
  },
  result: {
    backgroundColor: '#111827', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#1a2744',
    flexDirection: 'row', alignItems: 'center',
  },
  resultSelected: {
    backgroundColor: '#00d4aa20', borderColor: '#00d4aa',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a2744',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#00d4aa', fontSize: 16, fontWeight: '700' },
  patientName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  patientMeta: { color: '#4a5568', fontSize: 13 },
  check: { color: '#00d4aa', fontSize: 18 },
});