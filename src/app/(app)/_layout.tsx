// import { useEffect } from 'react';
// import { Tabs } from 'expo-router';
// import { View, Text } from 'react-native';
// import { useAuthStore } from '../../store/authStore';
// import { supabase } from '../../api/supabase';
// import { useRouter } from 'expo-router';
// import { Home, Clock, BarChart2, Settings } from 'lucide-react-native';

import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../api/supabase';
import { useRouter } from 'expo-router';
import { Home, Clock, BarChart2, Settings } from 'lucide-react-native';

export default function AppLayout() {
  const { setDoctor, setAuthenticated, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setAuthenticated(false);
          setDoctor(null);
          router.replace('/(auth)/login');
          return;
        }
        setAuthenticated(true);
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
        tabBarActiveTintColor: '#00d4aa',
        tabBarInactiveTintColor: '#4a5568',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home stroke={color} width={size} height={size} />
            ),
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Home stroke={color} width={size} height={size} />
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
      {/* Hidden screens - not shown in tab bar */}
      <Tabs.Screen name="session/new" options={{ href: null }} />
      <Tabs.Screen name="session/recording" options={{ href: null }} />
      <Tabs.Screen name="session/review" options={{ href: null }} />
      <Tabs.Screen name="history/[id]" options={{ href: null }} />
    </Tabs>
  );
}