import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const { requestOTP, loading, error } = useAuth();
  const router = useRouter();

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    const result = await requestOTP(phone);
    if (result.success) {
      router.push({ pathname: '/(auth)/pin', params: { phone: result.phone, mode: 'otp' } });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>

        {/* Logo + Title */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: '#00d4aa20', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16,
            borderWidth: 1, borderColor: '#00d4aa40'
          }}>
            <Text style={{ fontSize: 32 }}>🩺</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>
            MediScribe
          </Text>
          <Text style={{ fontSize: 14, color: '#4a9eff', marginTop: 4, fontWeight: '500' }}>
            Ambient AI Clinical Scribe
          </Text>
        </View>

        {/* Phone Input */}
        <Text style={{ color: '#8892a4', fontSize: 13, fontWeight: '600',
          letterSpacing: 1, marginBottom: 8 }}>
          MOBILE NUMBER
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#111827', borderRadius: 12,
          borderWidth: 1, borderColor: '#1a2744',
          marginBottom: 8,
        }}>
          <View style={{
            paddingHorizontal: 16, paddingVertical: 16,
            borderRightWidth: 1, borderRightColor: '#1a2744'
          }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>🇮🇳 +91</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter mobile number"
            placeholderTextColor="#4a5568"
            keyboardType="phone-pad"
            maxLength={10}
            style={{
              flex: 1, paddingHorizontal: 16, paddingVertical: 16,
              color: '#ffffff', fontSize: 16, letterSpacing: 1,
            }}
          />
        </View>

        {error && (
          <Text style={{ color: '#ff4444', fontSize: 13, marginBottom: 12 }}>{error}</Text>
        )}

        {/* Send OTP Button */}
        <TouchableOpacity
          onPress={handleSendOTP}
          disabled={loading || phone.length !== 10}
          style={{
            backgroundColor: phone.length === 10 ? '#00d4aa' : '#1a2744',
            paddingVertical: 16, borderRadius: 12,
            alignItems: 'center', marginTop: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0a0f1e" />
          ) : (
            <Text style={{
              color: phone.length === 10 ? '#0a0f1e' : '#4a5568',
              fontSize: 16, fontWeight: '700'
            }}>
              Send OTP →
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: '#4a5568', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
          By continuing, you agree to MediScribe's{'\n'}
          <Text style={{ color: '#4a9eff' }}>Terms of Service</Text> and{' '}
          <Text style={{ color: '#4a9eff' }}>Privacy Policy</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}