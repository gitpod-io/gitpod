# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# https://docs.docker.com/samples/library/nginx/
FROM nginx:1.14.1

# Purge default configuration
RUN rm -Rf /etc/nginx/conf.d/
# nginx config templates...
#COPY conf/  /etc/nginx/
# .. and startup script
COPY startup/nginx.sh nginx.sh


# Metrics export dependencies
# Set fix version for install
RUN echo "deb http://ftp.debian.org/debian stretch-backports main" >> /etc/apt/sources.list.d/stretch-backports.list && \
    apt-get update && apt-get -t stretch-backports install --no-install-recommends -yq \
      #libnginx-mod-http-lua \  # For newer distros
      # pin the latest version available for stretch-backports: https://packages.debian.org/stretch-backports/httpd/#nginx
      nginx-extras=1.14.1-1~bpo9+1 \
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
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Include certbot into the proxy for HTTPS termination
RUN curl -o /usr/bin/lama -L https://github.com/csweichel/lama/releases/download/v0.3.0/lama_0.3.0_Linux_x86_64 && \
    mkdir -p /var/www/lama/nginx && \
    touch /var/www/lama/nginx/status && \
    apt-get update && \
    apt-get install -yq \
        procps \
        certbot \
        python-certbot-nginx

# ip.mygitpod.com HTTPS support
COPY nodomain-certs/* /nodomain-certs/

# Run!
EXPOSE 8080
CMD ["/nginx.sh"]
