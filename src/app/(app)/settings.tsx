import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const { doctor } = useAuthStore();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const SettingRow = ({ emoji, label, value, onPress }: {
    emoji: string; label: string; value?: string; onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#1a2744',
      }}
    >
      <Text style={{ fontSize: 18, marginRight: 12 }}>{emoji}</Text>
      <Text style={{ color: '#ffffff', fontSize: 15, flex: 1 }}>{label}</Text>
      {value && (
        <Text style={{ color: '#4a5568', fontSize: 14 }}>{value}</Text>
      )}
      {onPress && (
        <Text style={{ color: '#4a5568', fontSize: 16, marginLeft: 8 }}>›</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 24 }}>
        Settings
      </Text>

      {/* Doctor Profile Card */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 20,
        padding: 20, marginBottom: 24, alignItems: 'center',
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: '#00d4aa20', alignItems: 'center',
          justifyContent: 'center', marginBottom: 12,
          borderWidth: 2, borderColor: '#00d4aa40',
        }}>
          <Text style={{ fontSize: 28 }}>👨‍⚕️</Text>
        </View>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800' }}>
          Dr. {doctor?.name}
        </Text>
        <Text style={{ color: '#4a9eff', fontSize: 14, marginTop: 2 }}>
          {doctor?.speciality}
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 2 }}>
          {doctor?.clinic_name} · {doctor?.city}
        </Text>
      </View>

      {/* Account Settings */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        marginBottom: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#8892a4', fontSize: 11, fontWeight: '700',
          letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14,
          paddingBottom: 8 }}>
          ACCOUNT
        </Text>
        <SettingRow emoji="📱" label="Mobile" value={doctor?.mobile_number} />
        <SettingRow emoji="🔒" label="Change PIN"
          onPress={() => Alert.alert('Coming soon', 'PIN change coming soon!')} />
        <SettingRow emoji="🌐" label="Language"
          value={doctor?.preferred_language === 'en-hi' ? 'Hinglish'
            : doctor?.preferred_language === 'hi' ? 'Hindi' : 'English'} />
      </View>

      {/* App Settings */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        marginBottom: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#8892a4', fontSize: 11, fontWeight: '700',
          letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14,
          paddingBottom: 8 }}>
          APP
        </Text>
        <SettingRow emoji="🎙️" label="Wake Word" value='"Hey Nesh"' />
        <SettingRow emoji="⏱" label="Chunk Duration" value="5 seconds" />
        <SettingRow emoji="🏥" label="FHIR Version" value="R4 (4.0.1)" />
        <SettingRow emoji="🌙" label="Theme" value="Dark" />
      </View>

      {/* About */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        marginBottom: 24, overflow: 'hidden',
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#8892a4', fontSize: 11, fontWeight: '700',
          letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14,
          paddingBottom: 8 }}>
          ABOUT
        </Text>
        <SettingRow emoji="ℹ️" label="Version" value="1.0.0" />
        <SettingRow emoji="📄" label="Privacy Policy" onPress={() => {}} />
        <SettingRow emoji="⚖️" label="Terms of Service" onPress={() => {}} />
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        onPress={handleSignOut}
        style={{
          backgroundColor: '#ff444420', borderRadius: 16,
          paddingVertical: 16, alignItems: 'center',
          borderWidth: 1, borderColor: '#ff444440',
        }}
      >
        <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: '700' }}>
          Sign Out
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}