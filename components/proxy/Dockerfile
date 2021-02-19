# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# https://docs.docker.com/samples/library/nginx/
FROM ubuntu:focal

# Purge default configuration
RUN rm -Rf /etc/nginx/conf.d/
# nginx config templates...
#COPY conf/  /etc/nginx/
# .. and startup script
COPY startup/nginx.sh nginx.sh

ENV DEBIAN_FRONTEND="noninteractive"

# Metrics export dependencies
# Set fix version for install
RUN apt-get update && apt-get install --no-install-recommends -yq \
      libnginx-mod-http-lua \
      nginx-extras \
      lua-cjson \
      lua-nginx-cookie \
    # Remove default sites installed by nginx-extras
    && rm -Rf /etc/nginx/sites-*/* \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

COPY conf/lua-prometheus /etc/nginx/lua-prometheus

# Debug convenience
ENV TERM=xterm
ENV SHELL=/bin/bash
RUN apt-get update && apt-get install -yq \
        vim \
        less \
        dnsutils \
        curl \
        apache2-utils \
        gettext-base \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Include certbot into the proxy for HTTPS termination
RUN curl -o /usr/bin/lama -sSL https://github.com/csweichel/lama/releases/download/v0.3.0/lama_0.3.0_Linux_x86_64 && \
    chmod +x /usr/bin/lama && \
    mkdir -p /var/www/lama/nginx && \
    touch /var/www/lama/nginx/status && \
    apt-get update && \
    apt-get install --no-install-recommends -yq \
        procps \
        certbot \
        python3-certbot-nginx \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

RUN rm \
    /etc/nginx/modules-enabled/50-mod-http-xslt-filter.conf \
    /etc/nginx/modules-enabled/50-mod-http-subs-filter.conf \
    /etc/nginx/modules-enabled/50-mod-http-perl.conf \
    /etc/nginx/modules-enabled/50-mod-http-cache-purge.conf \
    /etc/nginx/modules-enabled/50-mod-nchan.conf \
    /etc/nginx/modules-enabled/50-mod-http-dav-ext.conf \
    /etc/nginx/modules-enabled/50-mod-http-image-filter.conf \
    /etc/nginx/modules-enabled/50-mod-http-auth-pam.conf \
    /etc/nginx/modules-enabled/50-mod-http-fancyindex.conf \
    /etc/nginx/modules-enabled/50-mod-mail.conf

# ip.mygitpod.com HTTPS support
COPY nodomain-certs/* /nodomain-certs/

# Run!
EXPOSE 8080
CMD ["/nginx.sh"]
