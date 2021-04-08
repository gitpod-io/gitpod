# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


FROM caddy/caddy:2.4.0-beta.2-alpine

COPY components-dashboard--static/conf/Caddyfile /etc/caddy/Caddyfile
COPY components-dashboard--app/build /www
