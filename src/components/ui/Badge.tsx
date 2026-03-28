import { View, Text, StyleSheet } from 'react-native';

interface BadgeProps {
  label: string;
  color?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color = '#00d4aa', size = 'md' }: BadgeProps) {
  return (
    <View style={[
      styles.badge,
      size === 'sm' ? styles.sm : styles.md,
      { backgroundColor: `${color}20`, borderColor: `${color}40` },
    ]}>
      <Text style={[styles.text, { color, fontSize: size === 'sm' ? 11 : 12 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontWeight: '700' },
});