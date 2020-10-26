FROM alpine:latest

WORKDIR /installer
COPY components-ws-daemon-seccomp-profile-installer--profile/workspace_default.json .
