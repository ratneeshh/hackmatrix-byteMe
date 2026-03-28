import { View, Text, StyleSheet } from 'react-native';

interface DayCount {
  date: string;
  count: number;
}

interface AnalyticsChartProps {
  data: DayCount[];
  height?: number;
}

export function AnalyticsChart({ data, height = 100 }: AnalyticsChartProps) {
  if (!data?.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <View style={[styles.chart, { height: height + 28 }]}>
      {/* Bars */}
      <View style={[styles.barsRow, { height }]}>
        {data.map((day, i) => {
          const barH = Math.max(6, (day.count / maxCount) * (height - 20));
          const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
          return (
            <View key={i} style={styles.barCol}>
              {day.count > 0 && (
                <Text style={styles.barValue}>{day.count}</Text>
              )}
              <View style={[styles.bar, { height: barH }]} />
              <Text style={styles.barLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#4a5568', fontSize: 14 },
  chart: { width: '100%' },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barCol: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
  },
  barValue: {
    color: '#00d4aa', fontSize: 11, fontWeight: '700', marginBottom: 2,
  },
  bar: {
    width: '100%', backgroundColor: '#00d4aa',
    borderRadius: 4, opacity: 0.85,
  },
  barLabel: {
    color: '#4a5568', fontSize: 10, marginTop: 6,
  },
});