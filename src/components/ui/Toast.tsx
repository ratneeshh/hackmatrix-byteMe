/**
 * Toast.tsx
 * Simple imperative toast — call Toast.show({ message }) from anywhere.
 * Wrap your app root in <ToastProvider /> to render the toast layer.
 *
 * Usage:
 *   import { toast } from '../components/ui/Toast';
 *   toast.show({ message: 'Session saved!', type: 'success' });
 */

import { useRef, useState, useCallback, createContext, useContext } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  show: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const BG: Record<ToastType, string> = {
  success: '#00d4aa20',
  error:   '#ff444420',
  info:    '#4a9eff20',
};
const BORDER: Record<ToastType, string> = {
  success: '#00d4aa60',
  error:   '#ff444460',
  info:    '#4a9eff60',
};
const TEXT: Record<ToastType, string> = {
  success: '#00d4aa',
  error:   '#ff4444',
  info:    '#4a9eff',
};
const ICON: Record<ToastType, string> = {
  success: '✅',
  error:   '❌',
  info:    'ℹ️',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts]       = useState<ToastOptions>({ message: '', type: 'info' });
  const anim                  = useRef(new Animated.Value(0)).current;
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((options: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpts({ type: 'info', duration: 3000, ...options });
    setVisible(true);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    timerRef.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setVisible(false)
      );
    }, options.duration ?? 3000);
  }, []);

  const type = opts.type ?? 'info';

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: BG[type],
              borderColor:     BORDER[type],
              opacity:         anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.icon}>{ICON[type]}</Text>
          <Text style={[styles.message, { color: TEXT[type] }]}>{opts.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 10,
    zIndex: 9999,
  },
  icon:    { fontSize: 18 },
  message: { fontSize: 14, fontWeight: '600', flex: 1 },
});