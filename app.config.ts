import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name:        'MediScribe',
  slug:        'mediscribe',
  version:     '1.0.0',
  orientation: 'portrait',
  icon:        './assets/icon.png',
  scheme:      'mediscribe',
  userInterfaceStyle: 'dark',

  splash: {
    image:           './assets/splash-icon.png',
    resizeMode:      'contain',
    backgroundColor: '#0a0f1e',
  },

  ios: {
    supportsTablet:   false,
    bundleIdentifier: 'com.mediscribe.app',
    buildNumber:      '1',
    infoPlist: {
      // Microphone permission — required for ambient recording
      NSMicrophoneUsageDescription:
        'MediScribe needs microphone access to transcribe doctor-patient consultations.',
      // Face ID permission — optional biometric PIN shortcut
      NSFaceIDUsageDescription:
        'MediScribe uses Face ID as an alternative to your 6-digit PIN.',
    },
  },

  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#0a0f1e',
    },
    package:     'com.mediscribe.app',
    versionCode: 1,
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ],
  },

  web: {
    bundler:  'metro',
    output:   'static',
    favicon:  './assets/favicon.png',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-av',
      {
        microphonePermission:
          'MediScribe needs microphone access to transcribe consultations.',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'MediScribe uses Face ID as an alternative to your PIN.',
      },
    ],
    [
      'expo-font',
      {
        fonts: [],
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: 'YOUR_EAS_PROJECT_ID',
    },
    // These are read via process.env.EXPO_PUBLIC_* in the app
    // Set them in your .env file (never commit the real values)
    supabaseUrl:     process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
