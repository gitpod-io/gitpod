#!/bin/bash

# Set variables
MANIFEST_URL="https://gitpod-next-runner-releases-04d0243.s3.amazonaws.com/cli/latest/manifest.json"
INSTALL_DIR="$HOME/.local/bin"

mkdir -p $INSTALL_DIR

echo "Fetching the latest version manifest..."
MANIFEST=$(curl -s $MANIFEST_URL)

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)

DOWNLOAD_URL=$(echo "$MANIFEST" | sed -n "/\"$PLATFORM\"/,/url/ s/.*\"url\": \"\([^\"]*\)\".*/\1/p" | head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: Your platform ($PLATFORM) is not supported."
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
