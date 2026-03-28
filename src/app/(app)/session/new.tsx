import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../api/supabase';
import { useSessionStore } from '../../../store/sessionStore';
import { useAuthStore } from '../../../store/authStore';
import { Patient } from '../../../../shared/types/db';
import { useQuery } from '@tanstack/react-query';

export default function NewSessionScreen() {
  const router = useRouter();
  const { doctor } = useAuthStore();
  const { setSessionId, setPatientId, resetSession } = useSessionStore();

  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [starting, setStarting] = useState(false);

  // Search patients
  const { data: patients, isLoading: searching } = useQuery<Patient[]>({
    queryKey: ['patients', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .ilike('name', `%${search}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: search.length >= 2,
  });

  const createPatient = async (): Promise<Patient | null> => {
    if (!newName || !newAge) {
      Alert.alert('Missing Info', 'Please enter patient name and age.');
      return null;
    }
    const { data, error } = await supabase
      .from('patients')
      .insert({
        doctor_id: doctor!.id,
        name: newName,
        age: parseInt(newAge),
        gender: newGender,
      })
      .select()
      .single();
    if (error) { Alert.alert('Error', error.message); return null; }
    return data;
  };

  const startSession = async () => {
    setStarting(true);
    try {
      let patient = selectedPatient;
      if (!patient && showNewForm) {
        patient = await createPatient();
        if (!patient) return;
      }
      if (!patient) {
        Alert.alert('Select Patient', 'Please select or create a patient.');
        return;
      }

      resetSession();
      setPatientId(patient.id);

      const { data, error } = await supabase.functions.invoke('sessions/start', {
        body: { patient_id: patient.id, language: doctor?.preferred_language ?? 'en-hi' },
      });
      if (error) throw error;

      setSessionId(data.session_id);
      router.push('/(app)/session/recording');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2744',
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#ffffff' as const, fontSize: 15, marginBottom: 12,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 24 }}>
        <Text style={{ color: '#4a9eff', fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
        New Session
      </Text>
      <Text style={{ color: '#4a5568', fontSize: 14, marginBottom: 32 }}>
        Select a patient to begin consultation
      </Text>

      {/* Patient Search */}
      {!showNewForm && (
        <>
          <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '600',
            letterSpacing: 1, marginBottom: 8 }}>
            SEARCH PATIENT
          </Text>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Type patient name..." placeholderTextColor="#4a5568"
            style={inputStyle}
          />

          {searching && <ActivityIndicator color="#00d4aa" style={{ marginBottom: 12 }} />}

          {patients?.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { setSelectedPatient(p); setSearch(p.name); }}
              style={{
                backgroundColor: selectedPatient?.id === p.id ? '#00d4aa20' : '#111827',
                borderRadius: 12, padding: 16, marginBottom: 8,
                borderWidth: 1,
                borderColor: selectedPatient?.id === p.id ? '#00d4aa' : '#1a2744',
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: '#1a2744', alignItems: 'center',
                justifyContent: 'center', marginRight: 12,
              }}>
                <Text style={{ color: '#00d4aa', fontSize: 16, fontWeight: '700' }}>
                  {p.name[0]}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{p.name}</Text>
                <Text style={{ color: '#4a5568', fontSize: 13 }}>
                  {p.age}y · {p.gender}
                </Text>
              </View>
              {selectedPatient?.id === p.id && (
                <Text style={{ marginLeft: 'auto', color: '#00d4aa', fontSize: 18 }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => { setShowNewForm(true); setSelectedPatient(null); }}
            style={{
              borderWidth: 1, borderColor: '#1a2744', borderStyle: 'dashed',
              borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8,
            }}
          >
            <Text style={{ color: '#4a9eff', fontSize: 15, fontWeight: '600' }}>
              + New Patient
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* New Patient Form */}
      {showNewForm && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
              New Patient
            </Text>
            <TouchableOpacity onPress={() => setShowNewForm(false)}>
              <Text style={{ color: '#4a9eff' }}>Search existing</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '600',
            letterSpacing: 1, marginBottom: 8 }}>PATIENT NAME</Text>
          <TextInput value={newName} onChangeText={setNewName}
            placeholder="Full name" placeholderTextColor="#4a5568"
            style={inputStyle} />

          <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '600',
            letterSpacing: 1, marginBottom: 8 }}>AGE</Text>
          <TextInput value={newAge} onChangeText={setNewAge}
            placeholder="Age in years" placeholderTextColor="#4a5568"
            keyboardType="numeric" style={inputStyle} />

          <Text style={{ color: '#8892a4', fontSize: 12, fontWeight: '600',
            letterSpacing: 1, marginBottom: 8 }}>GENDER</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setNewGender(g)}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: newGender === g ? '#00d4aa20' : '#111827',
                  borderWidth: 1,
                  borderColor: newGender === g ? '#00d4aa' : '#1a2744',
                }}
              >
                <Text style={{
                  color: newGender === g ? '#00d4aa' : '#4a5568',
                  fontWeight: '600', fontSize: 13,
                }}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Start Button */}
      <TouchableOpacity
        onPress={startSession}
        disabled={starting || (!selectedPatient && !showNewForm)}
        style={{
          backgroundColor: (selectedPatient || showNewForm) ? '#00d4aa' : '#1a2744',
          paddingVertical: 18, borderRadius: 16,
          alignItems: 'center', marginTop: 24,
        }}
      >
        {starting ? (
          <ActivityIndicator color="#0a0f1e" />
        ) : (
          <Text style={{
            color: (selectedPatient || showNewForm) ? '#0a0f1e' : '#4a5568',
            fontSize: 17, fontWeight: '800'
          }}>
            🎙️ Start Consultation
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}