#!/usr/bin/env bash
set -e

export JAVA_HOME="/home/leapmile/.local/jdk-21"
export ANDROID_HOME="/home/leapmile/.local/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "Setting up Android SDK in $ANDROID_HOME..."
mkdir -p "$ANDROID_HOME/cmdline-tools"

if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "Downloading Android Command-Line Tools..."
    curl -sL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdline-tools.zip
    unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
    mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -f /tmp/cmdline-tools.zip
fi

echo "Accepting licenses..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true

echo "Installing platforms;android-35 and build-tools;35.0.0..."
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

echo "Writing local.properties..."
echo "sdk.dir=$ANDROID_HOME" > /home/leapmile/nano-37/nano-32_git_clone/ai/track-money/android/local.properties

echo "Android SDK setup complete!"
