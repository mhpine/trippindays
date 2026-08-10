import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trippindays.app',
  appName: 'TrippinDays',
  webDir: 'public',
  server: {
    url: 'https://www.trippindays.com',
    cleartext: false,
  },
};

export default config;