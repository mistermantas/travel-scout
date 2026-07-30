import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mistermantas.travelscout",
  appName: "Travel Scout",
  webDir: "web-dist",
  backgroundColor: "#f6f8f5",
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile"
  }
};

export default config;
