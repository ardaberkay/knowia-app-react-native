export default {
  expo: {
    name: "Knowia",
    slug: "knowia",
    backgroundColor: "#FF8D1A",
    version: "1.0.0",
    owner: "imati",
    orientation: "portrait",
    icon: "./assets/app_icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "knowia",
    updates: {
      url: "https://u.expo.dev/35370cb0-28f6-4273-86d2-f920b86c8acb"
    },
    splash: {
      image: "./assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#FF8D1A"
    },
    ios: {
      backgroundColor: "#FF8D1A",
      supportsTablet: true,
      bundleIdentifier: "com.arda.knowia",
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "knowia" // Senin scheme adın
            ]
          }
        ]
      },
      runtimeVersion: {
        policy: "appVersion"
      }
    },
    android: {
      backgroundColor: "#FF8D1A",
      splash: {
        image: "./assets/app_icon_splash.png",
        resizeMode: "contain",
        backgroundColor: "#FF8D1A"
      },
      adaptiveIcon: {
        foregroundImage: "./assets/android_logo.png",
        backgroundColor: "#FF8D1A"
      },
      package: "com.arda.knowia",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "android.permission.DETECT_SCREEN_CAPTURE"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "knowia"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    web: {
      favicon: "./assets/app_icon.png"
    },
    plugins: [
      "expo-font",
      "expo-localization",
      "expo-dev-client",
      "expo-notifications",
      "expo-sharing",
      "expo-web-browser",
      "./plugins/withAndroidKeyboardMode"
    ],
    extra: {
      eas: {
        projectId: "35370cb0-28f6-4273-86d2-f920b86c8acb"
      }
    }
  }
};