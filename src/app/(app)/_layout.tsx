import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../api/supabase';
import { useRouter } from 'expo-router';
import { Home, Clock, BarChart2, Settings } from 'lucide-react-native';

export default function AppLayout() {
  const { setDoctor, setAuthenticated, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Hydrate doctor profile on auth state change.
    // This fires on: first mount (existing JWT), sign-in, sign-out, token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setAuthenticated(false);
          setDoctor(null);
          setLoading(false);
          router.replace('/(auth)/login');
          return;
        }

        setAuthenticated(true);

        // Fetch doctor profile so authStore.doctor is always populated
        const { data: doctor } = await supabase
          .from('doctors')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (doctor) {
          setDoctor(doctor);
        } else {
          // Doctor row doesn't exist yet → push to profile-setup screen
          router.replace('/(auth)/verify');
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0f1e',
          borderTopColor: '#1a2744',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarActiveTintColor:   '#00d4aa',
        tabBarInactiveTintColor: '#4a5568',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home stroke={color} width={size} height={size} />
          ),
        }}
      />

      {/*
        FIX: name must be "history" (the folder), NOT "history/index".
        Expo Router resolves the folder → index.tsx automatically.
        Using "history/index" causes the tab to not highlight correctly
        and breaks deep-linking from history/[id].tsx.
      */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Clock stroke={color} width={size} height={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <BarChart2 stroke={color} width={size} height={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings stroke={color} width={size} height={size} />
          ),
        }}
      />

      {/* ── Hidden screens (no tab bar entry) ── */}
      <Tabs.Screen name="session/new"       options={{ href: null }} />
      <Tabs.Screen name="session/recording" options={{ href: null }} />
      <Tabs.Screen name="session/review"    options={{ href: null }} />
      <Tabs.Screen name="history/[id]"      options={{ href: null }} />
    </Tabs>
  );
}