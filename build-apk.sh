#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Track-Money: Android APK Builder             "
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Set up local JDK and Android SDK paths
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/android-sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$HOME/.local/bin:$PATH"

echo "1. Checking environment..."
if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found in PATH! Please install Node.js."
    exit 1
fi
echo "✓ Node version: $(node -v)"

if [ ! -d "$JAVA_HOME" ]; then
    echo "JAVA_HOME directory not found at $JAVA_HOME!"
    exit 1
fi
echo "✓ Java version: $(java -version 2>&1 | head -n 1)"

if [ ! -d "$ANDROID_HOME" ]; then
    echo "ANDROID_HOME directory not found at $ANDROID_HOME!"
    exit 1
fi
echo "✓ Android SDK: $ANDROID_HOME"

echo "2. Packaging web bundle to www directory..."
mkdir -p www
cp -rf index.html manifest.json sw.js icons css js www/

echo "3. Synchronizing web assets into Android project..."
ASSETS_DIR="$PROJECT_DIR/android/app/src/main/assets/public"
mkdir -p "$ASSETS_DIR"
cp -rf "$PROJECT_DIR/www/"* "$ASSETS_DIR/"
echo "✓ Web assets synced directly"

# Ensure local.properties points to Android SDK
echo "sdk.dir=$ANDROID_HOME" > "$PROJECT_DIR/android/local.properties"

echo "4. Compiling standalone Debug APK with Gradle..."
cd "$PROJECT_DIR/android"
./gradlew assembleDebug

APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
ROOT_APK="$PROJECT_DIR/track-money-debug.apk"

if [ -f "$APK_PATH" ]; then
    cp -f "$APK_PATH" "$ROOT_APK"
    echo ""
    echo "=================================================="
    echo "🎉 SUCCESS: Standalone Android APK Compiled!"
    echo "=================================================="
    echo "APK Location (Project Root): $ROOT_APK"
    echo "APK Location (Gradle Out):   $APK_PATH"
    echo "File Size:                   $(du -h "$ROOT_APK" | cut -f1)"
    echo ""
    echo "How to install on your Android phone:"
    echo "1. Send 'track-money-debug.apk' to your phone (via WhatsApp, USB cable, Telegram, Google Drive, or email)."
    echo "2. Tap on the APK file on your Android phone."
    echo "3. Tap 'Install' (if prompted, toggle 'Allow from this source')."
    echo "=================================================="
else
    echo "Build finished, please check android/app/build/outputs/apk/"
fi
