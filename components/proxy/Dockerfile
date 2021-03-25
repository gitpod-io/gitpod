# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

FROM openresty/openresty:1.19.3.1-3-alpine

ENV TRIGGER_REBUILD 1

# Debug convenience
ENV TERM=xterm
ENV SHELL=/bin/bash

RUN apk add --no-cache \
      vim \
      less \
      bind-tools \
      curl \
      apache2-utils \
      gettext \
      bash

# Include certbot into the proxy for HTTPS termination
RUN curl -o /usr/bin/lama -sSL https://github.com/csweichel/lama/releases/download/v0.3.0/lama_0.3.0_Linux_x86_64 \
    && chmod +x /usr/bin/lama \
    && mkdir -p /var/www/lama/nginx \
    && touch /var/www/lama/nginx/status

RUN apk add --no-cache \
      procps \
      certbot \
      certbot-nginx

RUN set -e \
    && apk add --no-cache git \
    && cd /tmp \
    && git clone https://github.com/cloudflare/lua-resty-cookie/ \
    && cp lua-resty-cookie/lib/resty/*.lua /usr/local/openresty/site/lualib/ \
    && apk del git \
    && rm -rf /tmp/*

# Update alpine packages
RUN apk upgrade --no-cache

# nginx config templates...
#COPY conf/  /etc/nginx/
# .. and startup script
COPY startup/nginx.sh /nginx.sh

COPY conf/lua-prometheus /etc/nginx/lua-prometheus

# ip.mygitpod.com HTTPS support
COPY nodomain-certs/* /nodomain-certs/

# Run!
EXPOSE 8080
CMD ["/nginx.sh"]
