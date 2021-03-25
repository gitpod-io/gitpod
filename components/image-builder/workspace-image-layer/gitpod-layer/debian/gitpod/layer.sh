#!/bin/bash
# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# >>> Expects to be run as root

# Quit immediately on non-zero exit code
set -e;

# Install necessary tools only if they are not yet installed
INSTALLED_PACKAGES=$(dpkg-query -f '${Package} ${Status}\n' -W bash-completion git | wc -l)
if [ $INSTALLED_PACKAGES != 2 ]; then
    # The first 'clean' is needed to avoid apt-get detecting package meta data changes
    # (like changed labels) which result in errors and broken builds/workspaces!
    apt-get clean && rm -rf /var/lib/apt/lists/*;

    apt-get update --allow-insecure-repositories;
    apt-get install -yq \
        bash-completion \
        git

    # Cleanup to keep the image as small as possible
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*;
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
    addgroup --gid 33333 gitpod;
    # '--no-log-init': see https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
    useradd --no-log-init --create-home --home-dir /home/gitpod --shell /bin/bash --uid 33333 --gid 33333 gitpod;
    echo "gitpod:gitpod" | chpasswd;

    # To allow users to not know anything about our gitpod user, copy over all stuff from the previous user (root)
    cp -R /root/. /home/gitpod;
    chown -R gitpod:gitpod /home/gitpod/;
else
    USER_ID=$(id -u gitpod)
    if [ $USER_ID -eq 33333 ]; then
        # users exists and has user id 33333. We hope that the user does not have ID 0, because that grants root privileges
        echo "Found user 'gitpod'. Reusing it.";
        echo "gitpod:gitpod" | chpasswd;
    else
        # error
        echo "Error: User 'gitpod' exists but does not have user-id 33333. The user-id is $UID";
        exit 1;
    fi
fi
