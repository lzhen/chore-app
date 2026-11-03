import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pawssible.chorely',
  appName: 'Nesmi',
  webDir: 'dist',
  loggingBehavior: 'none', // Native plugin callbacks can carry authorization codes.
  ios: {
    // CSS safe-area insets own layout; avoid a second native scroll inset.
    contentInset: 'never',
    preferredContentMode: 'mobile',
  },
}

export default config
