# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM ubuntu:18.04

RUN apt-get update && apt-get install -y git gcc make dkms curl

# expects the host's /lib/modules to be mounted with a /lib/modules/<host-kernel-version>/build directory containing
# the kernel header files.

WORKDIR /build
COPY entrypoint.sh ./
RUN mkdir -p /usr/src/shiftfs-1.2 && curl -o /usr/src/shiftfs-1.2/shiftfs.c -L https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux/+git/focal/plain/fs/shiftfs.c
COPY dkms.conf Makefile /usr/src/shiftfs-1.2/

CMD [ "./entrypoint.sh" ]