# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

FROM rancher/k3s:v1.21.2-k3s1

# TODO: need to download https protocol
ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-arm64 /tini-arm64
RUN chmod +x /tini-arm64
ADD https://github.com/krallin/tini/releases/download/v0.19.0/tini-static-amd64 /tini-amd64
RUN chmod +x /tini-amd64

ADD https://github.com/mikefarah/yq/releases/download/3.3.2/yq_linux_arm64 /bin/yq-arm64
RUN chmod +x /bin/yq-arm64
ADD https://github.com/mikefarah/yq/releases/download/3.3.2/yq_linux_amd64 /bin/yq-amd64
RUN chmod +x /bin/yq-amd64

RUN arch="$(uname -m)"; \
	case "$arch" in \
		'x86_64') \
			mv /tini-amd64 /tini \
			mv /bin/yq-amd64 /bin/yq \
			;; \
		'aarch64') \
			mv /tini-arm64 /tini \
			mv /bin/yq-arm64 /bin/yq \
			;; \
		*) echo >&2 "error: unsupported architecture '$arch'"; exit 1 ;; \
	esac;

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
