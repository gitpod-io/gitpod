#!/bin/sh
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# This script is run inside the base image provided by the user.
# It should detect the name of the distro by looking at /etc/os-release.
# The goal here is to determine the set of tools that are available to us to install the necessary dependencies for gitpod into the image
# E.g., which package manager to use etc.
# Dependencies:
#  - /bin/sh
#  - sed
#  - /etc/os-release to contain the distro 'ID='
# Postconditions:
#  - stores result in file '/workspace/distro'
#  - valid values: debian | alpine | "amzn" | UNDEFINED

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

    "fedora")
        DISTRO="fedora"
        ;;

    "rhel" | "centos")
        DISTRO="rhel"
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

OUT_FILE="/workspace/distro"
printf '%s\n' "$DISTRO" > "$OUT_FILE"
printf '%s\n' "Found distro: $DISTRO. Wrote file $OUT_FILE."