// Input.tsx
import {
  TextInput, View, Text, StyleSheet,
  TextInputProps, ViewStyle,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  prefix?: string;
}

export function Input({ label, error, containerStyle, prefix, style, ...rest }: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>{label.toUpperCase()}</Text>
      ) : null}
      <View style={[styles.row, error ? styles.rowError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor="#4a5568"
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    color: '#8892a4', fontSize: 12, fontWeight: '600',
    letterSpacing: 1, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 12,
    borderWidth: 1, borderColor: '#1a2744',
  },
  rowError: { borderColor: '#ff4444' },
  prefix: {
    color: '#ffffff', fontSize: 15, fontWeight: '600',
    paddingHorizontal: 14, paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: '#1a2744',
  },
  input: {
    flex: 1, color: '#ffffff', fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  error: {
    color: '#ff4444', fontSize: 12, marginTop: 4,
  },
});