import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.gopharmacy.beta",
  appName: "GO Pharmacy",
  webDir: "dist/public",
  // Bundled React assets only. Do not set server.url or allowNavigation.
  server: { hostname: "localhost", androidScheme: "https", cleartext: false },
  android: {
    allowMixedContent: false,
    backgroundColor: "#ffffff",
    webContentsDebuggingEnabled: false,
  },
  // Capacitor's cookie helper logs Set-Cookie at info level. Keep native bridge
  // logging off even in this debug APK to avoid session values in logcat.
  loggingBehavior: "none",
};
export default config;
