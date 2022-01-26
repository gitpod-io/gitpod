# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

FROM rancher/k3s:v1.21.2-k3s1

# TODO: need to download https protocol
ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-arm64 /tini-arm64
RUN chmod +x /tini-arm64
ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-amd64 /tini-amd64
RUN chmod +x /tini-amd64

RUN arch="$(uname -m)"; \
	case "$arch" in \
		'x86_64') \
			mv /tini-amd64 /tini \
			;; \
		'aarch64') \
			mv /tini-arm64 /tini \
			;; \
		*) echo >&2 "error: unsupported architecture '$arch'"; exit 1 ;; \
	esac; \

VOLUME /var/gitlab/gitaly
VOLUME /var/gitlab/minio
VOLUME /var/gitlab/postgresql
VOLUME /var/gitlab/redis

VOLUME /var/gitlab/secrets-backup

COPY gitlab-helm-installer.yaml /var/lib/rancher/k3s/server/manifests/
COPY persistent-volumes.yaml /var/lib/rancher/k3s/server/manifests/

COPY entrypoint.sh /entrypoint

ENTRYPOINT [ "/tini", "-g", "--", "/entrypoint" ]
