# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# 'FROM ${BASE_IMAGE}' prepended here

###############################################################################
# REQUIRED
###############################################################################
# !!! We expect users to configure their containers as root !!!
USER root

# Copy config and layer script
# FIXME(Kreyren): This is a duplicate code that should be present in all distros
COPY ./gitpod /var/gitpod

# Run layer
# FIXME(Kreyren): This is a duplicate code that should be present in all distros
RUN /var/gitpod/layer.sh \
	# Remove the script itself
	# TODO Really necessary?
	&& rm -f /var/gitpod/layer.sh

# Switch to user gitpod
# FIXME(Kreyren): This is a duplicate code that should be present in all distros
USER gitpod

# Configure user shell
# TODO Remove this in the near future when we do not need ~/.bashrc appends/prepends any more
# FIXME(Kreyren): This is a duplicate code that should be present in all distros
RUN \
	# REALLY do not print motd
	touch ~/.hushlogin                                                      && \
	# Configure shell
	BASH_RC=~/.bashrc; if [ -f "$BASH_RC" ]; then cp "$BASH_RC" ~/.bashrc-org; else touch ~/.bashrc-org; fi && \
	cat /var/gitpod/.bashrc-prepend > "$BASH_RC"                            && \
	cat ~/.bashrc-org >> "$BASH_RC"                                         && \
	cat /var/gitpod/.bashrc-append >> "$BASH_RC"
