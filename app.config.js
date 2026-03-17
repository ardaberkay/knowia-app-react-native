export default {
  expo: {
    name: "Knowia",
    slug: "knowia",
    version: "1.0.0",
    owner: "imati",
    orientation: "portrait",
    icon: "./assets/app_icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "knowia",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "cover",
      backgroundColor: "#FF8D1A"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.arda.knowia"
    },
    android: {
      enableProguardInReleaseBuilds: true,
      adaptiveIcon: {
        foregroundImage: "./assets/android_logo.png",
        backgroundColor: "#FF8D1A"
      },
      edgeToEdgeEnabled: true,
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
      "./plugins/withAndroidKeyboardMode",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            buildToolsVersion: "35.0.0"
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "35370cb0-28f6-4273-86d2-f920b86c8acb"
      }
    }
  }
};