# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM rancher/k3s:v1.21.12-k3s1

ADD https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 /bin/mkcert
RUN chmod +x /bin/mkcert

ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static /tini
RUN chmod +x /tini

ADD https://github.com/mikefarah/yq/releases/download/v4.25.1/yq_linux_amd64 /bin/yq
RUN chmod +x /bin/yq

COPY manifests/* /app/manifests/
COPY install-installer--app/installer /gitpod-installer
COPY install-preview-prettylog--app/prettylog /prettylog

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/tini", "--", "/entrypoint.sh" ]
