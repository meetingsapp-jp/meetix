# MisFinanzas Android APK - Build Guide

This guide explains how to build an APK (Android Package) for the MisFinanzas financial app using Android Studio.

## Quick Start

### Prerequisites

1. **Android Studio** (2022.1 or later)
   - Download from: https://developer.android.com/studio

2. **Java Development Kit (JDK)** (version 11+)
   - Usually included with Android Studio
   - Verify: `java -version`

3. **Android SDK** (API level 34)
   - Installed automatically with Android Studio

## Building Steps

### Step 1: Open the Project in Android Studio

1. Launch Android Studio
2. Click **File** → **Open**
3. Navigate to the `android` folder in this repository
4. Click **Open**
5. Wait for Gradle to sync (you'll see a progress bar at the bottom)

### Step 2: Build the APK

#### Option A: Debug APK (for testing)

1. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. You'll see a notification: "Build successful"
4. Click **locate** in the notification to find the APK file

**Location**: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Option B: Release APK (for distribution)

For a production-ready APK signed with your key:

1. Go to **Build** → **Generate Signed Bundle / APK**
2. Select **APK**
3. Click **Create New** to generate a keystore (or select existing)
4. Fill in the keystore details:
   - **Key store path**: Choose a location (save it safely!)
   - **Password**: Create a strong password
   - **Key alias**: `misfinanzas`
   - **Key password**: Same as keystore password
   - **Validity**: 10000 (years)

5. Click **Next**
6. Select **release** build type
7. Click **Finish**

**Location**: `android/app/build/outputs/apk/release/app-release.apk`

### Step 3: Test the APK

#### Using Android Emulator (built-in Android Studio)

1. **Create Virtual Device**:
   - Tools → AVD Manager
   - Create Virtual Device (choose Pixel with API 34)
   - Launch the emulator

2. **Install APK**:
   - Tools → Android SDK Platform-Tools (verify installed)
   - Drag and drop the APK file onto the emulator
   - Or use command line:
     ```bash
     adb install android/app/build/outputs/apk/debug/app-debug.apk
     ```

#### Using a Physical Device

1. **Enable Developer Mode**:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

2. **Connect to Computer**:
   - Connect device via USB
   - Approve the connection on your phone

3. **Install APK**:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Launch App**:
   - Tap the MisFinanzas app on your phone

## Command Line Building

If you prefer to build without Android Studio:

```bash
cd android

# Build debug APK
./gradlew assembleDebug

# Build release APK (requires keystore)
./gradlew assembleRelease

# Clean build
./gradlew clean build
```

### Troubleshooting Build Issues

#### Gradle Sync Error
```bash
# Clear gradle cache
./gradlew clean

# Sync again
./gradlew sync
```

#### Java Version Error
```bash
# Check Java version
java -version

# Should be 11 or higher. If not, set JAVA_HOME:
export JAVA_HOME=/path/to/jdk11
```

#### Missing SDK
- Open Android Studio
- Tools → SDK Manager
- Install Android SDK API 34

#### Permission Denied (Linux/Mac)
```bash
chmod +x android/gradlew
```

## APK Information

| Property | Value |
|----------|-------|
| Package Name | `com.misfinanzas` |
| Version | 1.0.0 |
| Min SDK | API 24 (Android 7.0) |
| Target SDK | API 34 (Android 14) |
| File Size | ~5-8 MB |

## Features in the APK

✅ Full offline functionality - no internet needed
✅ LocalStorage support for data persistence
✅ Responsive design optimized for phones
✅ Dark theme UI
✅ Date pickers and form inputs
✅ Transaction management (add, delete, edit)
✅ Monthly reports and statistics

## After Building

### Share the APK

**Debug APK** (for testing):
- Email the APK file directly
- Use file sharing services
- Share via messaging apps

**Release APK** (for distribution):
- Upload to Google Play Store
- Create a managed app distribution via Google Play Console
- Or distribute directly to users

### Upload to Google Play Store

1. Create a Google Play Developer Account ($25 one-time fee)
2. Go to Google Play Console
3. Create new app with package name `com.misfinanzas`
4. Upload signed APK
5. Add store listing (screenshots, description)
6. Submit for review

## Development Workflow

### Making Changes to the App

1. Edit the HTML file: `android/app/src/main/assets/misfinanzas.html`
2. Rebuild and test:
   ```bash
   ./gradlew assembleDebug
   ```
3. Install on emulator/device to verify changes

### Changing the App Icon

Replace the launcher icon at:
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png`

### Changing App Name

Edit: `android/app/src/main/res/values/strings.xml`

## Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "Build failed" | Run `./gradlew clean` and try again |
| "SDK not found" | Open SDK Manager and install API 34 |
| "JAVA_HOME error" | Install JDK 11+ and set JAVA_HOME environment variable |
| "Could not connect to emulator" | Restart the emulator or device |
| "APK not installing" | Enable "Unknown Sources" in device settings |

## Next Steps

1. ✅ Build and test the debug APK
2. ✅ Verify all features work on your device
3. ✅ Create a keystore for release builds
4. ✅ Build a signed release APK
5. ✅ Test the release APK
6. ✅ Upload to Google Play Store

## Resources

- [Android Studio Documentation](https://developer.android.com/studio/intro)
- [Android Build System](https://developer.android.com/build)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [WebView Best Practices](https://developer.android.com/guide/webapps/webview)

## Support

For issues with the build process, check:
- `android/build.gradle` - Project configuration
- `android/app/build.gradle` - App configuration
- `android/gradle/wrapper/gradle-wrapper.properties` - Gradle version

---

**Built with ❤️ for personal finance management**
