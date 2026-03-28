import { View, Text, StyleSheet } from 'react-native';
import { Medication } from '../../shared/types/db';

interface MedicationCardProps {
  medication: Medication;
  index?: number;
}

export function MedicationCard({ medication: med, index }: MedicationCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{(index ?? 0) + 1}</Text>
        </View>
        <Text style={styles.name}>{med.name}</Text>
      </View>

      <View style={styles.badges}>
        <PillBadge label={med.dosage}     color="#00d4aa" />
        <PillBadge label={med.frequency}  color="#4a9eff" />
        <PillBadge label={med.duration}   color="#a78bfa" />
      </View>

      {med.notes ? (
        <Text style={styles.notes}>{med.notes}</Text>
      ) : null}
    </View>
  );
}

function PillBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a0f1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a2744',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  numberBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1a2744',
    alignItems: 'center', justifyContent: 'center',
  },
  numberText: { color: '#4a9eff', fontSize: 12, fontWeight: '700' },
  name: { color: '#ffffff', fontSize: 15, fontWeight: '700', flex: 1 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  notes: { color: '#4a5568', fontSize: 12, marginTop: 8 },
});