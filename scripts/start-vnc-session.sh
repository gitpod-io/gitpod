#!/bin/bash

# see https://en.wikipedia.org/wiki/Xvfb#Remote_control_over_SSH

DISP=${DISPLAY:1}

Xvfb -screen "$DISP" "${CUSTOM_XVFB_WxHxD:=1920x1080x16}" -ac -pn -noreset &

$WINDOW_MANAGER &

VNC_PORT=$((5900 + "$DISP"))
NOVNC_PORT=$((6080 + "$DISP"))

x11vnc -localhost -shared -display :"$DISP" -forever -rfbport ${VNC_PORT} -bg -o "/tmp/x11vnc-${DISP}.log"
cd /opt/novnc/utils && ./novnc_proxy --vnc "localhost:${VNC_PORT}" --listen "${NOVNC_PORT}" &