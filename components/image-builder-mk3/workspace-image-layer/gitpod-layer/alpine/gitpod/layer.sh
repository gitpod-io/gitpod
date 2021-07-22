#!/bin/sh
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# >>> Expects to be run as root

# Quit immediately on non-zero exit code
set -e;

# Install necessary tools only if they are not yet installed
INSTALLED_PACKAGES=$(apk list -I git bash | wc -l)
if [ "$INSTALLED_PACKAGES" != 2 ]; then
    # Install
    apk add --no-cache --update \
        git \
        bash
fi

# Disable root login
#
# Note: The root account should already be disabled by default, at least in Ubuntu.
# Source: https://askubuntu.com/a/20453
#
# In the past, we used to set a password here, when Gitpod managed workspaces via SSH.
# Now, it doesn't really matter if root is locked or not, because we prevent privilege
# escalation in containers with "allowPrivilegeEscalation=false" anyway:
# https://kubernetes.io/docs/concepts/policy/pod-security-policy/#privilege-escalation
passwd -l root || true

# Create gp-preview symlink required for the browser variable
ln -s /usr/bin/gp /usr/bin/gp-preview

# Create Gitpod user
if ! id -u gitpod; then
    # user doesn't exist, let's add it.
    echo "Creating new user 'gitpod'.";
    addgroup -g 33333 gitpod;
    adduser -D -h /home/gitpod -s /bin/sh -u 33333 -G gitpod gitpod;
    echo "gitpod:gitpod" | chpasswd;

    # To allow users to not know anything about our gitpod user, copy over all stuff from the previous user (root)
    cp -R /root/. /home/gitpod;
    chown -R gitpod:gitpod /home/gitpod/;
else
    USER_ID=$(id -u gitpod)
    if [ "$USER_ID" -eq 33333 ]; then
        # users exists and has user id 33333. We hope that the user does not have ID 0, because that grants root privileges
        echo "Found user 'gitpod'. Reusing it.";
        echo "gitpod:gitpod" | chpasswd;
    else
        # error
        echo "Error: User 'gitpod' exists but does not have user-id 33333. The user-id is $(id -u)";
        exit 1;
    fi
fi
