import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Vibration
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function PinScreen() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode: 'otp' | 'pin' }>();
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'otp' | 'pin'>(mode === 'pin' ? 'pin' : 'otp');
  const { verifyOTP, verifyPin, loading, error } = useAuth();

  const PIN_LENGTH = 6;

  const handleOTPVerify = async () => {
    if (otp.length !== 6) return;
    await verifyOTP(phone, otp);
  };

  const handlePinVerify = async () => {
    if (pin.length !== PIN_LENGTH) return;
    const result = await verifyPin(pin);
    if (!result.success) {
      Vibration.vibrate(400);
      setPin('');
    }
  };

  const renderDots = (value: string, length: number) => (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 32 }}>
      {Array.from({ length }).map((_, i) => (
        <View key={i} style={{
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: i < value.length ? '#00d4aa' : '#1a2744',
          borderWidth: 1, borderColor: i < value.length ? '#00d4aa' : '#2d3748',
        }} />
      ))}
    </View>
  );

  const renderNumpad = (value: string, setValue: (v: string) => void, maxLen: number, onComplete: () => void) => (
    <View style={{ paddingHorizontal: 32 }}>
      {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']].map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          {row.map((key, ki) => (
            <TouchableOpacity
              key={ki}
              onPress={() => {
                if (key === '⌫') {
                  setValue(value.slice(0, -1));
                } else if (key === '') {
                  // empty
                } else if (value.length < maxLen) {
                  const next = value + key;
                  setValue(next);
                  if (next.length === maxLen) onComplete();
                }
              }}
              style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: key === '' ? 'transparent' : '#111827',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: key === '' ? 0 : 1, borderColor: '#1a2744',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '600' }}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e', paddingTop: 80 }}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff' }}>
          {step === 'otp' ? 'Enter OTP' : 'Enter PIN'}
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          {step === 'otp'
            ? `OTP sent to ${phone}`
            : 'Enter your 6-digit MediScribe PIN'}
        </Text>
      </View>

      {error && (
        <Text style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
          {error}
        </Text>
      )}

      {step === 'otp' ? (
        <>
          {renderDots(otp, 6)}
          {renderNumpad(otp, setOtp, 6, handleOTPVerify)}
        </>
      ) : (
        <>
          {renderDots(pin, PIN_LENGTH)}
          {renderNumpad(pin, setPin, PIN_LENGTH, handlePinVerify)}
        </>
      )}

      {loading && (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 16 }} />
      )}
    </View>
  );
}