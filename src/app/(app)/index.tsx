import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../api/supabase';
import { useQuery } from '@tanstack/react-query';
import { AnalyticsSummary } from '../../../shared/types/api';

export default function HomeScreen() {
  const { doctor } = useAuthStore();
  const router = useRouter();

  const { data: stats, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analytics/summary');
      if (error) throw error;
      return data;
    },
    enabled: !!doctor,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      {/* Header */}
      <View style={{ marginBottom: 32 }}>
        <Text style={{ color: '#4a9eff', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
          {greeting().toUpperCase()}
        </Text>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginTop: 4 }}>
          Dr. {doctor?.name?.split(' ').slice(-1)[0] ?? 'Doctor'} 👋
        </Text>
        <Text style={{ color: '#4a5568', fontSize: 14, marginTop: 2 }}>
          {doctor?.clinic_name} · {doctor?.speciality}
        </Text>
      </View>

      {/* New Session CTA */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/session/new')}
        style={{
          backgroundColor: '#00d4aa',
          borderRadius: 20, padding: 24,
          marginBottom: 24,
          shadowColor: '#00d4aa',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 36, marginBottom: 8 }}>🎙️</Text>
        <Text style={{ color: '#0a0f1e', fontSize: 20, fontWeight: '800' }}>
          Start New Session
        </Text>
        <Text style={{ color: '#0a0f1e80', fontSize: 14, marginTop: 4, fontWeight: '500' }}>
          Say "Hey Nesh" to begin recording
        </Text>
      </TouchableOpacity>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <StatCard
          label="Today"
          value={isLoading ? '...' : String(stats?.sessions_today ?? 0)}
          unit="sessions"
          color="#4a9eff"
        />
        <StatCard
          label="Avg Time"
          value={isLoading ? '...' : String(Math.round((stats?.avg_duration_seconds ?? 0) / 60))}
          unit="minutes"
          color="#00d4aa"
        />
        <StatCard
          label="Total"
          value={isLoading ? '...' : String(stats?.total_sessions ?? 0)}
          unit="all time"
          color="#a78bfa"
        />
      </View>

      {/* Top Diagnoses */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        padding: 20, borderWidth: 1, borderColor: '#1a2744'
      }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
          Top Diagnoses This Week
        </Text>
        {isLoading ? (
          <ActivityIndicator color="#00d4aa" />
        ) : stats?.top_diagnoses?.length ? (
          stats.top_diagnoses.slice(0, 5).map((d, i) => (
            <View key={i} style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', paddingVertical: 8,
              borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: '#1a2744'
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                  {d.name}
                </Text>
                <Text style={{ color: '#4a5568', fontSize: 12 }}>{d.icd10}</Text>
              </View>
              <View style={{
                backgroundColor: '#00d4aa20', borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 4
              }}>
                <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '700' }}>
                  {d.count}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: '#4a5568', fontSize: 14, textAlign: 'center', paddingVertical: 8 }}>
            No sessions yet. Start your first consultation! 🩺
          </Text>
        )}
      </View>

      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <TouchableOpacity
          onPress={() => router.push('/(app)/history/')}
          style={{
            flex: 1, backgroundColor: '#111827', borderRadius: 16,
            padding: 16, alignItems: 'center',
            borderWidth: 1, borderColor: '#1a2744'
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>📋</Text>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(app)/analytics')}
          style={{
            flex: 1, backgroundColor: '#111827', borderRadius: 16,
            padding: 16, alignItems: 'center',
            borderWidth: 1, borderColor: '#1a2744'
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>📊</Text>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings')}
          style={{
            flex: 1, backgroundColor: '#111827', borderRadius: 16,
            padding: 16, alignItems: 'center',
            borderWidth: 1, borderColor: '#1a2744'
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>⚙️</Text>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// Stat Card Component
function StatCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#111827', borderRadius: 16,
      padding: 16, alignItems: 'center',
      borderWidth: 1, borderColor: '#1a2744'
    }}>
      <Text style={{ color: '#4a5568', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, marginBottom: 4 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color, fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: '#4a5568', fontSize: 11, marginTop: 2 }}>{unit}</Text>
    </View>
  );
}