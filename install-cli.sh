#!/bin/bash
# Set variables
MANIFEST_URL="https://gitpod-next-runner-releases-04d0243.s3.amazonaws.com/cli/latest/manifest.json"
INSTALL_DIR="$HOME/.local/bin"
mkdir -p $INSTALL_DIR

echo "Fetching the latest version manifest..."
MANIFEST=$(curl -s $MANIFEST_URL)

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize OS names
case "$OS" in
  darwin|linux)
    # These are already in the correct format
    ;;
  *)
    echo "Error: Unsupported operating system ($OS). Only Darwin (macOS) and Linux are supported."
    exit 1
    ;;
esac

# Normalize architecture names to match Go's GOARCH
case "$ARCH" in
  x86_64|amd64)
    ARCH="amd64"
    ;;
  aarch64|arm64)
    ARCH="arm64"
    ;;
  *)
    echo "Error: Unsupported architecture ($ARCH). Only arm64 and amd64 are supported."
    exit 1
    ;;
esac

echo "Detected OS (GOOS): $OS"
echo "Detected architecture (GOARCH): $ARCH"

PLATFORM="${OS}-${ARCH}"
echo "Full platform identifier: $PLATFORM"

DOWNLOAD_URL=$(echo "$MANIFEST" | sed -n "/\"$PLATFORM\"/,/url/ s/.*\"url\": \"\([^\"]*\)\".*/\1/p" | head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: Your platform ($PLATFORM) is not supported."
  echo "Supported platforms are:"
  echo "  - darwin-arm64"
  echo "  - darwin-amd64"
  echo "  - linux-arm64"
  echo "  - linux-amd64"
  
  # Suggest alternatives
  case "$PLATFORM" in
    darwin-*)
      echo "For macOS, you can try using Rosetta 2 to run the amd64 version if you're on an ARM Mac."
      echo "To do this, run: arch -x86_64 /bin/bash"
      echo "Then run this script again within that shell."
      ;;
    linux-*)
      echo "For Linux, ensure you're using either an arm64 or amd64 system."
      echo "This script does not support emulation or cross-architecture installation."
      ;;
  esac
  
  exit 1
fi

LATEST_VERSION=$(echo "$DOWNLOAD_URL" | sed -n 's/.*\/cli\/\([0-9.]*\)\/.*/\1/p')
CLI_PATH="$INSTALL_DIR/gitpod-cli-$LATEST_VERSION"

echo "Downloading the CLI binary for version $LATEST_VERSION..."
curl -L $DOWNLOAD_URL -o $CLI_PATH
chmod +x $CLI_PATH
ln -sf $CLI_PATH $INSTALL_DIR/gitpod

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> ~/.bashrc
  echo "Run 'source ~/.bashrc' to update your PATH."
fi

echo "Gitpod CLI version $LATEST_VERSION has been installed successfully."
