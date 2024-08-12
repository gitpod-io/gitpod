#!/usr/bin/env bash

GATEWAY_PLUGIN_PATH=$(pwd)/gitpod-gateway.zip
export GATEWAY_PLUGIN_PATH
HOME=/home/gitpod

mkdir -p $HOME/.local/share/JetBrains/consentOptions/
echo -n "rsch.send.usage.stat:1.1:0:1644945193441" > $HOME/.local/share/JetBrains/consentOptions/accepted
mkdir -p $HOME/.config/JetBrains/JetBrainsClient/options
touch $HOME/.config/JetBrains/JetBrainsClient/options/ide.general.xml
./gradlew test -i
