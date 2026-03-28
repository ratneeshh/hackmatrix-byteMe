import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function VerifyScreen() {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [name, setName] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [city, setCity] = useState('');
  const { setPin: savePin, loading, error } = useAuth();

  const isValid = pin.length === 6 && pin === confirmPin &&
    name && speciality && clinicName && city;

  const handleSubmit = async () => {
    if (!isValid) return;
    await savePin(pin, { name, speciality, clinic_name: clinicName, city });
  };

  const inputStyle = {
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2744',
    paddingHorizontal: 16, paddingVertical: 14,
    color: '#ffffff', fontSize: 15, marginBottom: 12,
  };

  const labelStyle = {
    color: '#8892a4', fontSize: 12, fontWeight: '600' as const,
    letterSpacing: 1, marginBottom: 6,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
    >
      <ScrollView contentContainerStyle={{ padding: 32, paddingTop: 60 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 4 }}>
          Complete Profile
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 14, marginBottom: 32 }}>
          Set up your doctor profile and create a PIN
        </Text>

        <Text style={labelStyle}>FULL NAME</Text>
        <TextInput
          value={name} onChangeText={setName}
          placeholder="Dr. Ratnesh Kumar" placeholderTextColor="#4a5568"
          style={inputStyle}
        />

        <Text style={labelStyle}>SPECIALITY</Text>
        <TextInput
          value={speciality} onChangeText={setSpeciality}
          placeholder="General Physician" placeholderTextColor="#4a5568"
          style={inputStyle}
        />

        <Text style={labelStyle}>CLINIC NAME</Text>
        <TextInput
          value={clinicName} onChangeText={setClinicName}
          placeholder="City Care Clinic" placeholderTextColor="#4a5568"
          style={inputStyle}
        />

        <Text style={labelStyle}>CITY</Text>
        <TextInput
          value={city} onChangeText={setCity}
          placeholder="Patna" placeholderTextColor="#4a5568"
          style={inputStyle}
        />

        <Text style={labelStyle}>CREATE 6-DIGIT PIN</Text>
        <TextInput
          value={pin} onChangeText={setPin}
          placeholder="••••••" placeholderTextColor="#4a5568"
          secureTextEntry keyboardType="numeric" maxLength={6}
          style={inputStyle}
        />

        <Text style={labelStyle}>CONFIRM PIN</Text>
        <TextInput
          value={confirmPin} onChangeText={setConfirmPin}
          placeholder="••••••" placeholderTextColor="#4a5568"
          secureTextEntry keyboardType="numeric" maxLength={6}
          style={inputStyle}
        />

        {pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin && (
          <Text style={{ color: '#ff4444', fontSize: 13, marginBottom: 12 }}>
            PINs do not match
          </Text>
        )}

        {error && (
          <Text style={{ color: '#ff4444', fontSize: 13, marginBottom: 12 }}>{error}</Text>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isValid || loading}
          style={{
            backgroundColor: isValid ? '#00d4aa' : '#1a2744',
            paddingVertical: 16, borderRadius: 12,
            alignItems: 'center', marginTop: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0a0f1e" />
          ) : (
            <Text style={{
              color: isValid ? '#0a0f1e' : '#4a5568',
              fontSize: 16, fontWeight: '700'
            }}>
              Create Account →
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}