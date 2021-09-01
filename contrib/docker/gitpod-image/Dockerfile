# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

FROM rancher/k3s:v1.21.2-k3s1

ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static /tini
RUN chmod +x /tini

ADD https://github.com/mikefarah/yq/releases/download/3.3.2/yq_linux_amd64 /bin/yq
RUN chmod +x /bin/yq

VOLUME /var/gitpod/docker
VOLUME /var/gitpod/docker-registry
VOLUME /var/gitpod/minio
VOLUME /var/gitpod/mysql
VOLUME /var/gitpod/workspaces

COPY gitpod-helm-installer.yaml /var/lib/rancher/k3s/server/manifests/
COPY persistent-volumes.yaml /var/lib/rancher/k3s/server/manifests/
COPY values.yaml /default_values/01_values.yaml
COPY chart--helm/gitpod /chart

COPY entrypoint.sh /entrypoint

ENTRYPOINT [ "/tini", "-g", "--", "/entrypoint" ]
