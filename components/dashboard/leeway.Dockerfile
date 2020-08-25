# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

ARG EXCLUDE_SOURCES=""

FROM nginx:1.13 as source_excluder
ARG EXCLUDE_SOURCES

COPY components-dashboard--app/node_modules/@gitpod/dashboard/dist /www/data/dashboard
COPY components-dashboard--app/node_modules/@gitpod/dashboard/public/libs /www/data/dashboard/libs
# If specified, exclude all source maps
RUN if [ ! -z "$EXCLUDE_SOURCES" ]; then rm /www/data/dashboard/*.map; fi


FROM nginx:1.13

# Remove default stuff
RUN rm -Rf /etc/nginx/conf.d \
    && rm -f /etc/nginx/nginx.conf

COPY components-dashboard--static/conf/nginx.conf /etc/nginx/nginx.conf
COPY components-dashboard--static/conf/conf.d /etc/nginx/conf.d

COPY components-dashboard--static/public /www/data/dashboard
COPY components-dashboard--static/ee/public /www/data/dashboard
COPY --from=source_excluder /www/data/dashboard /www/data/dashboard
