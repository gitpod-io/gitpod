FROM archlinux:base
# ─── INITIAL SETUP ──────────────────────────────────────────────────────────────
USER root
RUN \
  pacman-key --init > /dev/null 2>&1 \
  && pacman-key --populate archlinux > /dev/null 2>&1 \
  && pacman -Syyu --noconfirm >/dev/null 2>&1 \
  && pacman -S --noconfirm bash >/dev/null 2>&1
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# ─── INITIAL VALIDATIONS ────────────────────────────────────────────────────────
USER root
# [ NOTE ] in case gitpod user exists and has a uid
# that is not 33333, this run statement will fail.
RUN \
set -xue ; \
if getent passwd "gitpod" > /dev/null 2>&1; then \
[ "$(id -u gitpod)" != "33333" ] \
&& echo >&2 "Error: User 'gitpod' exists but does not have user-id 33333. The user-id is $(id -u)" \
&& exit 1 ; \
else \
exit 0 ; \
fi
# ─── CONFIGURING PACMAN ─────────────────────────────────────────────────────────
USER root
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
# ─── INSTALLING CORE PACKAGES ───────────────────────────────────────────────────
USER root
RUN \
set -xue ; \
[ -r /usr/bin/gp ] && ln -sf /usr/bin/gp /usr/bin/gp-preview ; \
pacman -Sy --noconfirm --needed \
  git \
  base-devel \
  bash-completion \
  wget \
  curl \
  sudo \
> /dev/null 2>&1 ;
# ─── SUDO SETUP ─────────────────────────────────────────────────────────────────
USER root
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
USER root
# [ NOTE ] => user password was generated through the following command
# perl -e 'print crypt($ARGV[0], "password")' "gitpod"
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
  --password "paF0XkFNewMcY" \
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
# [ NOTE ] => this run statement tries to install paru up to five failures
# as sometimes, aur may be temporarily unavailable
RUN \
set -xue ; \
[ ! -d "/home/gitpod/.cargo" ] && clean_cargo="true" || clean_cargo=="false" ; \
git clone https://aur.archlinux.org/paru.git /tmp/paru \
&& pushd /tmp/paru > /dev/null 2>&1 \
&& for i in {1..5}; do makepkg --noconfirm -sicr > /dev/null 2>&1 && break || sleep 15; done \
&& paru --version > /dev/null 2>&1 \
! cargo --version > /dev/null 2>&1 \
&& popd > /dev/null 2>&1 \
&& [[ "${clean_cargo}" == "true" ]] && rm -r "/home/gitpod/.cargo" ;
# ─── COPY CONFIG AND LAYER SCRIPT ───────────────────────────────────────────────
COPY ./gitpod /var/gitpod
# ─── CONFIGURE USER SHELL ───────────────────────────────────────────────────────
USER "gitpod"
# TODO Remove this in the near future when we do not need ~/.bashrc appends/prepends any more
RUN \
set -xue ; \
BASH_RC=~/.bashrc; \
[ ! -d "/home/gitpod" ] && echo >&2 "'gitpod' user home directory not found" && exit 1 ; \
[ -r "$BASH_RC" ] && cp "$BASH_RC" ~/.bashrc-org || touch ~/.bashrc-org ; \
touch ~/.hushlogin ; \
cat /var/gitpod/.bashrc-prepend > "$BASH_RC" \
&& cat ~/.bashrc-org >> "$BASH_RC" \
&& cat /var/gitpod/.bashrc-append >> "$BASH_RC"
# ─── CLEANUP AND FINALIZATIONS ──────────────────────────────────────────────────
USER root
RUN \
set -xue ; \
chown "$(id -u gitpod):$(id -g gitpod)" "/home/gitpod" -R \
&& pacman -Qdtq | sudo pacman -Rs - > /dev/null 2>&1 || true \
&& pacman --noconfirm -Scc > /dev/null 2>&1 \
&& rm -rf \
  /var/cache/pacman/pkg/* \
  /tmp/*
# ────────────────────────────────────────────────────────────────────────────────
USER gitpod
