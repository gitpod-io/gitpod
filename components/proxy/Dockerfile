# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM aledbf/caddy-http2:0.5

# Debug convenience
ENV TERM=xterm
ENV SHELL=/bin/bash

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY conf/vhost.empty /etc/caddy/vhosts/vhost.empty
