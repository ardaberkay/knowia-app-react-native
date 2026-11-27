export default {
  expo: {
    name: "Knowia",
    slug: "knowia",
    backgroundColor: "#FF8D1A",
    version: "1.3.0",
    owner: "imati",
    orientation: "portrait",
    icon: "./assets/images/app_icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    scheme: "knowia",
    updates: {
      url: "https://u.expo.dev/35370cb0-28f6-4273-86d2-f920b86c8acb"
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
      adaptiveIcon: {
        foregroundImage: "./assets/images/android_logo.png",
        backgroundColor: "#FF8D1A"
      },
      package: "com.arda.knowia",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      permissions: [
        "android.permission.DETECT_SCREEN_CAPTURE"
      ],
      // expo-audio is only used for read-aloud playback; never ask for the mic.
      blockedPermissions: [
        "android.permission.RECORD_AUDIO"
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
      favicon: "./assets/images/app_icon.png"
    },
    plugins: [
      "expo-asset",
      // Since SDK 56 the root `splash` key is no longer read. These props keep the
      // old look: full-screen image on iOS, 200dp logo on orange on Android.
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FF8D1A",
          ios: {
            image: "./assets/images/splash.png",
            resizeMode: "cover",
            enableFullScreenImage_legacy: true
          },
          android: {
            image: "./assets/images/app_icon_splash.png",
            resizeMode: "contain",
            imageWidth: 200
          }
        }
      ],
      "expo-status-bar",
      [
        "expo-font",
        {
          // Embedded fonts. The file names are the fontFamily names used in
          // code (theme/typography.js, components/ui/PhosphorIcon.js): Android
          // uses the file name, iOS the name inside the font, and they match.
          fonts: [
            "./assets/fonts/Inter.ttf",
            "./assets/fonts/Inter-Medium.ttf",
            "./assets/fonts/Inter-SemiBold.ttf",
            "./assets/fonts/Inter-Bold.ttf",
            "./assets/fonts/Phosphor.ttf",
            "./assets/fonts/Phosphor-Fill.ttf",
          ],
        },
      ],
      "expo-localization",
      "expo-dev-client",
      "expo-notifications",
      "expo-sharing",
      "expo-web-browser",
      // Only used to let card read-aloud (expo-speech) play in silent mode.
      // No background audio and no recording. The microphone string is only
      // there because the library binary contains recording APIs, which App
      // Store Connect flags when the key is missing. It is never requested.
      [
        "expo-audio",
        {
          microphonePermission: "Knowia does not record audio. This permission is never requested.",
          enableBackgroundPlayback: false,
          recordAudioAndroid: false
        }
      ],
      "./plugins/withAndroidKeyboardMode",
      "./plugins/withAndroidShortCmakePaths"
    ],
    extra: {
      eas: {
        projectId: "35370cb0-28f6-4273-86d2-f920b86c8acb"
      }
    }
  }
};