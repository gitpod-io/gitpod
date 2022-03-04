#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


DRIVER_NAME=shiftfs
DRIVER_VERSION=1.2
ARCH=$(uname -m)
KERNEL_RELEASE=$(uname -r)

if lsmod | grep $DRIVER_NAME; then
    echo "shiftfs is already loaded - nothing to do here"
    exit 0
fi

set -ex
mkdir -p /lib/modules/"${KERNEL_RELEASE}"
ln -s /usr/src_node/linux-headers-"${KERNEL_RELEASE}" /lib/modules/"${KERNEL_RELEASE}"/build
dkms install -m ${DRIVER_NAME} -v ${DRIVER_VERSION} -k "${KERNEL_RELEASE}" --kernelsourcedir /usr/src_node/linux-headers-"${KERNEL_RELEASE}"
insmod /var/lib/dkms/${DRIVER_NAME}/${DRIVER_VERSION}/"${KERNEL_RELEASE}"/"${ARCH}"/module/${DRIVER_NAME}.ko
