import type { CapacitorConfig } from '@capacitor/cli';

/**
 * SATZIO – Capacitor-Konfiguration.
 *
 * Die App lädt den Web-Build aus apps/web/dist (lokal im App-Bundle, kein Remote-Server).
 * Die API-URL wird beim Web-Build über VITE_API_URL fest eingebaut (siehe README.md).
 * Origin der WebView: Android → https://localhost, iOS → capacitor://localhost
 * (beide Origins sind in der API per CORS erlaubt).
 */
const config: CapacitorConfig = {
  appId: 'de.satzio.app',
  appName: 'SATZIO',
  webDir: '../web/dist',
  backgroundColor: '#0B0F0E',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0B0F0E',
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#0B0F0E',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#0B0F0E',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    LocalNotifications: {
      // Monochromes Statusleisten-Icon (android/app/src/main/res/drawable/ic_stat_satzio.xml)
      smallIcon: 'ic_stat_satzio',
      iconColor: '#B7FF3C',
    },
    Keyboard: {
      // iOS: WebView wird nativ verkleinert, keine Zubehörleiste über der Tastatur
      resize: 'native',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // "DARK" = helle Schrift für dunklen Hintergrund
      style: 'DARK',
      backgroundColor: '#0B0F0E',
      overlaysWebView: false,
    },
  },
};

export default config;
