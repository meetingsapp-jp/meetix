# MisFinanzas - Android App

This is an Android app wrapper for the MisFinanzas web application. The app uses Android WebView to display the self-contained HTML finance tracker.

## Prerequisites

- Android Studio 2022.1 or higher
- Android SDK 34 (API level 34)
- Gradle 8.0 or higher
- Java 11 or higher

## Project Structure

```
android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── kotlin/com/misfinanzas/    # Kotlin source code
│   │       ├── res/                        # Android resources
│   │       ├── assets/                     # Web assets (HTML, CSS, JS)
│   │       └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── build.gradle
├── settings.gradle
└── gradle.properties
```

## Building the APK

### Option 1: Using Android Studio

1. Open Android Studio
2. Select "File" → "Open"
3. Navigate to the `android` folder in this project
4. Wait for Gradle sync to complete
5. Select "Build" → "Build Bundle(s) / APK(s)" → "Build APK(s)"
6. The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Using Gradle Command Line

```bash
cd android
./gradlew clean build
```

To build a debug APK:
```bash
./gradlew assembleDebug
```

To build a release APK (requires signing configuration):
```bash
./gradlew assembleRelease
```

## Release Build (Signed APK)

To create a release APK for Google Play Store:

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore misfinanzas.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias misfinanzas
   ```

2. Create `android/app/keystore.properties`:
   ```properties
   storeFile=../misfinanzas.keystore
   storePassword=your_password
   keyAlias=misfinanzas
   keyPassword=your_password
   ```

3. Update `android/app/build.gradle` to use the keystore (already configured in the template)

4. Build release APK:
   ```bash
   ./gradlew clean assembleRelease
   ```

The signed APK will be at `android/app/build/outputs/apk/release/app-release.apk`

## Features

- ✅ Responsive WebView-based app
- ✅ Local storage support via browser localStorage
- ✅ Offline functionality
- ✅ Dark theme optimized UI
- ✅ Full JavaScript support
- ✅ Date picker and input support

## Minimum Requirements

- **Minimum SDK**: API 24 (Android 7.0)
- **Target SDK**: API 34 (Android 14)

## Permissions

The app requires minimal permissions:
- No internet permission (runs locally)
- Standard app permissions for storage

## Troubleshooting

### Gradle Sync Issues
- Clear the cache: `./gradlew clean`
- Invalidate Android Studio cache: File → Invalidate Caches → Invalidate and Restart

### Build Issues
- Ensure JAVA_HOME points to JDK 11+
- Update Android SDK to latest version
- Check that the Android Gradle Plugin is compatible with your Gradle version

### WebView Issues
- Ensure WebSettings are properly configured in MainActivity.kt
- Check that assets are in `src/main/assets/`
- Test on Android 7.0+ devices

## APK Information

- **Package Name**: com.misfinanzas
- **Version**: 1.0.0
- **Min SDK**: 24
- **Target SDK**: 34

## Next Steps

1. Build the debug APK for testing
2. Test on Android emulator or device
3. If satisfied, generate a signed release APK
4. Upload to Google Play Store or distribute directly

## Support

For issues or improvements, please refer to the main project repository.
