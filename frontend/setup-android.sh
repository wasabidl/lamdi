#!/usr/bin/env bash
# Setup script for running the Android app locally.
# Run this once to install all prerequisites, then use the build/run commands below.
#
# Usage:
#   chmod +x setup-android.sh
#   ./setup-android.sh

set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"

# ──────────────────────────────────────────────
# 1. Node.js dependencies
# ──────────────────────────────────────────────
echo "==> Installing npm dependencies..."
npm install

# ──────────────────────────────────────────────
# 2. Java 17 (required by the React Native Gradle plugin)
# ──────────────────────────────────────────────
if ! java -version 2>&1 | grep -q 'version "17'; then
  echo "==> Installing OpenJDK 17..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y openjdk-17-jdk
  elif command -v brew &>/dev/null; then
    brew install openjdk@17
    sudo ln -sfn "$(brew --prefix openjdk@17)/libexec/openjdk.jdk" /Library/Java/JavaVirtualMachines/openjdk-17.jdk
  else
    echo "ERROR: Cannot install Java 17 automatically. Please install it manually." >&2
    exit 1
  fi
fi
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(which java)")")")}"
echo "    JAVA_HOME=$JAVA_HOME"

# ──────────────────────────────────────────────
# 3. Android SDK command-line tools
# ──────────────────────────────────────────────
if [ ! -f "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "==> Downloading Android command-line tools..."
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  TMP_ZIP="$(mktemp /tmp/cmdline-tools-XXXXXX.zip)"
  curl -L -o "$TMP_ZIP" "$CMDLINE_TOOLS_URL"
  unzip -q "$TMP_ZIP" -d "$ANDROID_SDK_ROOT/cmdline-tools"
  # The zip extracts to "cmdline-tools/"; rename to "latest" as sdkmanager expects
  if [ -d "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" ]; then
    mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  fi
  rm -f "$TMP_ZIP"
fi

export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
echo "    ANDROID_HOME=$ANDROID_HOME"

# ──────────────────────────────────────────────
# 4. Android SDK components
# ──────────────────────────────────────────────
echo "==> Accepting Android SDK licenses..."
yes | sdkmanager --licenses >/dev/null 2>&1 || true

echo "==> Installing Android SDK components..."
# Versions match Expo SDK 54 defaults (see expo-modules-autolinking ExpoRootProjectPlugin.kt)
sdkmanager \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;27.1.12297006"

# ──────────────────────────────────────────────
# 5. Persist environment variables (optional)
# ──────────────────────────────────────────────
PROFILE_FILE="${HOME}/.bashrc"
if ! grep -q "ANDROID_HOME" "$PROFILE_FILE" 2>/dev/null; then
  echo "" >> "$PROFILE_FILE"
  echo "# Android SDK" >> "$PROFILE_FILE"
  echo "export ANDROID_HOME=\"$ANDROID_HOME\"" >> "$PROFILE_FILE"
  echo "export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"" >> "$PROFILE_FILE"
  echo "    Added ANDROID_HOME to $PROFILE_FILE"
fi

echo ""
echo "✓ Setup complete! Run the app with one of the commands below."
echo ""
echo "  Build debug APK:"
echo "    npm run build:android"
echo ""
echo "  Start Expo dev server (use with Expo Go or a connected device):"
echo "    npm start"
echo ""
