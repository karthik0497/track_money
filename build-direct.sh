#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Track-Money: Build APK (No cap sync)         "
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$HOME/.local/android-sdk"
JAVA_HOME_DIR="$(dirname $(dirname $(readlink -f $(which java))))"

export JAVA_HOME="$JAVA_HOME_DIR"
export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"

echo "✓ Java: $(java -version 2>&1 | head -1)"
echo "✓ Android SDK: $ANDROID_HOME"

# ── 1. Manually sync web assets into Capacitor's assets folder ──────────────
ASSETS_DIR="$PROJECT_DIR/android/app/src/main/assets/public"
echo ""
echo "Step 1: Syncing web assets → $ASSETS_DIR ..."

mkdir -p "$ASSETS_DIR"

# Copy all web app files
cp -f  "$PROJECT_DIR/index.html"   "$ASSETS_DIR/index.html"
cp -f  "$PROJECT_DIR/manifest.json" "$ASSETS_DIR/manifest.json"
cp -f  "$PROJECT_DIR/sw.js"        "$ASSETS_DIR/sw.js"
cp -rf "$PROJECT_DIR/css"          "$ASSETS_DIR/"
cp -rf "$PROJECT_DIR/js"           "$ASSETS_DIR/"
cp -rf "$PROJECT_DIR/icons"        "$ASSETS_DIR/"

echo "✓ Web assets synced"

# ── 2. Write local.properties ────────────────────────────────────────────────
echo "sdk.dir=$SDK_DIR" > "$PROJECT_DIR/android/local.properties"
echo "✓ local.properties → sdk.dir=$SDK_DIR"

# ── 3. Gradle build ──────────────────────────────────────────────────────────
echo ""
echo "Step 2: Compiling Debug APK with Gradle..."
cd "$PROJECT_DIR/android"
./gradlew assembleDebug --no-daemon --stacktrace 2>&1

APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
ROOT_APK="$PROJECT_DIR/track-money-debug.apk"

if [ -f "$APK_PATH" ]; then
    cp -f "$APK_PATH" "$ROOT_APK"
    echo ""
    echo "=================================================="
    echo "🎉 SUCCESS: APK Built!"
    echo "=================================================="
    echo "APK: $ROOT_APK"
    echo "Size: $(du -h "$ROOT_APK" | cut -f1)"
    echo ""
    echo "Transfer to phone via USB, WhatsApp, Telegram, or Google Drive"
    echo "Then tap the .apk file → Allow Unknown Sources → Install"
    echo "=================================================="
else
    echo "❌ APK not found. Searching..."
    find "$PROJECT_DIR/android/app/build" -name "*.apk" 2>/dev/null
    exit 1
fi
