# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

FROM rancher/k3s:v1.21.2-k3s1

RUN apk add --no-cache tini

VOLUME /var/gitlab/gitaly
VOLUME /var/gitlab/minio
VOLUME /var/gitlab/postgresql
VOLUME /var/gitlab/redis

VOLUME /var/gitlab/secrets-backup

COPY gitlab-helm-installer.yaml /var/lib/rancher/k3s/server/manifests/
COPY persistent-volumes.yaml /var/lib/rancher/k3s/server/manifests/

COPY entrypoint.sh /entrypoint

ENTRYPOINT [ "/sbin/tini", "-g", "--", "/entrypoint" ]
