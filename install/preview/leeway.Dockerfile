# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

FROM golang:1.18 as prettylog

WORKDIR /app
COPY prettylog/* ./
RUN CGO_ENABLED=0 go build .

FROM rancher/k3s:v1.21.12-k3s1

ADD https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64 /bin/mkcert
RUN chmod +x /bin/mkcert

ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static /tini
RUN chmod +x /tini

ADD https://github.com/cert-manager/cert-manager/releases/download/v1.8.0/cert-manager.yaml /var/lib/rancher/k3s/server/manifests/cert-manager.yaml

ADD https://github.com/mikefarah/yq/releases/download/v4.25.1/yq_linux_amd64 /bin/yq
RUN chmod +x /bin/yq

COPY manifests/* /app/manifests/
COPY install-installer--app/installer /gitpod-installer
COPY --from=prettylog /app/prettylog /prettylog

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT [ "/tini", "--", "/entrypoint.sh" ]
