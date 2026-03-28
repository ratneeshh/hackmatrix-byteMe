import { View, Text, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../api/supabase';
import { AnalyticsSummary, AnalyticsWeekly } from '../../../shared/types/api';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { data: summary, isLoading: loadingSummary } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analytics/summary');
      if (error) throw error;
      return data;
    },
  });

  const { data: weekly, isLoading: loadingWeekly } = useQuery<AnalyticsWeekly>({
    queryKey: ['analytics-weekly'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('analytics/weekly');
      if (error) throw error;
      return data;
    },
  });

  const avgMinutes = Math.round((summary?.avg_duration_seconds ?? 0) / 60);
  const timeSavedPercent = 85;
  const manualMinutes = 8;
  const aiMinutes = Math.round(manualMinutes * (1 - timeSavedPercent / 100));

  const maxCount = Math.max(...(weekly?.daily_counts?.map(d => d.count) ?? [1]));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0f1e' }}
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 4 }}>
        Analytics
      </Text>
      <Text style={{ color: '#4a5568', fontSize: 14, marginBottom: 24 }}>
        Your clinical documentation performance
      </Text>

      {/* KPI Cards */}
      {loadingSummary ? (
        <ActivityIndicator color="#00d4aa" />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <KPICard
              label="Total Sessions"
              value={String(summary?.total_sessions ?? 0)}
              emoji="🩺"
              color="#00d4aa"
            />
            <KPICard
              label="Today"
              value={String(summary?.sessions_today ?? 0)}
              emoji="📅"
              color="#4a9eff"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <KPICard
              label="Avg Duration"
              value={`${avgMinutes}m`}
              emoji="⏱"
              color="#a78bfa"
            />
            <KPICard
              label="Time Saved"
              value={`${timeSavedPercent}%`}
              emoji="🚀"
              color="#f59e0b"
            />
          </View>
        </>
      )}

      {/* Time Saved Comparison */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
          ⚡ Documentation Speed
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: '100%', height: 80,
              backgroundColor: '#ff444430', borderRadius: 8,
              justifyContent: 'flex-end', alignItems: 'center',
              borderWidth: 1, borderColor: '#ff444460',
            }}>
              <Text style={{ color: '#ff4444', fontSize: 18, fontWeight: '800',
                paddingBottom: 8 }}>
                {manualMinutes}m
              </Text>
            </View>
            <Text style={{ color: '#4a5568', fontSize: 12, marginTop: 6 }}>Manual</Text>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 24 }}>
            <Text style={{ color: '#00d4aa', fontSize: 20, fontWeight: '800' }}>→</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: '100%',
              height: Math.round(80 * (1 - timeSavedPercent / 100)),
              backgroundColor: '#00d4aa30', borderRadius: 8,
              justifyContent: 'flex-end', alignItems: 'center',
              borderWidth: 1, borderColor: '#00d4aa60',
            }}>
              <Text style={{ color: '#00d4aa', fontSize: 18, fontWeight: '800',
                paddingBottom: 8 }}>
                {aiMinutes}m
              </Text>
            </View>
            <Text style={{ color: '#4a5568', fontSize: 12, marginTop: 6 }}>MediScribe</Text>
          </View>
        </View>
        <View style={{
          backgroundColor: '#00d4aa20', borderRadius: 10,
          padding: 12, marginTop: 16, alignItems: 'center',
        }}>
          <Text style={{ color: '#00d4aa', fontSize: 15, fontWeight: '700' }}>
            85% faster documentation 🎉
          </Text>
        </View>
      </View>

      {/* Weekly Bar Chart */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 20 }}>
          📊 Sessions This Week
        </Text>
        {loadingWeekly ? (
          <ActivityIndicator color="#00d4aa" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end',
            gap: 8, height: 100 }}>
            {weekly?.daily_counts?.map((day, i) => {
              const barHeight = maxCount > 0
                ? Math.max(8, (day.count / maxCount) * 90)
                : 8;
              const dayLabel = new Date(day.date)
                .toLocaleDateString('en-IN', { weekday: 'short' });
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#00d4aa', fontSize: 11,
                    fontWeight: '700', marginBottom: 4 }}>
                    {day.count > 0 ? day.count : ''}
                  </Text>
                  <View style={{
                    width: '100%', height: barHeight,
                    backgroundColor: '#00d4aa',
                    borderRadius: 4, opacity: 0.8,
                  }} />
                  <Text style={{ color: '#4a5568', fontSize: 10, marginTop: 6 }}>
                    {dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Top Diagnoses */}
      <View style={{
        backgroundColor: '#111827', borderRadius: 16,
        padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: '#1a2744',
      }}>
        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 16 }}>
          🏷️ Top Diagnoses
        </Text>
        {loadingSummary ? (
          <ActivityIndicator color="#00d4aa" />
        ) : summary?.top_diagnoses?.length ? (
          summary.top_diagnoses.map((d, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 10,
              borderBottomWidth: i < summary.top_diagnoses.length - 1 ? 1 : 0,
              borderBottomColor: '#1a2744',
            }}>
              <Text style={{ color: '#4a5568', fontSize: 14,
                fontWeight: '700', width: 24 }}>
                {i + 1}.
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                  {d.name}
                </Text>
                <Text style={{ color: '#4a5568', fontSize: 12 }}>{d.icd10}</Text>
              </View>
              <View style={{
                backgroundColor: '#00d4aa20', borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 4,
              }}>
                <Text style={{ color: '#00d4aa', fontSize: 13, fontWeight: '700' }}>
                  {d.count}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: '#4a5568', fontSize: 14, textAlign: 'center',
            paddingVertical: 20 }}>
            No data yet
          </Text>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function KPICard({ label, value, emoji, color }: {
  label: string; value: string; emoji: string; color: string;
}) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#0a0f1e', borderRadius: 16,
      padding: 16, alignItems: 'center',
      borderWidth: 1, borderColor: '#1a2744',
    }}>
      <Text style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: '#4a5568', fontSize: 11, marginTop: 3,
        textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}