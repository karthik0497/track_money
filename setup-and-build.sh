#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    Track-Money: Setup & Build APK               "
echo "=================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_DIR="$HOME/.local/android-sdk"
JAVA_HOME_DIR="$(dirname $(dirname $(readlink -f $(which java))))"

export JAVA_HOME="$JAVA_HOME_DIR"
export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"

echo "Java: $JAVA_HOME"
echo "Android SDK: $ANDROID_HOME"

# ── 1. Install Android command-line tools if not present ──────────────────────
if [ ! -f "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo ""
    echo "Step 1: Installing Android Command-Line Tools..."
    mkdir -p "$SDK_DIR/cmdline-tools"

    CMD_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    CMD_TOOLS_ZIP="/tmp/cmdline-tools.zip"

    echo "Downloading Android command-line tools..."
    curl -fL "$CMD_TOOLS_URL" -o "$CMD_TOOLS_ZIP"

    echo "Extracting..."
    unzip -q "$CMD_TOOLS_ZIP" -d "$SDK_DIR/cmdline-tools/"

    # Rename to 'latest' as expected
    if [ -d "$SDK_DIR/cmdline-tools/cmdline-tools" ]; then
        mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
    fi

    rm -f "$CMD_TOOLS_ZIP"
    echo "✓ Android command-line tools installed"
else
    echo "✓ Android command-line tools already present"
fi

export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# ── 2. Accept licenses & install required SDK components ─────────────────────
echo ""
echo "Step 2: Accepting licenses and installing SDK components..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
echo "✓ SDK components installed"

# ── 3. Sync web assets into www/ ─────────────────────────────────────────────
echo ""
echo "Step 3: Packaging web assets to www/..."
cd "$PROJECT_DIR"
mkdir -p www
cp -rf index.html manifest.json sw.js icons css js www/
echo "✓ Web assets synced"

# ── 4. Capacitor sync ────────────────────────────────────────────────────────
echo ""
echo "Step 4: Syncing Capacitor Android project..."
if [ ! -d "android" ]; then
    npx cap add android
fi
npx cap sync android
echo "✓ Capacitor synced"

# ── 5. Write local.properties ────────────────────────────────────────────────
echo "sdk.dir=$SDK_DIR" > "$PROJECT_DIR/android/local.properties"
echo "✓ local.properties updated → sdk.dir=$SDK_DIR"

# ── 6. Gradle build ──────────────────────────────────────────────────────────
echo ""
echo "Step 5: Compiling Debug APK with Gradle..."
cd "$PROJECT_DIR/android"
./gradlew assembleDebug --no-daemon

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
    echo "How to install:"
    echo "  1. Transfer track-money-debug.apk to your Android phone"
    echo "     (via USB, WhatsApp, Telegram, or Google Drive)"
    echo "  2. Tap the APK file on your phone"
    echo "  3. Allow install from unknown sources if prompted"
    echo "=================================================="
else
    echo "❌ APK not found at expected path. Check android/app/build/outputs/apk/"
    find "$PROJECT_DIR/android/app/build" -name "*.apk" 2>/dev/null
    exit 1
fi
