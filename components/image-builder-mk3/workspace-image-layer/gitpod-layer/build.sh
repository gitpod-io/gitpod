#!/bin/bash
# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


set -e

if [ ! -f /etc/os-release ]; then
    DISTRO="UNDEFINED"
else
    # Read the line starting with 'ID=' from /etc/os-release and print the rest of the line
    DISTRO="$(sed -nr 's/^ID=(.+)$/\1/p' /etc/os-release)"
fi

# Unify DISTRO values
case "$DISTRO" in
    "debian" | "ubuntu" | "linuxmint")
        DISTRO="debian"
        ;;

    # NOTICE(Kreyren): Amazonlinux has non-standard /etc/os-release
    "\"amzn\"")
        # Kreyren: Made for https://github.com/gitpod-io/gitpod/issues/1490
        DISTRO="amazon"
        ;;

    "alpine")
        DISTRO="alpine"
        ;;

    *)
        DISTRO="UNDEFINED"
        ;;
esac

if [ ! -d "$DISTRO" ]; then
    echo "Error: unsupported distro: $DISTRO"
fi

ln -s $DISTRO/gitpod gitpod
sh gitpod/layer.sh