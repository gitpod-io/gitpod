# Copyright (c) 2021 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

ARG baseref
FROM ${baseref} AS prep

USER root

# Copy config and layer script
COPY . /var/gitpod

# Run layer
WORKDIR /var/gitpod
RUN mv /var/gitpod/gitpod-cli /usr/bin/gp \
    && sh /var/gitpod/build.sh

# Switch to user gitpod
USER gitpod

# Configure user shell
# TODO Remove this in the near future when we do not need ~/.bashrc appends/prepends any more
RUN \
    # REALLY do not print motd
    touch ~/.hushlogin                                                      && \
    # Configure shell
    BASH_RC=~/.bashrc; if [ -f "$BASH_RC" ]; then cp "$BASH_RC" ~/.bashrc-org; else touch ~/.bashrc-org; fi && \
    cat /var/gitpod/gitpod/.bashrc-prepend > "$BASH_RC"                            && \
    cat ~/.bashrc-org >> "$BASH_RC"                                         && \
    cat /var/gitpod/gitpod/.bashrc-append >> "$BASH_RC"

USER root
RUN rm -rf /var/gitpod
USER gitpod
