FROM archlinux:base
RUN \
  pacman-key --init \
  && pacman-key --populate archlinux \
  && pacman -Syyu --noconfirm \
  && pacman -S --noconfirm bash
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN \
set -xue ; \
groupadd --gid "33333" "gitpod" > /dev/null > /dev/null  \
&& useradd \
  --no-log-init \
  --create-home \
  --home-dir "/home/gitpod" \
  --gid "33333" \
  --uid "33333" \
  --shell "/bin/bash" \
  "gitpod"
