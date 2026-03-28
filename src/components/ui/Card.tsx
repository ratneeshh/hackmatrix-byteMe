import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Highlight the card border with an accent colour */
  accent?: string;
  padding?: number;
}

export function Card({ children, style, accent, padding = 16 }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { padding, borderColor: accent ?? '#1a2744' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
});