import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../api/supabase';
import { SessionSummary } from '../../../../shared/types/api';

export default function HistoryScreen() {
  const router = useRouter();

  const { data: sessions, isLoading } = useQuery<SessionSummary[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sessions', {
        body: undefined,
      });
      if (error) throw error;
      return data?.data ?? [];
    },
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE': return '#00d4aa';
      case 'REVIEW': return '#4a9eff';
      case 'PROCESSING': return '#f59e0b';
      case 'FAILED': return '#ff4444';
      default: return '#4a5568';
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 4 }}>
        Session History
      </Text>
      <Text style={{ color: '#4a5568', fontSize: 14, marginBottom: 24 }}>
        All your past consultations
      </Text>

      {isLoading ? (
        <ActivityIndicator color="#00d4aa" style={{ marginTop: 40 }} />
      ) : sessions?.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
          <Text style={{ color: '#4a5568', fontSize: 16, textAlign: 'center' }}>
            No sessions yet.{'\n'}Start your first consultation!
          </Text>
        </View>
      ) : (
        sessions?.map((session, i) => (
          <TouchableOpacity
            key={session.id}
            onPress={() => router.push({
              pathname: '/(app)/history/[id]',
              params: { id: session.id }
            })}
            style={{
              backgroundColor: '#111827', borderRadius: 16,
              padding: 16, marginBottom: 12,
              borderWidth: 1, borderColor: '#1a2744',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                  {session.patient_name}
                </Text>
                <Text style={{ color: '#4a5568', fontSize: 13, marginTop: 2 }}>
                  {formatDate(session.started_at)}
                </Text>
              </View>
              <View style={{
                backgroundColor: `${statusColor(session.status)}20`,
                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{
                  color: statusColor(session.status),
                  fontSize: 11, fontWeight: '700'
                }}>
                  {session.status}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#4a5568', fontSize: 12 }}>⏱</Text>
                <Text style={{ color: '#8892a4', fontSize: 13 }}>
                  {formatDuration(session.duration_seconds)}
                </Text>
              </View>
              {session.top_diagnosis && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                  <Text style={{ color: '#4a5568', fontSize: 12 }}>🏷</Text>
                  <Text style={{ color: '#8892a4', fontSize: 13 }} numberOfLines={1}>
                    {session.top_diagnosis}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}