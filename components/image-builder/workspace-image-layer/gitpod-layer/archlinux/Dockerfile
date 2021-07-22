# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# 'FROM ${BASE_IMAGE}' prepended here

###############################################################################
# REQUIRED
###############################################################################
# !!! We expect users to configure their containers as root !!!
USER root
# ─── INITIAL SETUP ──────────────────────────────────────────────────────────────
RUN \
  pacman-key --init \
  && pacman-key --populate archlinux \
  && pacman -Syyu --noconfirm \
  && pacman -S --noconfirm bash
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# ─── INITIAL VALIDATIONS ────────────────────────────────────────────────────────
# [ NOTE ] in case gitpod user exists and has a uid
# that is not 33333, this run statement will fail.
RUN \
set -xue ; \
getent passwd "gitpod" > /dev/null 2>&1 \
&& [ "$(id -u gitpod )" != "33333" ] \
&& echo >&2 "Error: User 'gitpod' exists but does not have user-id 33333. The user-id is $(id -u)" \
&& exit 1
# ─── CONFIGURING PACMAN ─────────────────────────────────────────────────────────
RUN \
set -xue ; \
sed -i \
  -e "/ParallelDownloads/d" \
  -e  '/\[options\]/a ParallelDownloads = 16' \
/etc/pacman.conf \
&& sed -i \
  -e "/Color/d" \
  -e "/ILoveCandy/d" \
  -e '/\[options\]/a Color' \
  -e '/\[options\]/a ILoveCandy' \
/etc/pacman.conf ;
# ─── FINDING FASTEST SOURCES ────────────────────────────────────────────────────
RUN \
set -xue ; \
pacman -S --noconfirm reflector \
&& reflector \
  --verbose \
  -p https \
  --latest 5 \
  --sort rate \
  --save /etc/pacman.d/mirrorlist
# ─── INSTALLING CORE PACKAGES ───────────────────────────────────────────────────
RUN \
set -xue ; \
[ -r /usr/bin/gp ] && ln -sf /usr/bin/gp /usr/bin/gp-preview ; \
pacman -Sy --noconfirm --needed \
  git \
  base-devel \
  bash-completion \
  pacman-contrib \
  expac \
  wget \
  curl \
  sudo \
  perl
# ─── SUDO SETUP ─────────────────────────────────────────────────────────────────
RUN \
set -xue ; \
! getent group sudo > /dev/null && groupadd sudo \
&& sed -i \
  -e '/%wheel.*NOPASSWD:\s*ALL/d' \
  -e '/%wheel\s\+ALL=(ALL\(:ALL\)\?)\s\+ALL/d' \
/etc/sudoers \
&& ( \
echo "%wheel ALL=(ALL) ALL" ; \
echo "%wheel ALL=(ALL) NOPASSWD: ALL" ; \
) | tee -a /etc/sudoers > /dev/null ;
# ─── USER SETUP ─────────────────────────────────────────────────────────────────
RUN \
set -xue ; \
! getent group "gitpod" > /dev/null \
&& groupadd --gid "33333" "gitpod" > /dev/null > /dev/null ; \
! getent passwd "gitpod" > /dev/null \
&& useradd \
  --no-log-init \
  --create-home \
  --home-dir "/home/gitpod" \
  --gid "33333" \
  --uid "33333" \
  --groups sudo \
  --shell "/bin/bash" \
  --password \
  $(perl \
    -e 'print crypt($ARGV[0], "password")' \
      "gitpod_33333" 2>/dev/null) \
  "gitpod" && \
cp -R /root/. /home/gitpod ;
RUN \
set -xue ; \
echo "gitpod:gitpod" | chpasswd \
&& chown "$(id -u gitpod):$(id -g gitpod)" /home/gitpod/ -R \
&& usermod -aG wheel,root "gitpod" \
&& passwd -l root || true
# ─── PARU INSTALL ───────────────────────────────────────────────────────────────
USER "gitpod"
RUN \
  git clone https://aur.archlinux.org/paru.git /tmp/paru
WORKDIR /tmp/paru
RUN \
for i in {1..5}; do makepkg -sic --noconfirm && break || sleep 15; done
# ─── COPY CONFIG AND LAYER SCRIPT ───────────────────────────────────────────────
COPY ./gitpod /var/gitpod
# ─── CONFIGURE USER SHELL ───────────────────────────────────────────────────────
# TODO Remove this in the near future when we do not need ~/.bashrc appends/prepends any more
RUN \
    touch ~/.hushlogin                                                   && \
    BASH_RC=~/.bashrc; if [ -f "$BASH_RC" ]; then cp "$BASH_RC" ~/.bashrc-org; else touch ~/.bashrc-org; fi && \
    cat /var/gitpod/.bashrc-prepend > "$BASH_RC"                            && \
    cat ~/.bashrc-org >> "$BASH_RC"                                         && \
    cat /var/gitpod/.bashrc-append >> "$BASH_RC"
# ─── CLEANUP AND FINALIZATIONS ──────────────────────────────────────────────────
USER root
RUN \
  chown "$(id -u gitpod):$(id -g gitpod)" "${HOME}" -R \
  && pacman -Rcns --noconfirm rust > /dev/null 2>&1 || true \
  && pacman -Qdtq | sudo pacman -Rs - > /dev/null 2>&1 || true \
  && rm -rf \
    /tmp/*
# ────────────────────────────────────────────────────────────────────────────────
USER gitpod
