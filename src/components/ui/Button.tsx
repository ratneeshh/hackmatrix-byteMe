import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const BG: Record<Variant, string> = {
  primary: '#00d4aa',
  danger:  '#ff444420',
  ghost:   'transparent',
  outline: '#111827',
};

const BORDER: Record<Variant, string> = {
  primary: '#00d4aa',
  danger:  '#ff444440',
  ghost:   'transparent',
  outline: '#1a2744',
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: '#0a0f1e',
  danger:  '#ff4444',
  ghost:   '#4a9eff',
  outline: '#ffffff',
};

const PADDING: Record<Size, { paddingVertical: number; paddingHorizontal: number }> = {
  sm: { paddingVertical: 10, paddingHorizontal: 16 },
  md: { paddingVertical: 14, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },
};

const FONT_SIZE: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        PADDING[size],
        {
          backgroundColor: isDisabled ? '#1a2744' : BG[variant],
          borderColor:     isDisabled ? '#1a2744' : BORDER[variant],
        },
        style,
      ]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={TEXT_COLOR[variant]} size="small" />
      ) : (
        <Text style={[
          styles.label,
          {
            fontSize:  FONT_SIZE[size],
            color: isDisabled ? '#4a5568' : TEXT_COLOR[variant],
          },
          textStyle,
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});