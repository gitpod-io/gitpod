# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


FROM nginx:stable-alpine

# Remove default stuff
RUN rm -Rf /etc/nginx/conf.d \
    && rm -f /etc/nginx/nginx.conf

COPY components-dashboard--static/conf/nginx.conf /etc/nginx/nginx.conf
COPY components-dashboard--static/conf/conf.d /etc/nginx/conf.d

COPY components-dashboard--app/build /www/data/dashboard
