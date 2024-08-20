#!/usr/bin/env bash

GATEWAY_PLUGIN_PATH=$(pwd)/jetbrains-gateway-gitpod-plugin.zip
export GATEWAY_PLUGIN_PATH
HOME=/home/gitpod

if [ ! -f "$GATEWAY_PLUGIN_PATH" ]; then
  echo "Gateway plugin zip not found at $GATEWAY_PLUGIN_PATH"
  exit 1
fi

mkdir -p $HOME/.local/share/JetBrains/consentOptions/
echo -n "rsch.send.usage.stat:1.1:0:1644945193441" > $HOME/.local/share/JetBrains/consentOptions/accepted
mkdir -p $HOME/.config/JetBrains/JetBrainsClient/options
touch $HOME/.config/JetBrains/JetBrainsClient/options/ide.general.xml
./gradlew test -i
