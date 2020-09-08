#!/bin/bash -li
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


 # DO NOT REMOVE THE SPACES AT THE BEGINNING OF THESE LINES
 # The spaces at the beginning of the line prevent those lines from being added to
 # the bash history.
 set +o history
 history -c
 truncate -s 0 $HISTFILE

# This is the main entrypoint to workspace container in Gitpod. It is called (and controlled) by the supervisor
# container root process.
# To mimic a regular login shell on a local computer we execute this with "bash -li" (interactive login shell):
#  - login (-l): triggers sourcing of ~/.profile and similar files
#  - interactive (-i): triggers sourcing of ~/.bashrc (and similar). This is necessary because Theia sub-processes
#    started from non-interactive shells rely some values that we (and others) tend to place into .bashrc
#    (exmaples: language servers, other language tools)
# Reference: https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files.html#Bash-Startup-Files

export SHELL=/bin/bash
export USER=gitpod

# TODO ENVVAR CLEANUP: This stays here until we moved it to a central location, ideally workspace-full
# (+ compatibility period)
# Also to mitigate compatibility issues let's try to source recently added configuration explicitly
[ -d "/home/gitpod/.sdkman" ] && [ -z "$SDKMAN_DIR" ] && export SDKMAN_DIR="/home/gitpod/.sdkman"
[ -s /home/gitpod/.sdkman/bin/sdkman-init.sh ] && [ -z "$SDKMAN_VERSION" ] && source "/home/gitpod/.sdkman/bin/sdkman-init.sh"
[ -s ~/.nvm/nvm-lazy.sh ] && source ~/.nvm/nvm-lazy.sh

cd /ide/node_modules/@gitpod/gitpod-ide
exec /ide/node/bin/gitpod-node ./src-gen/backend/main.js $*
