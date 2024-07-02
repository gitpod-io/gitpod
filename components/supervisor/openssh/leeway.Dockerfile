# Copyright (c) 2021 ep76
#
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
#
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
# EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
# LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
# WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# This Dockerfile was taken from https://github.com/ep76/docker-openssh-static and adapted.
FROM alpine:3.19 AS builder

ARG openssh_url=https://github.com/openssh/openssh-portable/archive/refs/tags/V_9_8_P1.tar.gz

WORKDIR /build

RUN apk add --no-cache \
  bash \
  autoconf \
  automake \
  curl \
  gcc \
  make \
  musl-dev \
  linux-headers \
  openssl-dev \
  openssl-libs-static \
  patch \
  zlib-dev \
  sed \
  xauth \
  zlib-static

RUN curl -fsSL "${openssh_url}" | tar xz --strip-components=1

RUN autoreconf

RUN ./configure \
    --prefix=/usr \
    --sysconfdir=/etc/ssh \
    --with-ldflags=-static \
    --with-privsep-user=nobody \
    --with-ssl-engine \
    --with-pie

ENV aports=https://raw.githubusercontent.com/alpinelinux/aports/master/main/openssh
RUN curl -fsSL \
    "${aports}/{avoid-redefined-warnings-when-building-with-utmps,disable-forwarding-by-default,fix-utmp,fix-verify-dns-segfault,gss-serv.c,sftp-interactive}.patch" \
    | patch -p1
RUN make install-nosysconf exec_prefix=/openssh

RUN TEST_SSH_UNSAFE_PERMISSIONS=1 \
    make -C /build file-tests interop-tests unit SK_DUMMY_LIBRARY=''

FROM scratch AS openssh-static
COPY --from=builder /openssh /usr
ENTRYPOINT [ "/usr/sbin/sshd" ]
CMD [ "-D", "-e" ]
